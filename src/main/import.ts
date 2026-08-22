/**
 * Fill the model from a configuration that was read off a remote.
 *
 * **The only file in this repository that reads values out of `@harmony/codec` and turns them into
 * ours**, which is why it is in the main process and not in `src/shared`: the shared model is plain
 * data with no library behind it, and the projection lives on one side of that line.
 *
 * It is a **projection and not a second reading**. Every fact below comes out of a reader next door;
 * nothing here decodes a byte, walks a pointer or interprets an opcode. If something needed here does
 * not exist in the library, it gets added to the library.
 *
 * **What comes out is deliberately incomplete, and that is the finding rather than a shortcoming.** A
 * configuration is compiled, so the intent is gone: a device has codes and no identity, an activity has
 * instructions and no kind, and no command has a name. Each of those is left absent rather than filled
 * with a plausible default, because a default here is a claim about somebody else's equipment.
 * `writeback.ts` says the same thing per field, and `docs/data-model.md` argues it.
 */
import { createHash } from 'node:crypto';

import {
  activities as readActivities,
  configLanguage,
  deviceVariables,
  devices as readDevices,
  infraredCodesPerList,
  irBlockWords,
  irCarrier,
  irGroups,
  irHeaderPointers,
  IR_BLOCK_HELD,
  IR_BLOCK_ONCE,
  IR_BLOCK_TAIL,
  keyCodes,
  keyLabels,
  parse,
  payloadOf,
  stateRecords,
} from '@harmony/codec';
import type { Container } from '@harmony/codec';

import type {
  Activity, ButtonBinding, DeviceUse, RemoteContent, Step,
} from '../shared/content.ts';
import type {
  DeviceCommand, DeviceDefinition, DeviceProperty, InfraredSignal, Pulse, StateTransition,
} from '../shared/library.ts';
import { fingerprintOf } from '../shared/library.ts';
import { seededDeviceMaps } from '../shared/buttonmap.ts';

/** A mark rather than a space, in a duration word. The library states the bit; this names it once. */
const MARK = 0x8000;
const DURATION = 0x7fff;

export interface Imported {
  readonly content: RemoteContent;
  /**
   * One provisional definition per device the configuration drives.
   *
   * **Provisional** because a configuration cannot say which appliance a device is. So these go into
   * the library with no manufacturer, no model and `from-a-configuration` as their origin, which is
   * both the honest description and the flag that stops them ever being shared. Identifying one is a
   * later action by a person or by Logitech's catalogue, and it is an edit to the definition rather
   * than a second import.
   */
  readonly definitions: readonly DeviceDefinition[];
}

/**
 * Turn the durations of one block into marks and spaces.
 *
 * The terminating zero is dropped, since it is the block's end and not a duration. Nothing else is
 * filtered: a capped 32767 followed by another space is a long gap, not a defect, which is why the
 * model carries the mark bit rather than assuming an alternation.
 */
function pulses(c: Container, address: number): Pulse[] | undefined {
  if (address === 0) return undefined;
  const words = irBlockWords(c, address);
  if (words === undefined) return undefined;
  return words
    .filter((word) => (word & DURATION) !== 0)
    .map((word) => ({ mark: (word & MARK) !== 0, us: word & DURATION }));
}

/** What one infrared record sends, as the model describes a signal. */
function signalOf(c: Container, record: number): InfraredSignal {
  const blocks = irHeaderPointers(c, record);
  const carrier = irCarrier(c, record);
  const once = pulses(c, blocks[IR_BLOCK_ONCE] ?? 0);
  const held = pulses(c, blocks[IR_BLOCK_HELD] ?? 0);
  const tail = pulses(c, blocks[IR_BLOCK_TAIL] ?? 0);
  return {
    // The protocol and the frame are deliberately not filled in. The library can decode a frame out of
    // these durations, and doing it here would put a derived value in a store, where the next reader
    // cannot tell it from something a catalogue stated.
    ...(carrier?.hertz === undefined ? {} : { carrierHz: carrier.hertz }),
    ...(once === undefined ? {} : { once }),
    ...(held === undefined ? {} : { held }),
    ...(tail === undefined ? {} : { tail }),
  };
}

/** The opcode a transition carries when it runs an action list, which is the only kind that sends. */
const RUNS_A_LIST = 0x7f;

/**
 * What can be in more than one state about each appliance, and how the remote changes it.
 *
 * The configuration holds this per appliance, which is what lets a Harmony leave a television alone
 * when it is already on. A property is a named thing with a number of values, and each entry in its
 * table says: to get from this value to that one, run this list of commands.
 *
 * **Only the appliance's own commands are kept.** A transition that reaches another appliance's codes
 * would mean the property does not belong to the device it is filed under, so it is dropped rather than
 * stored somewhere it would be wrong, and `foreign` counts how often that happens.
 *
 * That count is **zero** on all four configurations, 89 transitions across 27 properties, and it is
 * exported so a test can say so rather than a comment. It is a real closure and not bookkeeping: the
 * pairing between a property and an appliance comes from the name tree, and which codes a transition
 * sends comes from the action lists, so two unrelated readings agreeing is evidence the pairing is
 * right. A nonzero count would mean one of them is wrong.
 */
export function propertiesOf(c: Container): { properties: Map<number, DeviceProperty[]>; foreign: number } {
  const records = stateRecords(c);
  const codesPerList = infraredCodesPerList(c);
  const bySlot = new Map<number, DeviceProperty[]>();
  const groupOf = new Map<string, number>();
  for (const device of readDevices(c)) {
    if (device.name !== undefined) groupOf.set(device.name, device.group);
  }
  let foreign = 0;
  for (const variable of deviceVariables(c)) {
    const slot = groupOf.get(variable.device);
    if (slot === undefined) continue;
    const record = records?.[variable.index];
    if (record === undefined) continue;
    const transitions: StateTransition[] = [];
    for (const value of record.values) {
      if (value.opcode !== RUNS_A_LIST) continue;
      const sent = codesPerList.get(value.operand) ?? [];
      const mine = sent.filter((one) => one.group === slot);
      if (mine.length !== sent.length) foreign += 1;
      if (mine.length === 0) continue;
      transitions.push({ from: value.from, to: value.to, sends: mine.map((one) => one.code) });
    }
    const properties = bySlot.get(slot) ?? [];
    // `second` is the highest value, so the number of states is one more, which is also the number the
    // configuration's own name for the variable ends in.
    properties.push({ name: variable.property, values: record.second + 1, transitions });
    bySlot.set(slot, properties);
  }
  return { properties: bySlot, foreign };
}

/** Every device the configuration drives, as a provisional definition plus its use on this remote. */
/**
 * What a definition read out of a configuration is called.
 *
 * **Named after what it sends**, which makes the identifier a property of the appliance rather than of
 * the read that found it. Three things follow, and all three are the behaviour wanted:
 *
 *   - reading the same remote a second time produces the same identifiers, so a routine re-read leaves
 *     the library exactly as it was instead of describing everything twice
 *   - the same television on two remotes is **one** definition, which is the whole reason the library
 *     sits outside the document
 *   - a rename of the document changes nothing, because a person's own words are not in it
 *
 * The identifier used to be built from the caller's prefix, and passing the document's name produced
 * `living room-device-0`, which the store refuses because an identifier is a file name. That was a
 * symptom rather than the fault: deriving a definition's permanent identity from something somebody can
 * rename was wrong however it was spelled.
 *
 * **An appliance with no commands falls back to the prefix**, and it has to: every appliance nobody has
 * taught anything to sends the same nothing, so they would all be one definition. There is no content to
 * address, so the read that found it is the honest identity. The caller supplies a prefix that is itself
 * a usable identifier, which for a document means its configuration's digest and not its name.
 *
 * Hashed rather than used whole because a fingerprint is thousands of characters and this becomes a file
 * name. Sixteen hexadecimal characters is 64 bits, against a library of a few dozen appliances.
 */
function identifierFor(commands: readonly DeviceCommand[], fallback: string): string {
  const fingerprint = fingerprintOf(commands);
  if (fingerprint === '') return fallback;
  return `appliance-${createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)}`;
}

function devicesOf(c: Container, now: string, idPrefix: string, readFrom?: string): {
  uses: DeviceUse[];
  definitions: DeviceDefinition[];
} {
  const labelled = new Map(readDevices(c).map((one) => [one.group, one]));
  const { properties } = propertiesOf(c);
  const uses: DeviceUse[] = [];
  const definitions: DeviceDefinition[] = [];
  (irGroups(c) ?? []).forEach((group, slot) => {
    const commands: DeviceCommand[] = group.addresses.map((record, index) => ({
      slot: index,
      signal: signalOf(c, record),
      origin: 'from-a-configuration' as const,
    }));
    const id = identifierFor(commands, `${idPrefix}-device-${slot}`);
    definitions.push({
      id,
      // No manufacturer and no model, per `Imported.definitions`. `other` rather than a guess from the
      // label: "TV" in a name tree is what its owner typed and not a statement about what it drives.
      kind: 'other',
      commands,
      properties: properties.get(slot) ?? [],
      timing: {},
      origin: 'from-a-configuration',
      ...(readFrom === undefined ? {} : { addedFrom: readFrom }),
      addedAt: now,
    });
    const label = labelled.get(slot)?.name;
    uses.push({ slot, definition: id, ...(label === undefined ? {} : { label }) });
  });
  return { uses, definitions };
}

/**
 * The activities, with their names and the devices they drive.
 *
 * **`onStart` and `onStop` come out empty, and the first version of this function was wrong about
 * why.** It filled `onStart` from the codes the starting button's action list sends, which reads
 * correctly and measures zero on all four configurations: that list **selects** the activity's key map
 * and enters a mode, and the codes that switch equipment on live in the key map's own enter handler one
 * hop further along. So the number was 0 of 15 activities and the reasoning was the give away, not the
 * code.
 *
 * Where they really live is a base slot 9 set's event type 0 entries, tags 1, 2 and 5, which are three
 * tags for two roles, and which tag is the leave handler is not established in the library next door.
 * Guessing would produce an activity that switches the television off when you start watching it, so
 * both stay empty and this is the one absence in the import that a **reading** could fill. Everything
 * else missing here was discarded by the compiler and no reading will ever bring it back.
 */
function activitiesOf(c: Container): Activity[] {
  return readActivities(c).map((one) => ({
    slot: one.activity,
    ...(one.name === undefined ? {} : { name: one.name }),
    // Empty, not unknown: a configuration says nothing about what an activity was for or which device
    // does which job in it. That is what the model is for.
    roles: [],
    onStart: [],
    onStop: [],
    // Empty for the same reason as the two above it, and it is the one worth chasing: what an activity
    // wants every appliance to be doing is written by its own enter handler, and there is a candidate
    // way to tell that handler from the leave one, since the enter handler is the one that records the
    // activity as running. Establishing that belongs next door, with a measurement behind it.
    wants: [],
    devices: one.devices,
  } satisfies Activity));
}

/**
 * Every button binding that sends something, on either surface, with the label where one is drawn.
 *
 * **`inActivity` is the activity, and it used to be the configuration's own set number.** Corrected on 22
 * August 2026, and it was found by building the screen that reads it: a keypad key belongs to a base slot 9
 * binding map, and this wrote that map's index into a field whose own docstring says "which activity, by
 * position". The two are different spaces and they do not even overlap. On one Harmony One the activities
 * are 0 to 6 and 8 and the maps holding their keys are 7 to 15, so every single one of 220 bindings named
 * an activity that either does not exist or is the wrong one, and nothing failed: the numbers were
 * plausible, and no test asked what any of them meant.
 *
 * A map no activity installs leaves the field absent, which is the honest answer and is also where a
 * **device mode** would land: the keypad driving one device with nothing running. No configuration here has
 * one, and the measurement is worth knowing rather than assuming, since it is what makes the field's
 * absence rare rather than impossible. Of 48 maps in the five files, exactly the 16 an activity installs
 * send an infrared code; the other 32 send nothing at any depth and ten of them bind fifty or more keys to
 * comparisons and mode entries, which is a menu.
 *
 * The mapping is already read next door, since an activity's own record carries the set its keys live in,
 * so this is a lookup rather than a derivation. A set no activity claims keeps no context at all rather
 * than being given a number that would be a guess.
 *
 * **`inDeviceMode` is still the configuration's page index and not a device position**, which the field's
 * docstring now says outright. It is left as it is deliberately: there is no screen that reads it yet, and
 * resolving it needs the reading that says which device a screen page belongs to. Naming it honestly is
 * what stops it being trusted in the meantime.
 */
function buttonsOf(c: Container): ButtonBinding[] {
  const labels = keyLabels(c);
  // Which activity each keypad binding set belongs to. One entry per activity, so a set nothing claims is
  // simply absent and its keys carry no context.
  const activityOfSet = new Map<number, number>();
  for (const one of readActivities(c)) {
    if (one.set >= 0) activityOfSet.set(one.set, one.activity);
  }
  const out: ButtonBinding[] = [];
  for (const key of keyCodes(c)) {
    // Event type 0 in a handler set is that set's enter or leave handler rather than a key, so it is
    // not a button and does not belong in a button map.
    if (key.event === 0) continue;
    if (key.codes.length === 0) continue;
    const sends: Step[] = key.codes.map((sent) => ({ device: sent.group, command: sent.code }));
    const label = key.where === 'page' ? labels.get(`${key.index}:${key.scan}`)?.text : undefined;
    const activity = key.where === 'page' ? undefined : activityOfSet.get(key.index);
    out.push({
      surface: key.where === 'page' ? 'screen' : 'keypad',
      scan: key.scan,
      ...(label === undefined ? {} : { label }),
      ...(key.where === 'page' ? { inDeviceMode: key.index } : {}),
      ...(activity === undefined ? {} : { inActivity: activity }),
      sends,
    });
  }
  return out;
}

/**
 * Read a configuration and describe what it sets the remote up to do.
 *
 * `bytes` may be a bare container or a file with a wrapper around it; the library decides which, since
 * knowing that is knowing the format. `idPrefix` is what the provisional definitions are named after,
 * so that two imports do not collide in one library.
 */
export function importConfiguration(
  bytes: Uint8Array,
  options: {
    readonly now: string;
    readonly idPrefix: string;
    /**
     * The model this was read off, where the caller knows it, so a definition can say where it came from.
     *
     * Optional because two of the callers genuinely do not know and must not guess: a projection made to
     * draw a screen is not a reading, and the definitions it produces are thrown away. Only the paths that
     * **keep** a definition pass it.
     */
    readonly readFrom?: string;
  },
): Imported {
  // A file may be a bare container or have Logitech's own wrapper around it, and the library decides
  // which, since knowing that is knowing the format. The name is only used in its error message.
  const payload = payloadOf(bytes, options.idPrefix);
  const c = parse(payload);
  const { uses, definitions } = devicesOf(c, options.now, options.idPrefix, options.readFrom);
  // The language, where the evidence carries it. `configLanguage` returns the tag with what it matched
  // and what the runner up scored; only the tag crosses into the model, because a screen has nothing to
  // do with the margin and a document should not carry a confidence somebody will later read as a fact.
  // An absent value means the reader refused, which it does on anything that is not somebody's config.
  const language = configLanguage(c)?.tag;
  // **A device's own button map, which the configuration does not contain.** Device mode is the old remote
  // of one appliance: press Devices, pick the television, and every key drives the television. No keypad
  // map in any configuration read here sends a code outside an activity, so there is nothing to copy, and
  // an imported document with no device maps would show an empty keypad on every device page.
  //
  // So it is reconstructed, once, at the moment of the import: an activity's map is the device's map plus
  // that activity's overrides, so where every activity that binds a key agrees, that agreement is the
  // device's own answer. `shared/buttonmap.ts` holds the reasoning and leaves a key the activities disagree
  // about unbound rather than picking one of two.
  const activities = activitiesOf(c);
  const bindings = buttonsOf(c);
  return {
    content: {
      devices: uses,
      activities,
      buttons: [...bindings, ...seededDeviceMaps(bindings, uses.map((one) => one.slot))],
      ...(language === undefined ? {} : { language }),
      filledFrom: 'a-configuration',
    },
    definitions,
  };
}

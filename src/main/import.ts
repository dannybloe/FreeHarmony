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
import {
  activities as readActivities,
  devices as readDevices,
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
} from '@harmony/codec';
import type { Container } from '@harmony/codec';

import type {
  Activity, ButtonBinding, DeviceUse, RemoteContent, Step,
} from '../shared/content.ts';
import type {
  DeviceCommand, DeviceDefinition, InfraredSignal, Pulse,
} from '../shared/library.ts';

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

/** Every device the configuration drives, as a provisional definition plus its use on this remote. */
function devicesOf(c: Container, now: string, idPrefix: string): {
  uses: DeviceUse[];
  definitions: DeviceDefinition[];
} {
  const labelled = new Map(readDevices(c).map((one) => [one.group, one]));
  const uses: DeviceUse[] = [];
  const definitions: DeviceDefinition[] = [];
  (irGroups(c) ?? []).forEach((group, slot) => {
    const id = `${idPrefix}-device-${slot}`;
    const commands: DeviceCommand[] = group.addresses.map((record, index) => ({
      slot: index,
      signal: signalOf(c, record),
      origin: 'from-a-configuration' as const,
    }));
    definitions.push({
      id,
      // No manufacturer and no model, per `Imported.definitions`. `other` rather than a guess from the
      // label: "TV" in a name tree is what its owner typed and not a statement about what it drives.
      kind: 'other',
      commands,
      timing: {},
      origin: 'from-a-configuration',
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
    devices: one.devices,
  } satisfies Activity));
}

/** Every button binding that sends something, on either surface, with the label where one is drawn. */
function buttonsOf(c: Container): ButtonBinding[] {
  const labels = keyLabels(c);
  const out: ButtonBinding[] = [];
  for (const key of keyCodes(c)) {
    // Event type 0 in a handler set is that set's enter or leave handler rather than a key, so it is
    // not a button and does not belong in a button map.
    if (key.event === 0) continue;
    if (key.codes.length === 0) continue;
    const sends: Step[] = key.codes.map((sent) => ({ device: sent.group, command: sent.code }));
    const label = key.where === 'page' ? labels.get(`${key.index}:${key.scan}`)?.text : undefined;
    out.push({
      surface: key.where === 'page' ? 'screen' : 'keypad',
      scan: key.scan,
      ...(label === undefined ? {} : { label }),
      ...(key.where === 'page' ? { inDeviceMode: key.index } : { inActivity: key.index }),
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
  options: { readonly now: string; readonly idPrefix: string },
): Imported {
  // A file may be a bare container or have Logitech's own wrapper around it, and the library decides
  // which, since knowing that is knowing the format. The name is only used in its error message.
  const payload = payloadOf(bytes, options.idPrefix);
  const c = parse(payload);
  const { uses, definitions } = devicesOf(c, options.now, options.idPrefix);
  return {
    content: {
      devices: uses,
      activities: activitiesOf(c),
      buttons: buttonsOf(c),
      filledFrom: 'a-configuration',
    },
    definitions,
  };
}

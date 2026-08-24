/**
 * Per field of the model, whether it can ever reach a remote.
 *
 * The column nobody can guess, and the reason it is code rather than a paragraph: an interface that
 * offers to change something which can never leave this machine has wasted somebody's afternoon, and it
 * finds out at the moment they press the button. `docs/data-model.md` has the measurement this table is
 * built from and the sibling repository has the emitter it was measured with.
 *
 * **The compiler enforces that the table is complete.** Every table below is a mapped type over the
 * interface it describes, with the optional markers stripped, so adding a field to the model fails the
 * typecheck until somebody has said what happens to it. That is the whole mechanism: nothing here has
 * to be remembered.
 *
 * The measurement, run on 21 August 2026 over one Harmony One and one Harmony 600 configuration of our
 * own, is the share of a structure's bytes the emitter computes from named fields rather than copying
 * through as an opaque run. `rebuilt` below means that structure came out at 100% or close to it.
 */
import type {
  DeviceCommand, DeviceDefinition, DeviceProperty, DeviceTiming, InfraredSignal, StateTransition,
} from './library.ts';
import type {
  Activity, ActivityRole, ButtonBinding, DesiredState, DeviceUse, RemoteContent, Sequence,
  SequenceItem, Step,
} from './content.ts';

/** What happens to a field when a configuration is written. */
export type Writeback =
  /** The structure holding it is built from named fields, so a change to it can reach a remote. */
  | 'rebuilt'
  /**
   * The bytes are known and only copied, so a change is reachable but bounded.
   *
   * In practice this is drawn text, which sits inside a screen program whose instructions are framed
   * and whose payload is not. A same length change is possible today; a longer one needs the file to
   * be able to grow, which is the one item in the plan with nobody assigned to it.
   */
  | 'carried'
  /** A configuration probably states this and nobody has found where. Not a decision, an admission. */
  | 'unknown'
  /**
   * It lives here and never reaches a configuration at all.
   *
   * The interesting half of the model rather than the leftovers. A command's name, what kind of thing
   * an activity is, which device does the sound: a compiler threw all of that away, which is why the
   * document is the source and the configuration is the output.
   */
  | 'ours';

export interface Verdict {
  readonly writeback: Writeback;
  /** Where it lives in a configuration. Absent exactly when the verdict is `ours`. */
  readonly structure?: string;
  /** Why, where the verdict is not obvious from the structure alone. */
  readonly note?: string;
  /**
   * The phrase the diagram should print instead of the verdict's own wording.
   *
   * There for one case and it should stay rare: `unknown` prints "a config states it somewhere,
   * unread", which is true of every field that has it except `ButtonBinding.sendsOnLongPress`, where
   * **no configuration this application can read states it at all**. A generated label is a claim like
   * any other, and the generator's own rule for those words is the fewest that are still true.
   */
  readonly words?: string;
}

/** One verdict per field of `T`, optional markers included, so the table cannot be half written. */
export type Verdicts<T> = { readonly [K in keyof Required<T>]: Verdict };

export const SIGNAL: Verdicts<InfraredSignal> = {
  // Symbolic. A configuration holds pulses and no protocol name, so these are ours even though the
  // library next door can derive them from the pulses: derivable is not stored.
  protocol: { writeback: 'ours' },
  bits: { writeback: 'ours' },
  frame: { writeback: 'ours' },
  carrierHz: { writeback: 'rebuilt', structure: 'base slot 5, a record header' },
  once: { writeback: 'rebuilt', structure: 'base slot 5, a duration block' },
  held: { writeback: 'rebuilt', structure: 'base slot 5, a duration block' },
  tail: { writeback: 'rebuilt', structure: 'base slot 5, a duration block' },
};

export const COMMAND: Verdicts<DeviceCommand> = {
  slot: { writeback: 'rebuilt', structure: "base slot 5, the device's own record array" },
  name: { writeback: 'ours', note: 'an infrared record carries no name of its own' },
  group: { writeback: 'ours' },
  signal: { writeback: 'rebuilt', structure: 'base slot 5', note: 'see SIGNAL for the fields' },
  origin: { writeback: 'ours' },
};

export const TIMING: Verdicts<DeviceTiming> = {
  // **All three used to say base slot 15 and be unknown, and the guess was wrong.** It read reasonably:
  // Logitech's editor names all three, and base slot 15 is where per device parameters live. On 23
  // August 2026 a configuration Logitech compiled to our own specification settled the first one, and
  // it is not a parameter at all.
  betweenKeysMs: {
    writeback: 'rebuilt',
    structure: "base slot 10, as pause instructions inside every list that sends this appliance two "
      + 'codes in a row',
    // Measured rather than reasoned, and against the obvious reading. The compiler stores no number:
    // it emits the delay as pauses, in **tenths of a second**, with the appliance's own infrared group
    // in the operand's high byte. Six devices carried three distinct delays, 100, 200 and 400 ms with
    // multiplicities 3, 2 and 1, and the compiled file has one group with 0.4 s pauses, two with 0.2 s
    // and 0.1 s everywhere, with nothing fitted to make that line up. So this is reachable, and it is
    // reachable the same way `Activity.powerOnOrder` is: not a field to overwrite but a consequence
    // spread across every list that sends to this appliance, and a writer has to change all of them.
    note: 'not a stored number: pauses in tenths of a second, spread over every list for this appliance',
  },
  // Left as it was, deliberately. The same mechanism is the obvious guess and it is **not** measured:
  // five of the six devices carry the same 500 ms, so the corpus has no multiplicity to match against,
  // and one second pauses also appear as authored sequence delays, which would swamp the signal. A
  // device set to a value nobody else has would settle it in one compile.
  betweenDevicesMs: { writeback: 'unknown', structure: 'probably the same pauses, unmeasured' },
  // Narrowed rather than answered on 23 August 2026, and the negatives are worth carrying because each
  // one cost a search: it is **not** a code following itself in an action list (no send in 482 lists is
  // followed by itself, in any group), **not** a repetition inside the code's own first duration block
  // (no block of 475 is the same pattern two, three or four times), and **not** a byte in the infrared
  // record header that is constant within a group (only two of 21 are, and both are 1 everywhere).
  minimumRepeats: { writeback: 'unknown', structure: 'not found; the record header, the lists and the '
    + 'block contents are all ruled out' },
  // The three hold values, added on 23 August 2026 when Logitech's own appliance records turned out to
  // carry six timings where this model had three. Unknown, and for a harder reason than the three above:
  // those have a value that varies between appliances for a compiled file to be searched for, and these
  // are 100, 0 and 0 on every appliance of the only account read, so there is nothing to search for.
  heldBetweenKeysMs: { writeback: 'unknown', structure: 'unmeasured; constant across the corpus' },
  heldBetweenDevicesMs: { writeback: 'unknown', structure: 'unmeasured; constant across the corpus' },
  heldMinimumRepeats: { writeback: 'unknown', structure: 'unmeasured; constant across the corpus' },
};

export const TRANSITION: Verdicts<StateTransition> = {
  from: { writeback: 'rebuilt', structure: "base slot 13, a state variable's transitions" },
  to: { writeback: 'rebuilt', structure: "base slot 13, a state variable's transitions" },
  sends: { writeback: 'rebuilt', structure: 'base slot 10, the action list a transition runs' },
};

export const PROPERTY: Verdicts<DeviceProperty> = {
  name: { writeback: 'rebuilt', structure: "base slot 0's name tree" },
  values: { writeback: 'rebuilt', structure: "base slot 13, the record's highest value plus one" },
  transitions: { writeback: 'rebuilt', structure: 'base slot 13' },
};

export const DESIRED: Verdicts<DesiredState> = {
  // All three are in the file, in a key map's enter handler, as a write into a state variable. The
  // verdict is about writing and not about reading: these can be produced, and which handler to read
  // them out of is the open question the import records.
  device: { writeback: 'rebuilt', structure: "base slot 9's enter handler" },
  property: { writeback: 'rebuilt', structure: 'base slot 13, which variable the write names' },
  value: { writeback: 'rebuilt', structure: "base slot 9's enter handler" },
};

export const DEFINITION: Verdicts<DeviceDefinition> = {
  id: { writeback: 'ours' },
  // Ours, and worth telling apart from `DEVICE_USE.label` two blocks down, which looks like the same
  // field and is not: a configuration does name the appliance on **that** remote, in base slot 0's name
  // tree, and that name is the label. What it never names is the description, which belongs to this
  // machine and is seen the same way by every remote pointing at it.
  name: { writeback: 'ours', note: 'a configuration names a use, never a description' },
  manufacturer: { writeback: 'ours' },
  model: { writeback: 'ours' },
  kind: { writeback: 'ours' },
  commands: { writeback: 'rebuilt', structure: 'base slot 5' },
  properties: { writeback: 'rebuilt', structure: 'base slot 13 and base slot 0' },
  timing: { writeback: 'unknown', structure: 'base slot 15' },
  origin: { writeback: 'ours' },
  addedAt: { writeback: 'ours' },
  // Ours, and the one field here that is **about** a configuration without coming out of one: it records
  // which model was read, which the reading knew and the configuration never states.
  addedFrom: { writeback: 'ours', note: 'the model that was read, not anything the file says' },
};

export const DEVICE_USE: Verdicts<DeviceUse> = {
  slot: { writeback: 'rebuilt', structure: "base slot 5's group array" },
  definition: { writeback: 'ours', note: 'nothing in a configuration names a catalogue entry' },
  label: { writeback: 'rebuilt', structure: "base slot 0's name tree" },
};

export const STEP: Verdicts<Step> = {
  device: { writeback: 'rebuilt', structure: 'base slot 10, an action list' },
  command: { writeback: 'rebuilt', structure: 'base slot 10, an action list' },
};

export const ROLE: Verdicts<ActivityRole> = {
  kind: { writeback: 'ours' },
  // Ours as well, and not because the number has nowhere to live: a device position is stated all over
  // a configuration. It is the **pairing** that is ours, and half of an invented pair is still invented.
  device: { writeback: 'ours' },
  // The name is ours; the value it selects is in the file, as this appliance's input property. So the
  // choice survives a round trip and the word for it does not.
  input: { writeback: 'ours', note: "the value is in the file as the input property's value" },
  // The order is not a field anywhere: it is the order the enter handler's instructions sit in, which
  // is why it can be written back at all.
  powerOnOrder: { writeback: 'rebuilt', structure: "the order of base slot 9's enter handler" },
  powerOffOrder: { writeback: 'rebuilt', structure: "the order of base slot 9's leave handler" },
  // Same standing as `TIMING.betweenDevicesMs` since 23 August 2026: base slot 15 was a guess and
  // the one timing that has been measured turned out to be pauses in an action list instead.
  // Their `NextDevicePowerOnDelay`, null on all 22 roles read, which is why it stays unmeasured: the
  // pause it would compile to has no value in the corpus to be recognised by.
  delayAfterMs: { writeback: 'unknown', structure: 'probably a pause in a list, no value in the corpus' },
};

export const ACTIVITY: Verdicts<Activity> = {
  slot: { writeback: 'rebuilt', structure: "base slot 9's handler sets" },
  name: {
    writeback: 'carried',
    structure: 'base slot 11, a glyph string inside a screen program',
    note: 'a name is drawn rather than stored as text, and a shared string is drawn from many places',
  },
  kind: { writeback: 'ours' },
  roles: { writeback: 'ours' },
  onStart: { writeback: 'rebuilt', structure: "base slot 9's enter handler" },
  onStop: { writeback: 'rebuilt', structure: "base slot 9's leave handler" },
  wants: {
    writeback: 'rebuilt',
    structure: "base slot 9's enter handler, as writes into state variables",
    note: 'what an activity really is; reading it waits on which handler is the enter one',
  },
  devices: { writeback: 'rebuilt', structure: "base slot 9, what the set's bindings send to" },
  // Rebuilt, and the verdict is about writing rather than reading, like `wants` above it. What a sequence
  // compiles to is fully read: an action list per binding, with pauses as `0x7C` in tenths of a second.
  // What cannot be read is the other direction, and that is guaranteed rather than pending, so an import
  // leaves this empty for good.
  sequences: {
    writeback: 'rebuilt',
    structure: 'base slot 10, one action list per binding, pauses inline',
    note: 'writable and never readable: the compiler expands a copy per binding and the copies differ',
  },
  // The mode an activity enters is in the file and which of Logitech's three named screens it is is not
  // established, so this is `unknown` in the ordinary sense: something states it and nobody has found it.
  opensOn: { writeback: 'unknown', structure: 'base slot 6, the mode an activity enters' },
};

export const BUTTON: Verdicts<ButtonBinding> = {
  surface: { writeback: 'rebuilt', structure: 'base slot 6 for a screen key, base slot 9 for a keypad key' },
  scan: { writeback: 'rebuilt', structure: "a tagged list's key code" },
  label: { writeback: 'carried', structure: 'base slot 11, as for an activity name' },
  inActivity: { writeback: 'rebuilt', structure: "base slot 9's handler sets" },
  inDeviceMode: { writeback: 'rebuilt', structure: "base slot 6's mode table" },
  sends: { writeback: 'rebuilt', structure: 'base slot 10, an action list' },
  sendsOnLongPress: {
    writeback: 'unknown',
    structure: 'no configuration here holds one, so no structure is known',
    // Not the usual admission this verdict records. The others say a configuration states something and
    // nobody has found where; this says no configuration we can read states it at all, because no model
    // we can read has the feature. `hasLongPress` in `@harmony/usb` is the measured form of that, and
    // `test/import.test.ts` asserts the field is absent over every binding of every sample. So
    // `unknown` is right for the reason it is normally wrong: there is nothing to look for until a
    // model that has one can be read.
    note: 'no model this application reads offers a long press, so there is nothing to write back yet',
    words: 'no model we read has one',
  },
  // Ours, and it is the interesting kind: the file states the scan code, so this name is what the
  // compiler resolved that code **from**. The joining table is measured for 68 keys of two models and
  // for nothing else, so deriving it is possible in patches and is not attempted.
  key: { writeback: 'ours', note: 'the file states a scan code; the name is what it was resolved from' },
  // Unknown rather than ours, and the distinction matters: a screen page certainly belongs to something
  // in the file, since the remote has to know which appliance a pad drives. Which page belongs to which
  // appliance is the reading nobody has made, and `inDeviceMode` is the page number in the meantime.
  forDevice: { writeback: 'unknown', structure: 'base slot 6, a page of the mode table' },
  // The reference is ours; what it points at is rebuilt. A configuration holds the expanded list on the
  // binding and no handle at all, so this field is how the document keeps something the file dissolves.
  runsSequence: { writeback: 'ours', note: 'a configuration holds the expanded list and no handle' },
  // Rebuilt, and it takes four sections rather than a binding: a record per appliance in the number
  // sender, a list per channel, the state variable values whose transitions run those lists, and a screen
  // page. A channel with a leading zero takes a different route again, spelled out digit by digit.
};

export const SEQUENCE: Verdicts<Sequence> = {
  // Ours, like a description's identifier and for the same reason: the name is what a person edits.
  id: { writeback: 'ours', note: 'a configuration offers no handle for a sequence' },
  // The one field of a sequence that never reaches a remote at all. A sequence is expanded into
  // instructions and its name is drawn nowhere, so this is the field the whole reference shape exists
  // for: without it, two buttons running one sequence would be indistinguishable from two copies.
  name: { writeback: 'ours', note: 'a sequence is expanded into instructions and its name is drawn nowhere' },
  items: { writeback: 'rebuilt', structure: 'base slot 10, an action list per binding' },
};

export const SEQUENCE_ITEM: Verdicts<SequenceItem> = {
  // Not a field in the file: a send is an instruction and a wait is a different instruction, so which of
  // the two an item is comes out of the opcode. Rebuilt, because that is what emitting one decides.
  does: { writeback: 'rebuilt', structure: 'base slot 10, which opcode the instruction carries' },
  step: { writeback: 'rebuilt', structure: 'base slot 10, a send instruction' },
  // The one place the model is finer than Logitech's own editor: their records hold whole seconds and the
  // file holds tenths, exact on five authored values from one second to twenty.
  waitMs: {
    writeback: 'rebuilt',
    structure: 'base slot 10, opcode 0x7C, in tenths of a second',
    note: 'a multiple of 100 ms reaches a remote exactly; anything finer cannot be written',
  },
};

export const CONTENT: Verdicts<RemoteContent> = {
  devices: { writeback: 'rebuilt', structure: 'base slot 5 and base slot 0' },
  activities: { writeback: 'rebuilt', structure: 'base slot 9 and base slot 10' },
  buttons: { writeback: 'rebuilt', structure: 'base slot 6, 9 and 10' },
  language: {
    writeback: 'carried',
    structure: "base slot 11's screen programs, as hundreds of drawn strings",
    // The only field in this table that is not one place in the file. There is no language field: the
    // language **is** every word the remote shows, so changing it means regenerating all of them, and
    // the Help walkthrough alone is a third to a half of the pages. `carried` is right in the sense
    // that the words come through a save untouched, and misleading if read as "a same length edit
    // would do it", so this note is the correction: nothing here can change a configuration's
    // language, and the flag exists so that whatever generates a page later knows which one to use.
    note: 'no field states it; it is inferred from Logitech\'s own wording and never written back',
  },
  filledFrom: { writeback: 'ours' },
};

/** Every table, so a check can walk them without naming them one at a time. */
export const TABLES: Readonly<Record<string, Readonly<Record<string, Verdict>>>> = {
  SIGNAL, COMMAND, TRANSITION, PROPERTY, DESIRED, TIMING, DEFINITION, DEVICE_USE, STEP, ROLE,
  ACTIVITY, SEQUENCE, SEQUENCE_ITEM, BUTTON, CONTENT,
};

/**
 * Whether editing this field could ever change what a remote does.
 *
 * `carried` counts, deliberately: those bytes are reachable, and refusing them would refuse renaming an
 * activity, which is step 3 of the plan. What it does not promise is that a **longer** value fits.
 */
export function canReachARemote(verdict: Verdict): boolean {
  return verdict.writeback === 'rebuilt' || verdict.writeback === 'carried';
}

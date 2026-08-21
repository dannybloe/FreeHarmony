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
import type { DeviceCommand, DeviceDefinition, DeviceTiming, InfraredSignal } from './library.ts';
import type { Activity, ActivityRole, ButtonBinding, DeviceUse, RemoteContent, Step } from './content.ts';

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
  // Logitech's editor names all three and base slot 15 is where per device parameters live, but which
  // group holds which of these has never been read here. Guessing would produce a configuration the
  // firmware silently replaces with its own defaults, since a group whose length is wrong is discarded.
  betweenKeysMs: { writeback: 'unknown', structure: 'base slot 15, group unknown' },
  betweenDevicesMs: { writeback: 'unknown', structure: 'base slot 15, group unknown' },
  minimumRepeats: { writeback: 'unknown', structure: 'base slot 5 or base slot 15' },
};

export const DEFINITION: Verdicts<DeviceDefinition> = {
  id: { writeback: 'ours' },
  manufacturer: { writeback: 'ours' },
  model: { writeback: 'ours' },
  kind: { writeback: 'ours' },
  commands: { writeback: 'rebuilt', structure: 'base slot 5' },
  timing: { writeback: 'unknown', structure: 'base slot 15' },
  origin: { writeback: 'ours' },
  addedAt: { writeback: 'ours' },
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
  role: { writeback: 'ours' },
  // Ours as well, and not because the number has nowhere to live: a device position is stated all over
  // a configuration. It is the **pairing** that is ours, and half of an invented pair is still invented.
  device: { writeback: 'ours' },
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
  devices: { writeback: 'rebuilt', structure: "base slot 9, what the set's bindings send to" },
};

export const BUTTON: Verdicts<ButtonBinding> = {
  surface: { writeback: 'rebuilt', structure: 'base slot 6 for a screen key, base slot 9 for a keypad key' },
  scan: { writeback: 'rebuilt', structure: "a tagged list's key code" },
  label: { writeback: 'carried', structure: 'base slot 11, as for an activity name' },
  inActivity: { writeback: 'rebuilt', structure: "base slot 9's handler sets" },
  inDeviceMode: { writeback: 'rebuilt', structure: "base slot 6's mode table" },
  sends: { writeback: 'rebuilt', structure: 'base slot 10, an action list' },
};

export const CONTENT: Verdicts<RemoteContent> = {
  devices: { writeback: 'rebuilt', structure: 'base slot 5 and base slot 0' },
  activities: { writeback: 'rebuilt', structure: 'base slot 9 and base slot 10' },
  buttons: { writeback: 'rebuilt', structure: 'base slot 6, 9 and 10' },
  filledFrom: { writeback: 'ours' },
};

/** Every table, so a check can walk them without naming them one at a time. */
export const TABLES: Readonly<Record<string, Readonly<Record<string, Verdict>>>> = {
  SIGNAL, COMMAND, TIMING, DEFINITION, DEVICE_USE, STEP, ROLE, ACTIVITY, BUTTON, CONTENT,
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

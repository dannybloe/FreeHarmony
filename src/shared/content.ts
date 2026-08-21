/**
 * What a remote is set up to do: its devices, its activities and its buttons.
 *
 * The companion to `remote.ts`, and the split between them is deliberate. That one is the document's
 * **identity**, what a person called it and where its backups are. This one is its **contents**, which
 * is the thing an editor edits and the thing a configuration is compiled from.
 *
 * **A configuration is a compiled artefact**, so this is the source and the configuration is the
 * output. That is why several fields here are absent on anything imported from a remote: the compiler
 * threw the information away and no reading can recover it. Each of those says so where it sits, and
 * they are the argument for having a model at all rather than editing bytes.
 *
 * `docs/data-model.md` has the measured table of what can be written back. `writeback.ts` beside this
 * file is that table as code, per field, checked by the compiler.
 */

/**
 * One of the appliances this remote drives.
 *
 * **A use, not a definition.** What the appliance is lives in the library, once; this is the fact that
 * this remote drives it, plus what it is called here. The same television in the living room and in the
 * bedroom is one definition and two uses.
 */
export interface DeviceUse {
  /**
   * Which of the remote's device positions this is.
   *
   * The configuration's own numbering, because it is the only identity a device has in there and every
   * button binding refers to it. Ours would need a mapping that nothing could check.
   */
  readonly slot: number;
  /**
   * The definition in the library, where we know which one it is.
   *
   * **Absent after an import, which is the normal case rather than a failure.** A configuration says
   * that position 2 has 47 infrared codes and calls it "TV". It does not say it is a particular
   * television, and nothing in the file could. Matching it to a catalogue entry is a question for a
   * person or for the service.
   */
  readonly definition?: string;
  /** What it is called on this remote, which is the owner's word and not the manufacturer's. */
  readonly label?: string;
}

/**
 * What kind of thing an activity is.
 *
 * Logitech's own division, because it is a good one and because their editor's users learned it. It is
 * **not** in a configuration: the compiled form has the instructions an activity runs and says nothing
 * about what the activity was for, so this is absent on an import and chosen by a person.
 */
export type ActivityKind =
  | 'watch-tv'
  | 'watch-a-film'
  | 'listen-to-music'
  | 'play-a-game'
  | 'other';

/**
 * What one device does in one activity.
 *
 * The idea is Logitech's and it is the best thing in their model: an activity is not a macro, it is a
 * set of jobs with a device doing each one. That is what lets an application say "the sound comes from
 * the receiver" and change it in one place instead of editing five button bindings.
 *
 * **Not recoverable from a configuration.** The compiled form knows that a volume key sends a code to
 * device 3. That device 3 is the one doing the sound is exactly the kind of intent a compiler discards.
 */
export interface ActivityRole {
  readonly role: 'picture' | 'sound' | 'source' | 'channels' | 'playback';
  /** The device position, matching `DeviceUse.slot`. */
  readonly device: number;
}

/**
 * Send one command to one device.
 *
 * The unit everything that does something is made of: what happens when an activity starts, what a
 * button does, what a macro is. A macro is a list of these and **the order matters**, which is why
 * every list of them is ordered and never a set.
 */
export interface Step {
  /** The device position, matching `DeviceUse.slot`. */
  readonly device: number;
  /** The command's position in that device's definition. */
  readonly command: number;
}

/**
 * What an activity wants one appliance to be doing.
 *
 * **This is what an activity really is**, and saying it as a list of commands to send was the model's
 * one structural mistake. An activity does not say "send these six codes". It says the television is on
 * and showing input 3 and the amplifier is on. The remote compares that with what it believes is true
 * and sends only the difference, which is why switching activity does not turn things off and on again.
 *
 * It also means an activity is repeatable and safe: starting the same activity twice sends nothing the
 * second time.
 */
export interface DesiredState {
  /** The device position, matching `DeviceUse.slot`. */
  readonly device: number;
  /** The property's name as the appliance's definition spells it. */
  readonly property: string;
  readonly value: number;
}

/**
 * Something the remote can be switched into: watching television, listening to music.
 *
 * `onStart` and `onStop` are Logitech's own shape and the format's too, which is the rare case where
 * the two agree: their editor calls them enter and leave actions, and the configuration's key map for
 * an activity carries an enter handler and a leave handler. So this one survives a round trip.
 */
export interface Activity {
  /** The position the configuration knows it by, which every binding refers to. */
  readonly slot: number;
  /** Its name, which a configuration states by drawing it on a screen. */
  readonly name?: string;
  /** Absent on anything imported, per `ActivityKind`. */
  readonly kind?: ActivityKind;
  /** Empty on anything imported, per `ActivityRole`. */
  readonly roles: readonly ActivityRole[];
  /**
   * What it switches on and off, which is empty on an import for a **different reason** from the two
   * fields above, and the difference is worth keeping straight.
   *
   * `kind` and `roles` are gone because the compiler discarded them and no reading will ever bring them
   * back. These two are in the file, in the key map's own enter and leave handlers, and the library next
   * door has not yet established which of the three tags there is the leave one. So this is the only
   * absence in an imported document that better reverse engineering would fill.
   */
  readonly onStart: readonly Step[];
  readonly onStop: readonly Step[];
  /**
   * What it wants every appliance to be doing, which is the real content of an activity.
   *
   * Empty on an import today. The values are in the file, written by the activity's own enter handler,
   * and reading them waits on the same unresolved question as `onStart`: which of a key map's handlers
   * is the enter one. There is a candidate answer next door, that the enter handler is the one which
   * records the activity as running, and establishing it is work for the library rather than a guess
   * here.
   */
  readonly wants: readonly DesiredState[];
  /** The devices it drives, by position. Derivable from the roles once those exist, stated until then. */
  readonly devices: readonly number[];
}

/**
 * Where a button is, which is a fact about the remote and not about the binding.
 *
 * **The two are strictly separate in the format** and it is worth keeping that way: the keys the screen
 * speaks for and the keys on the keypad share no code at all on three of the four architectures, and
 * exactly one on the fourth. So a binding knows which surface it is on rather than inferring it.
 */
export type ButtonSurface = 'keypad' | 'screen';

/**
 * One button doing one thing, in one context.
 *
 * `sends` is a list because a button may send several codes in an order that matters, which the corpus
 * does 85 times. And a binding is **on the press**: nothing in any configuration here sends a code on
 * a release or on a repeat, so this model does not offer the choice.
 */
export interface ButtonBinding {
  readonly surface: ButtonSurface;
  /** The scan code, where the remote's own numbering is known. */
  readonly scan?: number;
  /** The word printed beside it or drawn on the screen for it. */
  readonly label?: string;
  /**
   * Which activity this binding applies in, or which device's own mode, by position.
   *
   * A button means different things in different activities, which is the whole point of an activity,
   * so a binding without a context would be a binding nobody can place.
   */
  readonly inActivity?: number;
  readonly inDeviceMode?: number;
  readonly sends: readonly Step[];
}

/**
 * Everything a remote is set up to do.
 *
 * **The screens are deliberately not here yet.** They can be read and drawn today, by the library, and
 * changing them is in no step of the plan. Modelling them now would be modelling a guess, and the one
 * thing already known about that job is that artwork we did not make is carried through untouched.
 */
export interface RemoteContent {
  readonly devices: readonly DeviceUse[];
  readonly activities: readonly Activity[];
  readonly buttons: readonly ButtonBinding[];
  /** Where this came from, so that "absent" can be read as "the compiler dropped it" or as "not set". */
  readonly filledFrom: 'a-configuration' | 'here';
}

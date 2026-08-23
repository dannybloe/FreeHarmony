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
 * What one appliance does in one activity, and what state it has to be in to do it.
 *
 * **The best idea in Logitech's model, and this is their shape.** Their own editor's records for the two
 * activities that produced our calibration configurations were read on 21 August 2026, and an activity
 * there is not a macro: it is a set of jobs with one appliance doing each one, and per job the input
 * that appliance has to be switched to and the position it takes in the power up order. Their own list
 * of actions to run on entering was **empty** on both, which is the strongest evidence that this is the
 * real content of an activity and the commands are what a compiler works out from it.
 *
 * **Not recoverable from a configuration.** The compiled form knows that a volume key sends a code to
 * appliance 3. That appliance 3 is the one doing the sound, and that it had to be switched to BD first,
 * is exactly what a compiler discards.
 */
export interface ActivityRole {
  readonly kind: RoleKind;
  /** The device position, matching `DeviceUse.slot`. */
  readonly device: number;
  /**
   * The input this appliance has to be on, by the name the appliance uses: "HDMI 1", "BD".
   *
   * A name and not a number, because that is what a person picks and what their television prints on
   * its own screen. The number it corresponds to is in the configuration, as the value of the
   * appliance's input property; the name is ours.
   */
  readonly input?: string;
  /**
   * Where this appliance comes in the order of switching on, and of switching off.
   *
   * **Needed, and it was missing from the first version of this model.** An amplifier that powers on
   * after the television has already been told which input to use has missed the instruction, so the
   * order is part of what an activity is rather than a detail of how it runs.
   */
  readonly powerOnOrder?: number;
  readonly powerOffOrder?: number;
  /** How long to wait before dealing with the next appliance, where an appliance needs it. */
  readonly delayAfterMs?: number;
}

/**
 * The job an appliance does in an activity.
 *
 * Four of these were seen in Logitech's own records, under their names: a display doing the picture, a
 * volume role doing the sound, a channel changing role, and a play movie role. `other` is here because
 * four observations are not a vocabulary, and a games console or a lighting controller will need
 * something; what is refused is inventing names nobody has seen.
 */
export type RoleKind = 'picture' | 'sound' | 'channels' | 'film' | 'other';

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
   * What every appliance has to be doing, appliance by appliance and property by property.
   *
   * **This and `roles` are the same thing at two levels, and which one is the source depends on where
   * the document came from.** A document somebody builds here has roles, and the wanted state follows
   * from them: an appliance in a role is on, and a role's input names the value its input property
   * takes. A document imported from a remote has no roles at all, because the compiler discarded them,
   * and then this is the only form the intent survives in. So roles are edited and this is computed,
   * except on an import, where there is nothing to compute it from.
   *
   * Empty on an import today for a further reason. The values are in the file, written by the
   * activity's own enter handler, and reading them waits on which of a key map's handlers is the enter
   * one. There is a candidate answer next door, that the enter handler is the one which records the
   * activity as running, and establishing it is work for the library rather than a guess here.
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
 *
 * **A sequence of several sends belongs to an activity**, said by Danny on 23 August 2026 after checking
 * Logitech's own software: it is a property of an activity, offered on a button or a screen button, and
 * there is no device level sequence. So a multi step `sends` should always have an activity context. It
 * is not enforced, because a device's own map is not read yet and refusing it would refuse something no
 * import can currently produce. `docs/data-model.md` carries the argument and the one gap it exposed,
 * that a screen key records its page and not its activity.
 */
export interface ButtonBinding {
  readonly surface: ButtonSurface;
  /** The scan code, where the remote's own numbering is known. */
  readonly scan?: number;
  /** The word printed beside it or drawn on the screen for it. */
  readonly label?: string;
  /**
   * Which activity this binding applies in, by the activity's own position.
   *
   * A button means different things in different activities, which is the whole point of an activity, so a
   * binding without a context would be a binding nobody can place. **Every keypad binding in the corpus
   * carries one**, 1122 of them across five configurations and three architectures.
   *
   * Absent is not impossible, though, and that is deliberate: a Harmony has a **device mode** where the
   * keypad drives one device with no activity running, and a map for that would land here with no activity.
   * None of these files carries one, measured in `test/import.test.ts`, and whether the hardware remaps its
   * keypad in device mode at all is unsettled.
   *
   * It held the configuration's own binding **set** number until 22 August 2026, which is a different
   * numbering space: on one Harmony One the activities are 0 to 6 and 8 while the sets holding their keys
   * are 7 to 15. Nothing failed, because a plausible number is what a wrong number looks like. The
   * correction and its control are in `test/import.test.ts`.
   */
  readonly inActivity?: number;
  /**
   * Which screen page this binding is on, by the configuration's own page index.
   *
   * **Not a device position, and this used to claim it was.** A screen key belongs to a page and a page
   * belongs to a device mode, but which device a page is for needs a reading that has not been made, so
   * the honest field is the page. Nothing reads it yet and nothing may treat it as a device until that
   * reading exists.
   */
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
  /**
   * Which language the remote speaks, as an IETF tag: `en`, `nl`.
   *
   * **Every word a remote shows is in its configuration**, in the language of whoever generated it, and
   * nothing in the file says which. It is inferred from Logitech's own menu and Help wording next door,
   * which answers on every configuration in the corpus and refuses on anything that is not one, so an
   * absent value here means genuinely unknown rather than not looked for.
   *
   * It matters for **writing** rather than for showing. A third to a half of a configuration's screen
   * pages are the Help walkthrough, whose wording is Logitech's template with the user's own device
   * names dropped in, so anything that has to build a page has to build it in the right language.
   * Nothing does yet, and the flag is here now because it cannot be recovered later from a document
   * somebody has already edited.
   */
  readonly language?: string;
  /** Where this came from, so that "absent" can be read as "the compiler dropped it" or as "not set". */
  readonly filledFrom: 'a-configuration' | 'here';
}

/**
 * What a document holds, as the window is told it.
 *
 * `missing` is the price of the device library sitting outside the document, answered rather than
 * discovered: a document names appliances and this machine may not have them. Empty is the ordinary
 * case, and an interface has something honest to say when it is not.
 */
export interface DocumentContents {
  readonly content: RemoteContent;
  readonly missing: readonly string[];
}

/**
 * What filing a document's appliances into the shared library did.
 *
 * Two lists rather than a count, because they mean different things: `added` is new descriptions this
 * machine now has, and `kept` is descriptions that were already there and were **not** overwritten,
 * since one may have been corrected by hand since it arrived.
 */
export interface FiledDefinitions {
  readonly added: readonly string[];
  readonly kept: readonly string[];
}

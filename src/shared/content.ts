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
 * One of the appliances this remote drives./**
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
  /**
   * How long to wait before dealing with the next appliance, where an appliance needs it.
   *
   * **Logitech's own field, and it is unset everywhere we can see.** Their records call it
   * `NextDevicePowerOnDelay` and it sits on the role exactly as it sits here, which settles that the
   * field belongs on a role rather than on the appliance. It is null on all 22 roles of the 7 activities
   * read on 23 August 2026, and that is the reason it stays unmeasured against a compiled file: there is
   * no value anywhere in the corpus for a pause in a list to be matched against. One activity with a
   * delay nobody else has would settle it in a single compile.
   */
  readonly delayAfterMs?: number;
}

/**
 * The job an appliance does in an activity.
 *
 * **Logitech's own vocabulary, and it is complete now rather than sampled.** The first version had four
 * names taken from the two activities that produced our calibration configurations, and said out loud
 * that four observations are not a vocabulary and that a games console would need something. Reading
 * the whole of an account's activity records on 23 August 2026 produced exactly that: 22 roles across 7
 * activities carry six distinct names, `DisplayActivityRole`, `VolumeActivityRole`,
 * `ChannelChangingActivityRole`, `PlayMovieActivityRole`, `PlayGameActivityRole` and
 * `PlayMediaActivityRole`. So the guess was right about the four and wrong to stop there, and a games
 * console was landing on `other` in a model that had a name for it.
 *
 * `media` is the one worth telling apart from `film`: a streaming box and a disc player are both playing
 * something, and Logitech separates them, which is why an activity can have both.
 *
 * `other` stays, and it is now a hedge against a seventh name rather than against the four being wrong.
 * Nothing in the corpus uses it, which is the honest state for an escape hatch.
 */
export type RoleKind = 'picture' | 'sound' | 'channels' | 'film' | 'game' | 'media' | 'other';

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
 * Whether an item of a sequence sends something or waits.
 *
 * Two arms and not one, which a measurement decided rather than taste. The convenient shape is "a send
 * with an optional wait after it", which has no invariant to police, and it is refuted by Logitech's own
 * data: of the 31 items in the two sequences read on 23 August 2026, one pair of waits is adjacent and
 * one sequence **ends** with a wait. So a wait is an item in its own right, and a sequence may hold a
 * wait that does nothing, because their editor lets somebody author one.
 */
export type SequenceItemKind = 'send' | 'wait';

/**
 * One step of a sequence: a command going out, or time passing.
 *
 * `step` is present exactly when `does` is `send`, and `waitMs` exactly when it is `wait`. The pair of
 * optionals is the price of a shape the diagram can draw, and the invariant is asserted in
 * `test/model.test.ts` rather than left as a sentence.
 *
 * **The unit here is milliseconds and the two ends of it disagree**, which a writer has to know. Logitech's
 * editor offers whole seconds and their records store seconds; the compiled file stores **tenths** of a
 * second, exact on five authored values from one second to twenty. So the file is ten times finer than
 * their editor ever let anybody ask for, this model holds the finer unit, and anything not a multiple of
 * 100 ms cannot be written.
 */
export interface SequenceItem {
  readonly does: SequenceItemKind;
  /** The command to send, on an item that sends. */
  readonly step?: Step;
  /** How long to wait, on an item that waits. A multiple of 100 ms, per the note above. */
  readonly waitMs?: number;
}

/**
 * Whether a sequence item is one of the two things an item is allowed to be.
 *
 * The rule `SequenceItem` states and no type here can: `step` is present exactly when the item sends,
 * and `waitMs` exactly when it waits. It is a function rather than a sentence in a docstring because the
 * shape that would make the rule unnecessary, a union of two interfaces, can be neither tabulated in
 * `writeback.ts` nor drawn by the generated diagram. So the shape that keeps those two working owes a
 * check, and this is it.
 */
export function sequenceItemIsWellFormed(item: SequenceItem): boolean {
  return item.does === 'send'
    ? item.step !== undefined && item.waitMs === undefined
    : item.waitMs !== undefined && item.step === undefined;
}

/**
 * A named run of commands and pauses, belonging to one activity.
 *
 * **An activity owns its sequences** and no appliance has any, which Danny established in Logitech's own
 * software on 23 August 2026 and which their data agrees with: a sequence hangs off the button map of an
 * **activity**, never off the map of a device. So there is no device level sequence to model and none to
 * import.
 *
 * `id` is ours, like a description's, and for the same reason: a binding refers to a sequence, the name is
 * the thing a person edits, and a reference by name would break the first time somebody renamed one. It is
 * not the configuration's numbering, because a configuration has none to offer.
 *
 * **An import can never produce one**, and that is guaranteed by the format rather than pending on a
 * reading. The compiler expands a sequence into one action list **per binding** and the copies differ:
 * the same sequence bound to a screen button and to two keys came out as four lists, one opening with a
 * beep the others do not have and one carrying an extra send at the front. So "these two lists are equal,
 * therefore one sequence" would fail even before the missing name. This is the same asymmetry as
 * `Activity.roles` against `Activity.wants`, measured this time rather than argued.
 *
 * **Two limits a writer has to respect, and they are not the same number.** Logitech's editor stops at 25
 * items, counting waits: the longest sequence in the corpus is exactly 25 with 21 sends and 4 waits. And
 * that sequence **hangs a Harmony One for good** when its touch panel is tapped heavily while it runs,
 * three times out of three, so their own stated maximum is not a safe bound and a writer should refuse an
 * oversized sequence rather than warn about it. The bound to use is the expanded instruction count, not the
 * item count.
 */
export interface Sequence {
  readonly id: string;
  readonly name: string;
  readonly items: readonly SequenceItem[];
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
 * Which of the remote's screens an activity opens on.
 *
 * Logitech's own `StartScreen`, spelled in this model's words. All 7 activities of the account read on 23
 * August 2026 state one, and three distinct values appear: their `Commands` four times, `Numpad` twice and
 * `Gesturepad` once. So it is a real per activity setting rather than a default nobody touches.
 *
 * `gesture-pad` is kept even though only a touch panel has one, because the value is stated per activity
 * and not per model, so a document carried to another remote should not lose it silently.
 */
export type ActivityStartScreen = 'commands' | 'number-pad' | 'gesture-pad';

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
  /**
   * The sequences this activity defines, which its own keys and screen buttons may run.
   *
   * Empty on an import, per `Sequence`, and that is a guarantee rather than a gap.
   *
   * An ordered list, like the devices and the activities, and for the same reason: the order is the one a
   * person arranged them in, and nothing may index it by position. A binding names a sequence by its `id`.
   */
  readonly sequences: readonly Sequence[];
  /**
   * Which screen it opens on, where somebody has chosen.
   *
   * Absent on an import: a configuration has the mode an activity enters and this application cannot yet
   * say which of Logitech's three named screens that mode is, so filling it in would be a guess about the
   * one field whose value is visible the moment the activity starts.
   */
  readonly opensOn?: ActivityStartScreen;
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
 * **This is what a button does, and it is not a sequence**, which took a correction to get right. A
 * sequence in Logitech's sense is defined by an **activity**, carries a name the user types, may be put
 * on a key or a screen button of that activity, and can be used in no other activity. Danny established
 * that on 23 August 2026. Two things follow that this field cannot express: the name, and two buttons of
 * one activity running the **same** sequence rather than two equal lists of codes. So the authored form
 * is a list on the activity that bindings refer to, and it also has to hold **waits**, since a sequence
 * has pauses in it.
 *
 * This field stays as it is, because it is what an **import** can produce: a configuration holds the
 * expanded sends on the binding, with no name and no way to tell sharing from coincidence. That is the
 * same split as `Activity.roles` against `Activity.wants`. `docs/data-model.md` carries the shape and
 * the two constraints this model still permits the breach of.
 *
 * **A button does one of two things here and one of three in Logitech's model**, and the missing one is
 * deliberate. Their records split a button's action three ways, 651 of 654 sending a command and 3 tuning
 * to a **favourite channel**, with sequences held on the activity beside them. This model has no favourite
 * at all, decided on 23 August 2026: a sequence expresses one exactly, since tuning to channel 100 is
 * sending that appliance's one, zero and zero, which is what Danny's own sequence does. A second shape for
 * one behaviour is a second shape to keep right, and the person building this has never used the feature.
 * `docs/data-model.md` carries what a sequence cannot do and why none of it changed the answer.
 *
 * So exactly one of `sends` and `runsSequence` says what a button does, `sends` may be empty on an authored
 * binding where it could not be before, and an import can only ever produce the first.
 */
export interface ButtonBinding {
  readonly surface: ButtonSurface;
  /** The scan code, where the remote's own numbering is known. */
  readonly scan?: number;
  /**
   * Which key it is, by name: `VolumeUp`, `Menu`, `Number1`.
   *
   * **The identity a keypad key has everywhere except in the file**, and the reason to carry both. A scan
   * code is a position in one model's wiring, so the same document on another remote would point every
   * binding at the wrong key; a name is the same key on every remote that has one. Logitech worked this
   * way throughout: all 336 keypad buttons in their own records for three of our models carry a
   * `ButtonKey` and none carries a scan code, and the sibling repository's reading of the firmware says
   * why, since a host named a button and the firmware resolved the name to hardware.
   *
   * **Their spelling, deliberately.** It is the one vocabulary that already covers every model, it is what
   * a fetched button map speaks, and inventing our own would mean a translation table nobody could check.
   *
   * Absent after an import, because the configuration states the scan code and the name is what the
   * compiler resolved it from. The two are joined by a per model table which is measured for 32 keys of a
   * Harmony One and 36 of a Harmony 600 and for nothing else, `reference/button-maps.md` next door, so
   * filling this in from a scan code is possible for some keys of some models and is not attempted here.
   */
  readonly key?: string;
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
  /**
   * What the button does when it is **held**, where the model offers that as a separate action.
   *
   * Not a repeat. Two different things get called "holding a key" and they are separate mechanisms.
   * Whether a code **repeats** while the key is down is a property of the **code**, in the library
   * next door: an infrared record carries a block that is sent once and a block that is sent for as
   * long as the key is held, and the interval the user feels is that block's own length. That belongs
   * to `DeviceDefinition`, not here, and it is why the volume key repeats and the power key does not.
   * A long press is a property of the **button**: a second, different action, chosen by how long you
   * hold it. A button with one cannot repeat, because the firmware has to wait to find out which of
   * the two you meant.
   *
   * **No model FreeHarmony can read today has it**, which is why this is always absent after an
   * import and `test/import.test.ts` asserts that. Which models do is a per model capability and
   * lives next door, in `reference/capabilities.md` and as `hasLongPress` in `@harmony/usb`: the
   * feature arrives with the Touch generation and every skin that declares it is outside the table
   * of models this application can reach. That list used to be written out here, which made it a
   * fact with no test in the repository that owns the capability table; it moved on 24 August 2026.
   *
   * The field is here anyway because it costs one line now and a migration later, and because the
   * two models most likely to be supported next, the 350 and the Touch, both have it.
   *
   * A **double** press exists too, as a third field on Logitech's own button record, and it is
   * deliberately not modelled, and that is a measurement now rather than an impression: of the 654
   * buttons in Logitech's own records for three of our models, **none** carries a double press action and
   * none carries a long press one either, and no product record for those models advertises either
   * feature. So a field for it would be a guess. `docs/data-model.md` carries the argument.
   */
  readonly sendsOnLongPress?: readonly Step[];
  /**
   * Which appliance's own set of screen buttons this one sits in.
   *
   * **What a screen page in device mode is for, stated rather than inferred**, and it is the authored half
   * of the question `inDeviceMode` leaves open. Every one of the 318 screen buttons in Logitech's records
   * sits in a named menu, and 314 of them are named `Device.<id>`: so their model puts a screen button on
   * an appliance, and ours can too.
   *
   * Absent on an import, and that is the whole asymmetry: `inDeviceMode` is the page number the file
   * states, this is the appliance an author chose, and no reading joins the two yet. Nothing may derive
   * one from the other until it does.
   *
   * **Not the appliance a screen pad tunes**, which this docstring claimed for an hour while the model had
   * favourites in it. Logitech's favourites sit in a menu named after no appliance, so there was nothing
   * here for one to take its tuner from, and the appliance is on their tuning action itself. Recorded
   * because the field survived and the wrong reading of it nearly did too.
   */
  readonly forDevice?: number;
  /**
   * The sequence this button runs, by its `id`, instead of sending a list of its own.
   *
   * A reference and not a copy, so that two buttons of one activity can run the same sequence: renaming it
   * changes both, and the model can tell that from two buttons that happen to send equal lists. Which is
   * exactly what a configuration cannot do, per `Sequence`.
   *
   * The sequence has to be one of the sequences of the activity in `inActivity`, and a screen button
   * cannot satisfy that yet: it records its page and not its activity. Recorded as open in
   * `docs/data-model.md` rather than resolved by giving the screen row an activity nobody has measured.
   *
   * **Their own linkage has a name and no instance we have seen.** Their client carries a
   * `ButtonSequenceAction` beside the command and delay actions, recorded in `docs/host-client.md` next
   * door, so a button referring to a sequence is how they did it too. What is missing is data: the one
   * activity map we hold has both of its sequences and not one button pointing at either, although both
   * were bound to keys on the remote at the moment it was read. So the shape is confirmed from their
   * vocabulary and the join is unmeasured, which changes nothing here, since a reference is what the two
   * constraints in `Sequence` demand whatever they called theirs.
   */
  readonly runsSequence?: string;
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

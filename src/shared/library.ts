/**
 * The device library: what an appliance **is**, described once and referred to from every document.
 *
 * Decided on 21 August 2026, and the reason is that the same television belongs to three remotes and
 * should be described once. It is also the unit a shared collection would exchange and the unit
 * provenance is recorded on, so it is the same object seen from either side. `docs/data-model.md`
 * carries what follows from that, including the two things it costs: a document is no longer self
 * contained, and a definition can improve underneath one.
 *
 * **This is ours and it is not a reading of the format.** A definition holds what a person and a
 * catalogue know about an appliance, which is more than a configuration can hold: a configuration
 * keeps only the commands something is bound to, and it keeps one chosen encoding of a signal rather
 * than the measurement it was chosen from. Both of those are here, which is the whole reason the model
 * comes before the compiler.
 *
 * Nothing in this file imports `@harmony/codec`, by the same rule as `remote.ts`: a second reading of
 * the format on this side is the one thing that must not happen. What crosses from the library next
 * door is values, in `src/main/import.ts`.
 */
import type { Exhaustive } from './exhaustive.ts';

/**
 * Where a definition came from, which decides what may be done with it.
 *
 * **The one field that had to be decided before anything else existed**, because it cannot be
 * established in hindsight: add it later and there is a collection whose origins nobody kept, where the
 * only safe action is to throw it away.
 */
export type DefinitionOrigin =
  /** Taught to this application by pointing a real remote at a receiver. The only shareable kind. */
  | 'learned-here'
  /** Fetched from Logitech's device database while that service is still answering. */
  | 'from-logitech'
  /**
   * Read out of a configuration that was already on a remote.
   *
   * Not shareable either, and the reason is worth stating because it looks like it should be: the
   * codes in a compiled configuration were put there by Logitech's own compiler out of Logitech's own
   * database. Coming off your own hardware does not change where they were authored.
   */
  | 'from-a-configuration'
  /**
   * Typed in here by a person, with no codes behind it or codes they added themselves.
   *
   * **A fourth value rather than reusing `learned-here`**, which is the tempting shortcut and would be a
   * lie in the one field this model says cannot be repaired in hindsight. Nothing was learned: somebody
   * wrote down that they have a television, which is a useful thing to record and not evidence about
   * anything. So `mayBeShared` is false for it, and it stays false even once it has codes in it, because
   * where those codes came from is then a question nobody kept the answer to.
   */
  | 'typed-here';

/**
 * Whether a definition may ever leave this machine.
 *
 * One function rather than a comparison written out at each call site, because it is a rule and rules
 * that exist as a comparison get written differently the second time.
 */
export function mayBeShared(origin: DefinitionOrigin): boolean {
  return origin === 'learned-here';
}

/** Every origin, so a screen or a test can walk them rather than keeping a list of its own. */
export const ORIGINS =
  ['learned-here', 'from-logitech', 'from-a-configuration', 'typed-here'] as const;

/**
 * One mark or one space, in microseconds.
 *
 * **Mark and space are stated rather than implied, and that was measured rather than assumed.** The
 * obvious model is a list of durations that alternate, starting with a mark, which is how raw infrared
 * is written nearly everywhere. It is wrong here: of 1729 duration blocks in four configurations, 599
 * begin with a **space** and only 154 strictly alternate at all. Two ordinary reasons. A code that
 * repeats begins with the gap before it, and a single duration caps at 32767 microseconds, so a long
 * pause is several consecutive spaces. An implied alternation would have silently mangled 91% of the
 * codes in the corpus.
 */
export interface Pulse {
  readonly mark: boolean;
  readonly us: number;
}

/**
 * What a command sends, in the two forms one signal has.
 *
 * **Symbolic and measured are two views of the same thing, not two kinds of command.** Logitech's
 * database serves the symbolic form, a protocol family and a frame value, and never the pulses; a
 * configuration holds the pulses and never the protocol. And the two are connected: the library next
 * door decodes a record's durations back into the frame a device sees, which is how a code read off a
 * remote can be compared with a number stated somewhere else entirely.
 *
 * So a definition may hold either, both, or one of them today and both tomorrow, and code that needs
 * one has to say which and cope with its absence.
 */
export interface InfraredSignal {
  /** The protocol family, in whatever vocabulary the source used. Absent on a code read from pulses. */
  readonly protocol?: string;
  /** How many bits the frame carries, and the frame itself as a hexadecimal string. */
  readonly bits?: number;
  readonly frame?: string;
  /**
   * The carrier, in hertz.
   *
   * Stored as a frequency because that is what a person and a datasheet talk about. The configuration
   * stores a **truncated** period in nanoseconds, so converting is the library's job and not a
   * multiplication written here: a writer that rounds where Logitech's generator truncates differs
   * from it by one byte per device.
   */
  readonly carrierHz?: number;
  /**
   * The durations, in microseconds, as the three things a remote actually sends.
   *
   * `once` goes out on the press, `held` repeats for as long as the key is down, and `tail` closes the
   * transmission. That is the format's own division and it is not an implementation detail: the
   * interval a user feels when they hold a button is the `held` block's own length, so a repeat rate is
   * a property of one command and not of a device.
   */
  readonly once?: readonly Pulse[];
  readonly held?: readonly Pulse[];
  readonly tail?: readonly Pulse[];
}

/**
 * One command an appliance understands.
 *
 * **The name is optional and that is the honest part.** Logitech's database gives every command a name
 * and a function group. A configuration gives neither: an infrared record is a stream of durations and
 * a position in its device's list, and nothing in the file says which button it belongs to. So a
 * definition imported from a remote is a list of nameless codes at known positions, and naming them is
 * work a person does, or work a catalogue does for them.
 */
export interface DeviceCommand {
  /** Its position in the definition's own list, which is what a document refers to. */
  readonly slot: number;
  readonly name?: string;
  /** Logitech's own grouping, where a source stated one. Kept because it orders a long list usefully. */
  readonly group?: string;
  readonly signal: InfraredSignal;
  readonly origin: DefinitionOrigin;
}

/**
 * One step in an appliance's own state machine.
 *
 * **This is the piece that makes a Harmony feel clever**, and the model was missing it for a day. The
 * remote does not send a fixed list of commands when you switch activity. It keeps track of what state
 * it believes every appliance is in, works out the difference between that and what the new activity
 * wants, and sends only what is needed. Which is why it leaves the television alone when it is already
 * on, and why it gets it wrong if you switched the television off with its own remote.
 *
 * A transition is one entry in the table that makes that possible: to go from this value to that one,
 * send these commands. It belongs to the appliance rather than to a remote or an activity, because it
 * is a fact about the appliance: a television with one power button needs a toggle, a television with
 * separate on and off buttons does not.
 */
export interface StateTransition {
  /**
   * The value moved away from, and the value moved to.
   *
   * A negative number is a sentinel the library next door has read and not yet explained; two of them
   * occur. It is kept as it is rather than turned into a word here, because inventing a meaning for it
   * is exactly the kind of guess this model refuses.
   */
  readonly from: number;
  readonly to: number;
  /** Which of this appliance's own commands the remote sends to make the move, in order. */
  readonly sends: readonly number[];
}

/**
 * Something about an appliance that can be in more than one state: whether it is on, which input it is
 * showing.
 *
 * The name is the appliance's own word for it as the configuration spells it, and `values` is how many
 * states it has, so a power switch has two and an input selector has as many as it has inputs.
 */
export interface DeviceProperty {
  readonly name: string;
  readonly values: number;
  readonly transitions: readonly StateTransition[];
}

/**
 * How fast an appliance can be talked to.
 *
 * Logitech's editor names all three and a person can feel all three: too little between two key
 * presses and a television misses one, too little between two devices and a receiver is still waking
 * up. The values live on the appliance because that is what they are a property of.
 */
export interface DeviceTiming {
  readonly betweenKeysMs?: number;
  readonly betweenDevicesMs?: number;
  /** How many times a press has to be repeated before the appliance believes it. */
  readonly minimumRepeats?: number;
}

/** What kind of appliance it is, in plain words rather than in a vendor's enumeration. */
export type DeviceKind =
  | 'television'
  | 'receiver'
  | 'player'
  | 'recorder'
  | 'set-top-box'
  | 'game-console'
  | 'computer'
  | 'lighting'
  | 'other';

/**
 * An appliance, defined once.
 *
 * `id` is ours and stable, because everything else about a definition can be corrected: a manufacturer
 * spelled two ways is one appliance, and a document that referred to it by name would lose it the day
 * somebody fixed the spelling.
 */
export interface DeviceDefinition {
  readonly id: string;
  /**
   * What its owner calls it, which is not the same as what it is.
   *
   * **This is what makes copying one worth doing.** Two descriptions of the same television, one with the
   * volume going through an amplifier, are the same manufacturer and the same model and want telling
   * apart; without a name the two are one row twice over in every list. Added on 22 August 2026 for that
   * reason.
   *
   * Optional, and the fallback is `describeDefinition` rather than a stored default: a name computed from
   * the manufacturer and the model and then saved would stop following them the moment one was corrected.
   *
   * It is **not** the name on a remote. That is `DeviceUse.label`, it belongs to the use, and four
   * identical televisions on four remotes are one description under four labels. This is the description's
   * own name and every remote sees the same one.
   */
  readonly name?: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly kind: DeviceKind;
  readonly commands: readonly DeviceCommand[];
  /** What can be in more than one state about it, and how to change each one. */
  readonly properties: readonly DeviceProperty[];
  readonly timing: DeviceTiming;
  readonly origin: DefinitionOrigin;
  /** ISO 8601, so ordering never depends on a file system timestamp. */
  readonly addedAt: string;
  /**
   * The model of the remote this description was first read off, where that is how it came about.
   *
   * **The model and not the document's name.** A document gets renamed and thrown away, and a definition
   * that named one would carry a reference to a folder nobody has any more. "Harmony 600" stays true
   * wherever it ends up, which is what a provenance field has to do.
   *
   * **The first import and never a later one.** A definition is shared, so the same television can be
   * read off two remotes, and this says how the description came into being rather than where it is now.
   * Where it is now is what a document's own list answers. Stamping it again on a second import would
   * make the field mean two different things depending on which remote was read last.
   *
   * Absent on everything that did not come off a remote, and absent on the descriptions imported before
   * 22 August 2026, which is why the sentence that reads it has an arm for not knowing.
   */
  readonly addedFrom?: string;
}

/**
 * What a set of commands sends, as one string, so two appliances can be compared without knowing what
 * either of them is.
 *
 * **The pulses and not the names**, which is the whole idea: a name is what somebody typed and the
 * pulses are what the appliance hears, so two descriptions of one television agree here even when one is
 * called `TV` and the other `Woonkamer`. The carrier is in it because two appliances can share a frame
 * value and differ in carrier, and the order is fixed by sorting rather than by whatever order the
 * commands happen to sit in.
 *
 * Empty for an appliance with no commands, and callers have to treat that as an **absence** rather than
 * as a match: every appliance nobody has taught anything to agrees with every other one.
 *
 * It is in the shared model rather than beside the store because two things need it and this project's
 * oldest rule is about exactly that. It decides which appliances the library reports as probably one,
 * and it decides what a definition imported from a configuration is **called**, so that reading the
 * same remote twice does not describe its television twice.
 */
export function fingerprintOf(commands: readonly DeviceCommand[]): string {
  return commands
    .map((command) => signatureOf(command.signal))
    .filter((one) => one !== '')
    .sort()
    .join('|');
}

/** One signal, as a string. Separate only because the empty case has to be recognisable. */
export function signatureOf(signal: InfraredSignal): string {
  const blocks = [signal.once, signal.held, signal.tail]
    .map((block) => (block ?? []).map((pulse) => `${pulse.mark ? '+' : '-'}${pulse.us}`).join(','))
    .join(';');
  return blocks === ';;' ? '' : `${signal.carrierHz ?? 0}:${blocks}`;
}

/**
 * What to call an appliance, or `undefined` because nothing here has said.
 *
 * **In the shared model rather than beside either caller**, because two things need it and this project's
 * oldest rule is about exactly that: the import summary says what the library already calls a recognised
 * appliance, and a device tile says the same thing on a page. Two copies of the answer would be two
 * answers the day somebody adds a field to it.
 *
 * `undefined` is the ordinary case and not a gap. An appliance that only ever came out of a configuration
 * has no manufacturer and no model, because a configuration states neither, so a screen has to have
 * something honest to put there rather than a placeholder that reads like a name.
 */
export function describeDefinition(definition: DeviceDefinition): string | undefined {
  if (definition.name !== undefined && definition.name !== '') return definition.name;
  const words = [definition.manufacturer, definition.model]
    .filter((one) => one !== undefined && one !== '');
  return words.length === 0 ? undefined : words.join(' ');
}

/**
 * What a person can say about an appliance before anything has been taught to it.
 *
 * Deliberately four fields and no commands. **An appliance does not have to be complete to be worth
 * recording**: "the amplifier in the study" is a true and useful thing to write down on the day you
 * discover the application cannot read its codes yet, and refusing it until it has codes would make the
 * library unusable for exactly the case it was asked for.
 */
export interface DeviceDraft {
  readonly kind: DeviceKind;
  readonly name?: string | undefined;
  readonly manufacturer?: string | undefined;
  readonly model?: string | undefined;
}

/**
 * Where a description came from, in words, for the screen that has to say so.
 *
 * Here rather than in a view because two views say it: a device position on a remote and the appliance's
 * own page. It **was** in one of them and moved on 22 August 2026 when the second arrived, which is this
 * project's oldest rule applied to a sentence rather than to an opcode table. A second copy would drift
 * the day one of them was reworded, and nothing would fail.
 */
export const ORIGIN_NAMES: Readonly<Record<DefinitionOrigin, string>> = {
  'learned-here': 'Learned here',
  'from-logitech': 'Downloaded from Logitech',
  'from-a-configuration': 'Imported from a remote',
  'typed-here': 'Added by hand',
};

/**
 * Where a description came from, in one short line for a screen to put under a name.
 *
 * Short rather than the sentence these used to be. They read "read out of a configuration that was
 * already on a remote", which is accurate, was written for a definition list, and is four times too long
 * for the place it is actually wanted: under the name of a device that has not got one.
 *
 * The model is folded in where it is known, which is the whole reason `addedFrom` exists: "Imported from
 * a Harmony 600" tells somebody which of their remotes to go and look at, where "imported from a remote"
 * tells them nothing they could act on.
 */
export function provenanceOf(definition: DeviceDefinition): string {
  if (definition.origin === 'from-a-configuration' && definition.addedFrom !== undefined) {
    return `Imported from a ${definition.addedFrom}`;
  }
  return ORIGIN_NAMES[definition.origin];
}

/**
 * What to put at the top of a device's own page, as a title and an optional line under it.
 *
 * Three arms, and the order is how much anybody knows. A typed name goes on top with the make and model
 * underneath, because the name is what its owner recognises and the make and model are what identifies
 * the thing. With no name the make and model take the title, since together they are a name. With
 * neither, which is every device an import produces, the title says what it is **and** that it wants a
 * name, and the line underneath says where it came from so somebody can go and look.
 *
 * "Unnamed television" rather than "Television": a bare category reads as a name, and then four
 * televisions all have the same one.
 */
export function headingFor(definition: DeviceDefinition): { title: string; under?: string } {
  const named = definition.name !== undefined && definition.name !== '';
  const made = [definition.manufacturer, definition.model]
    .filter((one) => one !== undefined && one !== '').join(' ');
  if (named) return made === '' ? { title: definition.name! } : { title: definition.name!, under: made };
  if (made !== '') return { title: made, under: provenanceOf(definition) };
  return { title: `Unnamed ${KIND_NAMES[definition.kind].toLowerCase()}`,
           under: provenanceOf(definition) };
}

/**
 * Every kind, in the order a chooser should offer them: the common ones first, `other` last.
 *
 * A list as well as the type, because a form has to offer them in an order and a `Record`'s key order is
 * not something to rely on. `KINDS_ARE_EXHAUSTIVE` below is what stops the two disagreeing.
 */
export const KINDS = [
  'television', 'receiver', 'set-top-box', 'player', 'recorder',
  'game-console', 'computer', 'lighting', 'other',
] as const;

/**
 * Fails the typecheck if `KINDS` and `DeviceKind` stop naming the same things, in either direction.
 *
 * The direction that matters is the one no test would catch: add a kind to the type, forget this list, and
 * the application compiles with a category nobody can ever choose. A tile would draw for it, because the
 * drawings are a `Record` the compiler already checks, and the form simply would not offer it.
 */
export const KINDS_ARE_EXHAUSTIVE: Exhaustive<(typeof KINDS)[number], DeviceKind> = true;

/** The same for the origins, and for the same reason. */
export const ORIGINS_ARE_EXHAUSTIVE: Exhaustive<(typeof ORIGINS)[number], DefinitionOrigin> = true;

/**
 * A kind in words, for a screen and for a label.
 *
 * Written out rather than derived from the identifier, because two of them read badly under any rule that
 * only replaces dashes: `set-top-box` wants "Set-top box" and not "Set top box", and `television` is
 * usually "TV" on a screen and should not be in a sentence as one.
 */
export const KIND_NAMES: Readonly<Record<DeviceKind, string>> = {
  television: 'Television',
  receiver: 'Amplifier or receiver',
  'set-top-box': 'Set-top box',
  player: 'Player',
  recorder: 'Recorder',
  'game-console': 'Games console',
  computer: 'Computer',
  lighting: 'Lighting',
  other: 'Something else',
};

/**
 * One appliance being used on one remote, under the name that remote gives it.
 *
 * **What makes a shared library navigable before anything in it has a name.** A description that only ever
 * came out of a configuration has no manufacturer and no model, because a configuration states neither, so
 * a list of them reads as "81 commands" four times over and nothing in it can be told apart. The documents
 * know, though: each one calls its appliances something, and those are the words their owner typed.
 *
 * So this is derived and never stored. The label belongs to the use and the description belongs to the
 * appliance; putting a name on the description would be inventing one from whichever remote happened to be
 * imported first.
 */
export interface DeviceUsage {
  readonly definition: string;
  /** The document using it. */
  readonly remote: string;
  readonly label?: string;
}

/**
 * The names one appliance is known by, in the order they were found, without repeats.
 *
 * Four identical televisions on four remotes are one description under four names, which is the whole
 * point of the split, so this is a list rather than a single answer.
 */
export function namesUsedFor(
  usage: readonly DeviceUsage[], definition: string,
): readonly string[] {
  const found: string[] = [];
  for (const one of usage) {
    if (one.definition !== definition || one.label === undefined) continue;
    if (!found.includes(one.label)) found.push(one.label);
  }
  return found;
}

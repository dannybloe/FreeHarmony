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
  | 'from-a-configuration';

/**
 * Whether a definition may ever leave this machine.
 *
 * One function rather than a comparison written out at each call site, because it is a rule and rules
 * that exist as a comparison get written differently the second time.
 */
export function mayBeShared(origin: DefinitionOrigin): boolean {
  return origin === 'learned-here';
}

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
}

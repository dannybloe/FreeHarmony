/**
 * Everything the window may ask the main process to do, as one interface used by both sides.
 *
 * This file is the contract, and it is shared source rather than two declarations that agree today.
 * The main process implements it, the preload script exposes it, and the window consumes it, so a
 * method whose arguments change breaks the typecheck on every side at once. That is the whole point
 * of the seam: the alternative is a string channel name in two files and a runtime surprise.
 *
 * Everything crossing here is plain data. Structured cloning is what the channel does, so an object
 * with methods, a class instance or a parsed container cannot pass, and that constraint is a feature:
 * the configuration bytes stay in the main process because they cannot casually leave it.
 */
import type { DocumentContents, FiledDefinitions, RemoteContent } from './content.ts';
import type { AttachedSummary, ImportOutcome } from './import.ts';
import type { AttachedRemote, HardwareReading } from './devices.ts';
import type { DeviceDefinition, DeviceDraft, DeviceUsage } from './library.ts';
import type { RemoteDocument, RemoteModel } from './remote.ts';

/** The name the API is published under on `window`. One constant, so no side spells it by hand. */
export const API_NAMESPACE = 'freeharmony';

/**
 * A remote is addressed by its name, because its name is its folder and therefore its identity.
 * There is no separate identifier to pass, which is the whole reason the store is arranged that way.
 */
export interface RemotesApi {
  /** Every remote this machine holds, most recently changed first. */
  list(): Promise<RemoteDocument[]>;
  /**
   * A new document with nothing behind it. It cannot be written to a device, see `isWritable`.
   *
   * The model is optional because it genuinely is: it is known when somebody picked one from the list
   * or when a remote reported it, and unknown otherwise, and an unknown model is drawn as a name.
   */
  create(name: string, model?: RemoteModel, hardware?: HardwareReading): Promise<RemoteDocument>;
  /** Moves the folder. Refused if the new name is unusable or already taken. */
  rename(name: string, to: string): Promise<RemoteDocument>;
  /** A complete copy under the first free name, base configuration included. */
  duplicate(name: string): Promise<RemoteDocument>;
  /** Removes the entry and everything under it, including its backups. */
  remove(name: string): Promise<void>;

  /**
   * Read an attached remote and say what is on it. **Writes nothing at all.**
   *
   * **The second method on this API that claims hardware and by far the heavier one**: it holds an
   * irreplaceable device for the length of a transfer of up to 1.6 MB. Reads only, one device, closed
   * afterwards, and never on a timer. It either returns a summary of a configuration that passed both of
   * the read's own checks or it throws.
   *
   * The product id names a model rather than a unit, so it refuses when two of one model are attached.
   * Whether the remote's configuration may go into `into` is settled **before the device is opened**, so
   * an incompatible remote is never claimed.
   *
   * `into` is the document this is destined for, absent on the route from the chooser where there is not
   * one yet. With it the summary also says what an import would replace, in numbers.
   *
   * **The bytes do not come back.** They stay in the main process, against the token in the summary,
   * until `importFrom` commits them or something else is read. Walk away and they are gone, which costs a
   * repeated read and nothing else.
   */
  inspectAttached(productId: number, into?: string): Promise<AttachedSummary>;

  /**
   * Commit a reading into a document, **replacing everything it holds**.
   *
   * The other half of `inspectAttached`, and the only half that writes. It is expected to be called
   * after somebody has been shown `AttachedSummary.replacing`, which is why this method does not ask
   * again: a confirmation that the interface can skip is not a confirmation.
   *
   * The document adopts the model the remote reported, every appliance goes into the shared library
   * without overwriting anything already there, and every button reference to an appliance the library
   * already knew is rewritten onto the code it names rather than the position it sat at.
   *
   * It refuses when the token no longer names a held reading, which means reading the remote again.
   */
  importFrom(name: string, token: string): Promise<ImportOutcome>;

  /**
   * What this document holds: devices, activities and what every button sends.
   *
   * `undefined` when there is no configuration behind it, which is the ordinary state of a document
   * somebody created by picking a model from a list. Not an empty model: a screen showing a remote
   * with no devices would be a statement about somebody's equipment, and there is nothing to state.
   *
   * `missing` names the appliances the content refers to that this machine's library has not got.
   */
  contents(name: string): Promise<DocumentContents | undefined>;

  /**
   * Put a definition in the shared library for every appliance this document drives.
   *
   * Separate from `contents` because it writes to a collection every other document sees, and nothing
   * should do that as a side effect of looking. An identifier already there is **kept, never
   * overwritten**: it may have been corrected by hand since, and a re-import would discard that.
   */
  fileDefinitions(name: string): Promise<FiledDefinitions>;

  /**
   * Put an appliance from the library onto this remote, as a new position with a name.
   *
   * The first method here that **changes a document's contents** rather than reading them or replacing
   * them wholesale, which is what `content.json` was written for. A document nothing has been imported
   * into gets contents of its own, marked as built here: that is the case this exists for, a second remote
   * driving the television the first one taught this machine about.
   *
   * The position it gets is the next free number and is permanent: three things in the model refer to a
   * device by it.
   */
  addDevice(name: string, definition: string, label?: string): Promise<RemoteContent>;
  /**
   * What you call the thing at one position on this remote, or nothing.
   *
   * The label belongs to the **use** and not to the description, which is what makes four identical
   * televisions one description under four names. Absent takes the label away rather than storing an
   * empty one, and then a screen shows the library's own name for it.
   */
  labelDevice(name: string, slot: number, label?: string): Promise<RemoteContent>;
  /**
   * Point a key on the keypad at one command of this device, or clear it.
   *
   * This writes the **device's own button map**, which is what device mode is on a Harmony: press Devices,
   * pick the television, and every key drives the television. One key, one command of that device.
   *
   * **Activities do not come into it.** An activity's map is a different map of the same keypad, mixing
   * every device you own, and it is edited on a page about the activity. Nothing here reads or writes one.
   *
   * `command` absent clears it. The only refusal is a position this remote does not have.
   */
  assignButton(name: string, scan: number, device: number,
               command?: number): Promise<RemoteContent>;
}

/**
 * The hardware on the USB bus, and nothing that touches it.
 *
 * Its own namespace rather than a sixth method on `RemotesApi`, because the two answer different
 * questions from different places: one is about documents on this disk, the other about a device
 * somebody just plugged in. Keeping them apart is also what makes the read only promise legible,
 * since everything a window can ask about hardware is the one method below.
 */
export interface DevicesApi {
  /** Every attached Harmony, by enumeration. Opens nothing and can be called as often as wanted. */
  attached(): Promise<AttachedRemote[]>;
  /**
   * Ask one remote what it is, which **opens the device**.
   *
   * The only method on either half of this API that claims hardware, which is why it is worth a
   * paragraph in an interface. One `GET_VERSION` is sent and nothing else, the handle is closed
   * whatever happens, and it is called when somebody asks rather than on a timer.
   *
   * The selector is a product id, so it names a model. It refuses rather than guesses when two of one
   * model are attached, because `openHarmony` will not choose between them.
   */
  readHardware(productId: number): Promise<HardwareReading>;
}

/**
 * The appliances, described once and shared between remotes.
 *
 * Its own namespace, and the third one, because it answers about a **different object**: `remotes` is
 * about documents somebody owns and `devices` about hardware on the bus, and this is about televisions
 * and amplifiers, which outlive both. A definition is addressed by its identifier, which never changes,
 * unlike a remote, which is addressed by its name because its name is its folder.
 */
export interface LibraryApi {
  /** Every appliance this machine has a description of, by identifier. */
  list(): Promise<DeviceDefinition[]>;
  /** One appliance. Refused when there is no such identifier. */
  get(id: string): Promise<DeviceDefinition>;
  /** Write one, new or corrected. The identifier is the identity and may not be changed by this. */
  put(definition: DeviceDefinition): Promise<DeviceDefinition>;
  /**
   * Write down an appliance by hand: a kind, and whatever words its owner has for it.
   *
   * Separate from `put` because the caller cannot supply the one field `put` requires. An identifier is
   * this machine's to mint and never to be reused, and a window that made one up would be a window
   * deciding what identity means.
   */
  create(draft: DeviceDraft): Promise<DeviceDefinition>;
  /** A second description of the same appliance, with a fresh identifier and optionally a new name. */
  clone(id: string, name?: string): Promise<DeviceDefinition>;
  remove(id: string): Promise<void>;
  /**
   * Which appliances a document refers to and this machine has not got.
   *
   * The cost of keeping the library outside the document, as a question the window can ask before it
   * draws a screen with holes in it.
   */
  missingFor(content: RemoteContent): Promise<string[]>;
  /**
   * Appliances that send the same things and are therefore probably one appliance, grouped.
   *
   * Reports and never merges. Merging changes what every document referring to either one points at,
   * so it is a decision for a person rather than for a library.
   */
  likelyDuplicates(): Promise<DeviceDefinition[][]>;

  /**
   * Which remotes use which appliance, and what each one calls it.
   *
   * **This is what makes the library readable at all.** A description read out of a configuration has no
   * manufacturer and no model, so a list of them is four rows saying "81 commands" and nothing that tells
   * them apart. The documents have the names, because their owner typed them, and this is the only place
   * that puts the two together.
   *
   * Derived on every call and never stored: the name belongs to the use, so putting one on the description
   * would mean picking whichever remote happened to be imported first.
   */
  usage(): Promise<DeviceUsage[]>;

  /**
   * Name commands, or take names away by leaving `name` out of an entry.
   *
   * **A method of its own rather than `put` with an edited definition**, and the reason is what a caller
   * would have to do otherwise: read the definition, rebuild its command list with the changed elements,
   * and send the lot back. A window doing that owns a merge rule about a list its own screen is showing a
   * stale copy of, and the failure is silent: two names typed quickly, the second read of the definition
   * still holding the first's old value, and one of them is gone.
   *
   * **A list rather than one, so that taking a whole column of suggestions is one write.** The page offers
   * to accept every name the remote already draws, which is 37 of a real television's 81, and thirty seven
   * separate calls would be thirty seven reads, thirty seven writes and thirty seven reloads of the list
   * underneath somebody's pointer. One entry is the ordinary case and costs nothing extra.
   *
   * The identity is untouched by construction. A name is not part of what an appliance sends, so the
   * fingerprint that addresses it cannot move, which is why this is allowed to be a small write.
   */
  nameCommands(id: string, names: readonly CommandNaming[]): Promise<DeviceDefinition>;

  /**
   * The bit frame each of an appliance's commands encodes, for the ones that decode to exactly one.
   *
   * **Derived on every call and deliberately not stored.** A frame a catalogue stated and a frame we
   * decoded out of durations ourselves are different claims, and a store holding both in one field
   * loses which is which. `src/main/frames.ts` says the rest, including why an ambiguous reading is
   * reported as no reading.
   *
   * Sparse: a command whose durations do not read as a frame is simply absent from the answer.
   *
   * **No screen shows this and none should.** It is a matching key: the step that carries names across
   * from a catalogue compares these numbers, because a number can be compared with a number written down
   * elsewhere where a rhythm can only be compared with another rhythm. It was on the commands page for a
   * few hours on 22 August 2026 and it was this project talking to itself.
   */
  framesOf(id: string): Promise<CommandFrame[]>;

  /**
   * Where each of an appliance's commands already appears on somebody's remote, in their own words.
   *
   * **This is what makes an imported appliance nameable at all, and it costs nothing to know.** A
   * configuration states no command names, which is why every code reads as "Command 41". But it does
   * carry the words the remote **draws**: a screen key that sends a command has the word printed beside
   * it on the display, because that is how the person using it knows what they are pressing. And a code
   * on the keypad is on a key with a name on it.
   *
   * So the answer is one entry per place a command is used, and a page turns those into a suggestion. It
   * is deliberately raw: a scan code and a drawn word, with no ranking and no choosing between them,
   * because which one reads better is a question about a screen.
   */
  inUseOn(id: string): Promise<CommandInUse[]>;
}

/**
 * One place a command is used on a remote, and whatever that remote calls it there.
 *
 * `label` is the word the configuration draws for it, which is present on nearly every screen key and on
 * no keypad key: a keypad key has a name because it is printed on the plastic, and that name comes from
 * the drawing rather than from the file. So the two halves are complementary and both are handed over raw.
 */
/** One command's new name, or its name being taken away where `name` is absent. */
export interface CommandNaming {
  readonly slot: number;
  readonly name?: string;
}

export interface CommandInUse {
  readonly slot: number;
  /** Which document, so a suggestion can say where it came from. */
  readonly remote: string;
  readonly surface: 'keypad' | 'screen';
  readonly scan?: number;
  readonly label?: string;
}

/**
 * One command's frame: the number the appliance reads out of the blinking, with the bit count it needs.
 *
 * **Both, never the value alone.** A frame only means anything beside its width, since `0x10ef` at 16
 * bits and at 32 bits are different codes, and it is what makes this comparable with a number written
 * down anywhere else. That comparison is the whole point of the field: it is how a catalogue's names
 * reach codes read off somebody's remote.
 */
export interface CommandFrame {
  readonly slot: number;
  readonly bits: number;
  /** Lower case hexadecimal, no prefix, exactly as `frame` is spelled in the model. */
  readonly frame: string;
}

/**
 * Logitech's own service, as far as this application uses it.
 *
 * **Optional and never a dependency.** Everything else in this application works on a machine that has
 * never seen a network, and this exists because a configuration read off a remote states no command names
 * at all while Logitech's database does: their software is what compiled that configuration. The service
 * is still answering and will not be one day, which is the whole argument for taking what it has now and
 * for nothing depending on it.
 *
 * **The password crosses this boundary once, inwards.** `rememberAccount` takes one and no method here
 * returns one, so a window can set a password, ask whether there is one, and never read it back.
 */
export interface LogitechApi {
  /** The address, and whether a password is stored. Never the password and never a masked form of it. */
  account(): Promise<AccountState>;
  /**
   * Remember an address, and a password encrypted by the operating system's own keystore.
   *
   * **An empty password keeps the one already stored**, which is what the field means when somebody fixes
   * a typo in their address. With nothing stored it is refused, since an address nobody can sign in with
   * would be a screen saying a password is held when none is.
   *
   * Refused where the system offers no way to encrypt, rather than falling back to plain text: a quiet
   * downgrade is what makes a promise about a password worthless.
   */
  rememberAccount(email: string, password: string): Promise<AccountState>;
  forgetAccount(): Promise<AccountState>;
  /**
   * Sign in and throw the session away, which is the only way to know a stored password still works.
   *
   * A password changed on Logitech's own site looks exactly like one that works, until something needs
   * it. So there is a button, and it resolves or it throws with a reason somebody can act on.
   */
  checkAccount(): Promise<void>;
  /** Look a device up in Logitech's catalogue. Reads only; asking writes nothing anywhere. */
  search(manufacturer: string, model: string): Promise<CatalogueDevice[]>;
  /**
   * Fetch one device's commands and file it in the library.
   *
   * **What arrives is names, not signals.** Logitech stores a protocol family and a frame value per
   * command and never the pulses, so a definition from here cannot send anything: it is a list of their
   * own words attached to their own codes, which is exactly what names the nameless codes on a remote.
   */
  fetchDevice(device: CatalogueDevice): Promise<DeviceDefinition>;
  /**
   * Which of an appliance's codes Logitech has a word for, found by comparing the codes themselves.
   *
   * **The one route here that is not a guess.** A word drawn on a remote's screen and the name of the key
   * a code sits on both say **where** a code is: somebody may have put channel up on the key marked 1, and
   * Logitech's default is only a default. This compares the code, so it matches or it does not.
   *
   * Measured on 22 August 2026: 52 of the 58 commands Logitech states for one Panasonic television are
   * byte for byte equal to a code on the television attached to the bench Harmony 600, which is a
   * different model of the same family.
   *
   * **It reports and writes nothing.** Applying the result is `library.nameCommands`, after somebody has
   * seen how many there are, which is the same shape `likelyDuplicates` uses for the same reason.
   */
  matchNames(id: string, device: CatalogueDevice): Promise<NameMatches>;
}

/** What comparing an appliance's codes against a catalogue device turned up. */
export interface NameMatches {
  /** What to name which position, ready for `library.nameCommands`. Only positions with no name. */
  readonly names: readonly CommandNaming[];
  /** How many of the appliance's codes could be compared at all, which bounds what a match could be. */
  readonly comparable: number;
  /** How many words the catalogue offered, so a result can be read with both its counts. */
  readonly offered: number;
}

/** One row of a catalogue search: enough to show somebody a list, and the handle to fetch one. */
export interface CatalogueDevice {
  readonly manufacturer: string;
  readonly model: string;
  /** Our own category, translated from Logitech's sixty. `other` where none of ours fits. */
  readonly kind: string;
  /** Logitech's handle for this device's command set, passed back unchanged. Opaque here. */
  readonly commandsId: number;
}

/** What a screen may know about the stored account. */
export interface AccountState {
  readonly email?: string;
  readonly hasPassword: boolean;
}

export interface FreeHarmonyApi {
  readonly remotes: RemotesApi;
  readonly devices: DevicesApi;
  readonly library: LibraryApi;
  readonly logitech: LogitechApi;
}

/** Which half of the API a channel belongs to. Derived, so it cannot name a namespace that is gone. */
export type Namespace = keyof FreeHarmonyApi;

/**
 * The channel names, derived from the interfaces rather than written out, so that adding a method and
 * forgetting to register it is a typecheck failure instead of a channel that answers nothing.
 */
export const REMOTE_METHODS = ['list', 'create', 'rename', 'duplicate', 'remove',
                               'inspectAttached', 'importFrom', 'contents', 'fileDefinitions',
                               'addDevice', 'labelDevice', 'assignButton'] as const;
export const DEVICE_METHODS = ['attached', 'readHardware'] as const;
export const LIBRARY_METHODS =
  ['list', 'get', 'put', 'create', 'clone', 'remove',
   'missingFor', 'likelyDuplicates', 'usage', 'nameCommands', 'framesOf', 'inUseOn'] as const;

export const LOGITECH_METHODS =
  ['account', 'rememberAccount', 'forgetAccount', 'checkAccount', 'search', 'fetchDevice', 'matchNames'] as const;

export type RemoteMethod = (typeof REMOTE_METHODS)[number];
export type DeviceMethod = (typeof DEVICE_METHODS)[number];
export type LibraryMethod = (typeof LIBRARY_METHODS)[number];
export type LogitechMethod = (typeof LOGITECH_METHODS)[number];

/**
 * Every namespace and its methods, so that anything walking the whole surface walks this.
 *
 * A mapped type over `Namespace`, which is what makes it more than a convenience: a namespace added to
 * `FreeHarmonyApi` and not added here does not compile. Without it a caller has to write `['remotes',
 * 'devices']` somewhere, and the day a third namespace arrives that list is the one nobody updates.
 */
export const METHODS: { readonly [N in Namespace]: readonly (keyof FreeHarmonyApi[N] & string)[] } = {
  remotes: REMOTE_METHODS,
  devices: DEVICE_METHODS,
  library: LIBRARY_METHODS,
  logitech: LOGITECH_METHODS,
};

/**
 * `remotes:list`, `devices:attached`. One spelling, used by the handler side and the caller side.
 *
 * The namespace is a parameter rather than there being one function per half, for the reason this
 * project repeats most often: two copies of a rule are two copies until one of them moves. The
 * generic is what keeps it honest, since a method has to be a real method of the namespace it is
 * passed with, so `channelFor('devices', 'rename')` does not compile.
 */
export function channelFor<N extends Namespace>(
  namespace: N,
  method: keyof FreeHarmonyApi[N] & string,
): string {
  return `${namespace}:${method}`;
}

/**
 * A type level assertion that a method list names every method of its interface and no others.
 *
 * Two lists that nobody compares will differ, which is the sibling repository's most repeated
 * failure. Here the comparison costs nothing and happens at compile time: the assignments below stop
 * typechecking the moment a list and its interface disagree in either direction.
 *
 * **Both sides are wrapped in a tuple, and that is load bearing rather than style.** A conditional
 * type distributes over a naked type parameter, so `Listed extends keyof Api` would be evaluated once
 * per method with `Listed` bound to that single method, and the inner test would then ask whether all
 * five methods extend one of them. It does not, so the check failed the moment it was made generic,
 * having passed for weeks written out longhand where `RemoteMethod` was an alias and not a parameter.
 * A tuple compares the unions whole.
 */
type Exhaustive<Listed extends string, Api> = [Listed] extends [keyof Api]
  ? [keyof Api] extends [Listed]
    ? true
    : never
  : never;

export const REMOTE_METHODS_ARE_EXHAUSTIVE: Exhaustive<RemoteMethod, RemotesApi> = true;
export const DEVICE_METHODS_ARE_EXHAUSTIVE: Exhaustive<DeviceMethod, DevicesApi> = true;
export const LIBRARY_METHODS_ARE_EXHAUSTIVE: Exhaustive<LibraryMethod, LibraryApi> = true;

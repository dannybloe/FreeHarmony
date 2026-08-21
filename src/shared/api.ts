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
import type { AttachedRemote, HardwareReading } from './devices.ts';
import type { DeviceDefinition } from './library.ts';
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
   * Read the whole configuration off an attached remote and keep it against this document.
   *
   * **The second method on this API that claims hardware and by far the heavier one**: it holds an
   * irreplaceable device for the length of a transfer of up to 1.6 MB. Reads only, one device, closed
   * afterwards, and never on a timer. It either files a configuration that passed both of the read's
   * own checks or it throws and the document keeps what it had.
   *
   * The product id names a model rather than a unit, so it refuses when two of one model are attached.
   *
   * **The bytes do not come back.** They stay in the main process, where the library can read them,
   * and what the window gets is the document's manifest. `contents` is how it sees inside.
   *
   * It also puts a description of every appliance the remote drives into the shared library, because
   * that is what an import is. Nothing already there is overwritten, so reading the same remote again
   * costs nothing and changes nothing.
   */
  readConfiguration(name: string, productId: number): Promise<RemoteDocument>;

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
}

export interface FreeHarmonyApi {
  readonly remotes: RemotesApi;
  readonly devices: DevicesApi;
  readonly library: LibraryApi;
}

/** Which half of the API a channel belongs to. Derived, so it cannot name a namespace that is gone. */
export type Namespace = keyof FreeHarmonyApi;

/**
 * The channel names, derived from the interfaces rather than written out, so that adding a method and
 * forgetting to register it is a typecheck failure instead of a channel that answers nothing.
 */
export const REMOTE_METHODS = ['list', 'create', 'rename', 'duplicate', 'remove',
                               'readConfiguration', 'contents', 'fileDefinitions'] as const;
export const DEVICE_METHODS = ['attached', 'readHardware'] as const;
export const LIBRARY_METHODS =
  ['list', 'get', 'put', 'remove', 'missingFor', 'likelyDuplicates'] as const;

export type RemoteMethod = (typeof REMOTE_METHODS)[number];
export type DeviceMethod = (typeof DEVICE_METHODS)[number];
export type LibraryMethod = (typeof LIBRARY_METHODS)[number];

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

/**
 * The document model: what a remote **is** to this application, as opposed to what a configuration
 * is to the library next door.
 *
 * This is the layer the whole architecture turns on. Everything here is ours, it is plain
 * serialisable data, and it crosses the boundary between the main process and the window unchanged.
 * Nothing in it comes from `@harmony/codec` and nothing in it describes a byte.
 *
 * The distinction to keep, because it is the one that decays quietly: a **device**, an **activity**,
 * an **infrared code** are the format's, they are read by the library, and a second reading of them
 * must never appear on this side. A remote somebody added, the name they gave it, when it was added
 * and where its backups sit are **ours**, and the library knows nothing about any of them.
 *
 * **A remote's name is its folder's name, and that is its identity.** There is no separate
 * identifier, on purpose: the name would then exist in a folder name and in a file, and two copies
 * of one fact is this project's oldest failure. So a rename is a folder moving, a folder copied in a
 * file manager is simply another remote, and `remote.json` holds only what a folder name cannot.
 * That is how a document application works: the identity of a document is where it is.
 */

/** How a remote's stored configuration came to exist, which decides what may be done with it. */
export type Provenance =
  /** Added by reading a real remote over USB. The only kind that could be written back. */
  | 'read-from-device'
  /** Copied from another entry, base configuration and all. */
  | 'duplicated'
  /** Created here with nothing behind it. See `isWritable` for why that matters. */
  | 'created-empty';

/**
 * The configuration a remote's entry is based on, described rather than contained.
 *
 * The bytes live in a file beside the manifest. They are deliberately not in it: they are the one
 * thing on this side that only the library may interpret, and a few hundred kilobytes of base64
 * would turn a readable manifest into one unreadable line.
 */
export interface BaseConfiguration {
  /** The file beside the manifest, relative to the remote's own folder. */
  readonly fileName: string;
  readonly byteLength: number;
  /** Read once when the file was stored, so a later change to it can be noticed rather than trusted. */
  readonly sha256: string;
  /** When it was read off a device, if it ever was. ISO 8601. */
  readonly readAt?: string;
}

/**
 * `remote.json`: everything about a remote that its folder name cannot carry.
 *
 * No name and no identifier, which is the point. Adding either would put a fact in two places.
 */
export interface StoredRemote {
  readonly provenance: Provenance;
  /** ISO 8601, both, so ordering never depends on a file system timestamp. */
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Absent on an entry created from nothing. */
  readonly baseConfiguration?: BaseConfiguration;
}

/** A remote as the application handles it: what is stored, plus the name its folder carries. */
export interface RemoteDocument extends StoredRemote {
  readonly name: string;
}

/**
 * Characters a folder name cannot hold on the platforms this application runs on.
 *
 * The union of all three rather than the local rules, because somebody's documents folder is
 * commonly synced and a name that is legal here should not become a problem on the machine it
 * arrives at. `:` is the classic one on macOS, `\` and the rest are Windows'.
 */
// The range at the end is the control characters, which no folder name may hold either.
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/;

/** Names Windows reserves whatever the extension, which are a genuine cause of unopenable folders. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Why a name cannot be used, or `undefined` if it can.
 *
 * One function with two callers on purpose. The store refuses with it, which is the refusal that
 * counts, and the window explains with it before anybody presses anything. Two implementations of
 * the same rule would be two rules the day one of them was edited.
 *
 * It **refuses** rather than transforming. A name quietly turned into something else is the name the
 * user meant, lost, and they find out by looking at a list that does not say what they typed.
 */
export function whyNameIsRefused(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === '') return 'a remote needs a name';
  if (FORBIDDEN.test(trimmed)) return 'a name cannot contain < > : " / \\ | ? or *';
  if (trimmed === '.' || trimmed === '..') return 'that name means something else to the file system';
  if (trimmed.endsWith('.')) return 'a name cannot end in a full stop';
  if (RESERVED.test(trimmed)) return `${trimmed} is a name the file system reserves`;
  if (trimmed.length > 120) return 'that name is too long for a folder';
  return undefined;
}

/** The name as it will be used, once it is known to be acceptable. */
export function cleanName(name: string): string {
  return name.trim();
}

/**
 * Whether an entry could ever be written to a remote, which is a property of the data and not of
 * the interface.
 *
 * The first place the honesty rule bites: the library can change a configuration that already
 * exists and cannot build one from nothing, so an entry with no base configuration is something to
 * look at and edit and never something to send. An interface that discovers that at the moment
 * somebody presses a button has already let them do the work twice.
 *
 * This is not a claim that writing is implemented. Nothing here has ever written to a remote.
 */
export function isWritable(remote: RemoteDocument): boolean {
  return remote.baseConfiguration !== undefined;
}

/** The order a list is shown in: most recently touched first, and by name when that ties. */
export function byMostRecentlyChanged(a: RemoteDocument, b: RemoteDocument): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return a.name.localeCompare(b.name);
}

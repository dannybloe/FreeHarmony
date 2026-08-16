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
 */

/** How a remote's stored configuration came to exist, which decides what may be done with it. */
export type Provenance =
  /** Added by reading a real remote over USB. The only kind that can be written back today. */
  | 'read-from-device'
  /** Copied from another entry, base configuration and all. */
  | 'duplicated'
  /** Created here with nothing behind it. See `isWritable` for why that matters. */
  | 'created-empty';

/**
 * The configuration a remote's entry is based on, described rather than contained.
 *
 * The bytes live in a file beside the document. They are deliberately not in it: they are the one
 * thing on this side that only the library may interpret, and putting them in the document would
 * put them in the window, which is exactly what the boundary exists to prevent.
 */
export interface BaseConfiguration {
  /** The file beside the document, relative to the remote's own directory. */
  readonly fileName: string;
  readonly byteLength: number;
  /** Read once when the file was stored, so a later change to it can be noticed rather than trusted. */
  readonly sha256: string;
  /** When it was read off a device, if it ever was. ISO 8601. */
  readonly readAt?: string;
}

/** One remote as this application holds it. Plain data, serialised to JSON on disk as it stands. */
export interface RemoteDocument {
  /** Stable for the life of the entry, and also the name of its directory. */
  readonly id: string;
  /** Whatever the user called it. Changing this changes nothing else. */
  readonly name: string;
  readonly provenance: Provenance;
  /** ISO 8601, both of them, so that ordering never depends on a file system timestamp. */
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Absent on an entry created from nothing. */
  readonly baseConfiguration?: BaseConfiguration;
}

/**
 * Whether an entry could ever be written to a remote, which is a property of the data and not of
 * the interface.
 *
 * It is here rather than in a component because it is the first place the honesty rule from the
 * architecture bites: the library can change a configuration that already exists and cannot build
 * one from nothing, so an entry with no base configuration is something to look at and edit and
 * never something to send. An interface that discovers that at the moment somebody presses a button
 * has already let them do the work twice.
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

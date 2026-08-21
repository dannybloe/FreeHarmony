/**
 * The store: remotes as folders in the user's documents, one folder per remote.
 *
 * **The folder's name is the remote's name, and it is also its identity.** So a rename is a folder
 * moving, a folder copied in a file manager is another remote with no reconciling to do, and
 * `remote.json` holds only what a folder name cannot carry. The alternative, an identifier in the
 * manifest with the folder named after it, puts the name in two places, and two copies of one fact
 * is the failure this project is most familiar with.
 *
 * **It does not import Electron and it must not start.** The root comes in as an argument, which is
 * what lets the whole store be exercised by the test runner against a temporary directory, with no
 * window, no application and no documents folder on the machine that runs it. That is the payoff the
 * architecture was arranged for: if a rule about somebody's remotes can only be checked by clicking,
 * it is in the wrong file.
 *
 * The layout on disk:
 *
 *     Documents/FreeHarmony/remotes/<name>/remote.json          the manifest, ours, plain JSON
 *     Documents/FreeHarmony/remotes/<name>/<base config file>    the configuration bytes, opaque here
 *     Documents/FreeHarmony/remotes/<name>/backups/              kept forever, never pruned here
 *
 * A folder per remote rather than one file each, because of what arrives next: a configuration is a
 * binary of up to a megabyte and a half, and the backups are several of those with dates. Neither
 * belongs inside a manifest somebody is meant to be able to read. And a folder per remote rather
 * than one index, because a half written index loses every entry where an unreadable folder loses
 * itself.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename as renamePath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { HardwareReading } from '../../shared/devices.ts';
import type { BaseConfiguration, RemoteDocument, RemoteModel, StoredRemote } from '../../shared/remote.ts';
import { byMostRecentlyChanged, cleanName, whyNameIsRefused } from '../../shared/remote.ts';

const MANIFEST = 'remote.json';
const BACKUPS = 'backups';

/** Everything the store needs from the world, so that a test can hand it a different clock. */
export interface StoreOptions {
  readonly root: string;
  /** Returns an ISO 8601 timestamp. A test passes a fixed one; the application passes the clock. */
  readonly now?: () => string;
}

export class RemoteStore {
  readonly #root: string;
  readonly #now: () => string;

  constructor(options: StoreOptions) {
    this.#root = options.root;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  /** The folder a remote owns. Exposed because a backup or a configuration file lives inside it. */
  folderOf(name: string): string {
    return join(this.#root, name);
  }

  async list(): Promise<RemoteDocument[]> {
    let names: string[];
    try {
      names = (await readdir(this.#root, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      // No store yet is an empty store, not an error. The first run of the application is the
      // ordinary case and it should not have to create anything before it can show a screen.
      return [];
    }

    const found: RemoteDocument[] = [];
    for (const name of names) {
      const stored = await this.#read(name);
      // A folder whose manifest will not parse is skipped rather than fatal, which is the reason
      // there is no index: one unreadable remote costs one remote.
      if (stored !== undefined) found.push({ ...stored, name });
    }
    return found.sort(byMostRecentlyChanged);
  }

  async get(name: string): Promise<RemoteDocument> {
    const stored = await this.#read(name);
    if (stored === undefined) throw new Error(`there is no remote called ${name}`);
    return { ...stored, name };
  }

  /**
   * A new document, with the model it is about and what the hardware said, where the caller knows them.
   *
   * Both are optional at this seam and not further in: a document written before either field existed
   * has neither, and the store's job is to keep what it was told rather than to invent anything. The
   * spreads are what `exactOptionalPropertyTypes` demands, and they are the right shape anyway, since an
   * absent key and a key holding `undefined` should not both end up in somebody's JSON.
   *
   * `hardware` is a reading of a remote and **not** a claim that the document belongs to that unit. Two
   * Harmony Ones running one firmware answer identically, so nothing may treat it as an identity.
   */
  async create(name: string, model?: RemoteModel,
               hardware?: HardwareReading): Promise<RemoteDocument> {
    const wanted = this.#acceptable(name);
    if (await this.#exists(wanted)) throw new Error(`there is already a remote called ${wanted}`);

    const at = this.#now();
    const stored: StoredRemote = {
      provenance: 'created-empty', createdAt: at, updatedAt: at,
      ...(model === undefined ? {} : { model }),
      ...(hardware === undefined ? {} : { hardware }),
    };
    await mkdir(join(this.folderOf(wanted), BACKUPS), { recursive: true });
    await this.#write(wanted, stored);
    return { ...stored, name: wanted };
  }

  /**
   * Renaming is moving the folder, which is the whole point of the name being the identity: there is
   * no second place holding the old name that could be forgotten.
   *
   * The manifest's `updatedAt` moves too, because a rename is a change to the remote as far as
   * anybody looking at a list is concerned.
   */
  async rename(name: string, to: string): Promise<RemoteDocument> {
    const wanted = this.#acceptable(to);
    const existing = await this.get(name);
    if (wanted === name) return existing;
    if (await this.#exists(wanted)) throw new Error(`there is already a remote called ${wanted}`);

    await renamePath(this.folderOf(name), this.folderOf(wanted));
    const stored: StoredRemote = { ...toStored(existing), updatedAt: this.#now() };
    await this.#write(wanted, stored);
    return { ...stored, name: wanted };
  }

  /**
   * A complete copy under the first free name, base configuration and all.
   *
   * The configuration comes too, on purpose, and it is the reason this cannot be a shallow entry: an
   * entry is the configuration it started from plus what has been changed, so a duplicate with no
   * bytes behind it would be a copy that could never be sent anywhere. The backups do not come,
   * because they are the history of a different unit.
   */
  async duplicate(name: string): Promise<RemoteDocument> {
    const original = await this.get(name);
    const copy = await this.#firstFreeCopyName(name);
    const at = this.#now();
    const stored: StoredRemote = {
      ...toStored(original), provenance: 'duplicated', createdAt: at, updatedAt: at,
    };

    await mkdir(join(this.folderOf(copy), BACKUPS), { recursive: true });
    const base = original.baseConfiguration;
    if (base !== undefined) {
      await cp(join(this.folderOf(name), base.fileName), join(this.folderOf(copy), base.fileName));
    }
    await this.#write(copy, stored);
    return { ...stored, name: copy };
  }

  async remove(name: string): Promise<void> {
    await this.get(name);
    await rm(this.folderOf(name), { recursive: true, force: true });
  }

  /**
   * Stores configuration bytes against a remote and records what they are.
   *
   * The only method that touches a configuration, and it does not interpret one: it writes the bytes
   * and remembers their length and their digest. Reading them is the library's job in a later step,
   * and the digest is what will let a stored file be checked rather than assumed.
   */
  async attachConfiguration(name: string, fileName: string, bytes: Uint8Array,
                            provenance: StoredRemote['provenance'],
                            readAt?: string): Promise<RemoteDocument> {
    const existing = await this.get(name);
    await writeFile(join(this.folderOf(name), fileName), bytes);

    const base: BaseConfiguration = {
      fileName,
      byteLength: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      ...(readAt === undefined ? {} : { readAt }),
    };
    const stored: StoredRemote = {
      ...toStored(existing), provenance, baseConfiguration: base, updatedAt: this.#now(),
    };
    await this.#write(name, stored);
    return { ...stored, name };
  }

  /** The shared rule, applied here because this is the refusal that counts. */
  #acceptable(name: string): string {
    const refused = whyNameIsRefused(name);
    if (refused !== undefined) throw new Error(refused);
    return cleanName(name);
  }

  async #exists(name: string): Promise<boolean> {
    return (await this.#read(name)) !== undefined;
  }

  /** `<name> copy`, then `<name> copy 2`, counting up. Deterministic, so a test can assert it. */
  async #firstFreeCopyName(name: string): Promise<string> {
    for (let n = 1; ; n += 1) {
      const candidate = n === 1 ? `${name} copy` : `${name} copy ${n}`;
      if (!(await this.#exists(candidate))) return candidate;
    }
  }

  async #read(name: string): Promise<StoredRemote | undefined> {
    try {
      const text = await readFile(join(this.folderOf(name), MANIFEST), 'utf8');
      return JSON.parse(text) as StoredRemote;
    } catch {
      return undefined;
    }
  }

  async #write(name: string, stored: StoredRemote): Promise<void> {
    await mkdir(this.folderOf(name), { recursive: true });
    // Indented, with a trailing newline: it is in somebody's documents folder, so it is meant to be
    // opened, read and committed to whatever they keep their own things in.
    await writeFile(join(this.folderOf(name), MANIFEST),
                    `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
  }
}

/** Drops the name back off, since the name is the folder and never a field in the manifest. */
function toStored(remote: RemoteDocument): StoredRemote {
  const { name: _name, ...stored } = remote;
  return stored;
}

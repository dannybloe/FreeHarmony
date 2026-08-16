/**
 * The store: remotes on disk, as directories under a root this module is handed.
 *
 * **It does not import Electron and it must not start.** The root comes in as an argument, which is
 * what lets the whole store be exercised by the test runner against a temporary directory, with no
 * window, no application and no user data on the machine that runs it. That is the payoff the
 * architecture was arranged for: if a rule about somebody's remotes can only be checked by clicking,
 * it is in the wrong file.
 *
 * The layout on disk, one directory per remote:
 *
 *     <root>/<id>/remote.json          the document, ours, plain JSON
 *     <root>/<id>/<base config file>   the configuration bytes, opaque here
 *     <root>/<id>/backups/             kept forever, never pruned by this module
 *
 * A directory per remote rather than one index file, deliberately. An index is a second place the
 * truth lives, and a half written one loses every entry rather than one. This way a directory that
 * cannot be read is a remote that is missing, not a store that is broken.
 */
import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { BaseConfiguration, RemoteDocument } from '../../shared/remote.ts';
import { byMostRecentlyChanged } from '../../shared/remote.ts';

const DOCUMENT = 'remote.json';
const BACKUPS = 'backups';

/** Everything the store needs from the world, so that a test can hand it a different clock. */
export interface StoreOptions {
  readonly root: string;
  /** Returns an ISO 8601 timestamp. A test passes a fixed one; the application passes the clock. */
  readonly now?: () => string;
  /** Returns a fresh identity. Separated for the same reason as the clock. */
  readonly nextId?: () => string;
}

export class RemoteStore {
  readonly #root: string;
  readonly #now: () => string;
  readonly #nextId: () => string;

  constructor(options: StoreOptions) {
    this.#root = options.root;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#nextId = options.nextId ?? (() => randomUUID());
  }

  /** The directory a remote owns. Exposed because a backup or a configuration file lives inside it. */
  directoryOf(id: string): string {
    return join(this.#root, id);
  }

  async list(): Promise<RemoteDocument[]> {
    let entries: string[];
    try {
      entries = (await readdir(this.#root, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      // No store yet is an empty store, not an error. The first run of the application is the
      // ordinary case and it should not have to create anything before it can show a screen.
      return [];
    }

    const found: RemoteDocument[] = [];
    for (const id of entries) {
      const document = await this.#read(id);
      // A directory whose document will not parse is skipped rather than fatal, which is the reason
      // there is no index: one unreadable remote costs one remote.
      if (document !== undefined) found.push(document);
    }
    return found.sort(byMostRecentlyChanged);
  }

  async get(id: string): Promise<RemoteDocument> {
    const document = await this.#read(id);
    if (document === undefined) throw new Error(`no remote with id ${id}`);
    return document;
  }

  async create(name: string): Promise<RemoteDocument> {
    const at = this.#now();
    const document: RemoteDocument = {
      id: this.#nextId(),
      name: requireAName(name),
      provenance: 'created-empty',
      createdAt: at,
      updatedAt: at,
    };
    await mkdir(join(this.directoryOf(document.id), BACKUPS), { recursive: true });
    await this.#write(document);
    return document;
  }

  async rename(id: string, name: string): Promise<RemoteDocument> {
    const document = await this.get(id);
    const renamed: RemoteDocument = { ...document, name: requireAName(name), updatedAt: this.#now() };
    await this.#write(renamed);
    return renamed;
  }

  /**
   * A complete copy under a new identity, base configuration and all.
   *
   * The configuration comes too, on purpose, and it is the reason this cannot be a shallow entry: a
   * remote's entry is the configuration it started from plus what has been changed, so a duplicate
   * with no bytes behind it would be a copy that can never be sent anywhere. The backups are not
   * copied, because they are the history of a different unit.
   */
  async duplicate(id: string): Promise<RemoteDocument> {
    const original = await this.get(id);
    const at = this.#now();
    const copy: RemoteDocument = {
      ...original,
      id: this.#nextId(),
      name: `${original.name} copy`,
      provenance: 'duplicated',
      createdAt: at,
      updatedAt: at,
    };

    await mkdir(join(this.directoryOf(copy.id), BACKUPS), { recursive: true });
    const base = original.baseConfiguration;
    if (base !== undefined) {
      await cp(join(this.directoryOf(original.id), base.fileName),
               join(this.directoryOf(copy.id), base.fileName));
    }
    await this.#write(copy);
    return copy;
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await rm(this.directoryOf(id), { recursive: true, force: true });
  }

  /**
   * Stores configuration bytes against a remote and records what they are.
   *
   * The only method that touches a configuration, and it does not interpret one: it writes the bytes
   * and remembers their length and their digest. Reading them is the library's job in a later step,
   * and the digest is what will let a stored file be checked rather than assumed.
   */
  async attachConfiguration(id: string, fileName: string, bytes: Uint8Array,
                            provenance: RemoteDocument['provenance'],
                            readAt?: string): Promise<RemoteDocument> {
    const document = await this.get(id);
    await mkdir(this.directoryOf(id), { recursive: true });
    await writeFile(join(this.directoryOf(id), fileName), bytes);

    const base: BaseConfiguration = {
      fileName,
      byteLength: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      ...(readAt === undefined ? {} : { readAt }),
    };
    const updated: RemoteDocument = {
      ...document, provenance, baseConfiguration: base, updatedAt: this.#now(),
    };
    await this.#write(updated);
    return updated;
  }

  async #read(id: string): Promise<RemoteDocument | undefined> {
    try {
      const text = await readFile(join(this.directoryOf(id), DOCUMENT), 'utf8');
      const document = JSON.parse(text) as RemoteDocument;
      // The directory name is the identity. A document claiming another one has been moved by hand,
      // and believing the file would give two remotes the same id.
      return document.id === id ? document : { ...document, id };
    } catch {
      return undefined;
    }
  }

  async #write(document: RemoteDocument): Promise<void> {
    await mkdir(this.directoryOf(document.id), { recursive: true });
    await writeFile(join(this.directoryOf(document.id), DOCUMENT),
                    `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
}

/** A remote with no name is a row nobody can tell apart, so it is refused here and not in a form. */
function requireAName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') throw new Error('a remote needs a name');
  return trimmed;
}

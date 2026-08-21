/**
 * The device library: one appliance described once, in a folder beside the remotes.
 *
 * Decided on 21 August 2026, and the reason is arithmetic rather than taste: the same television
 * belongs to three remotes. It is also the unit a shared collection would exchange and the unit
 * provenance is recorded on, so it is one object seen from either side. `FreeHarmony/docs/data-model.md`
 * carries the argument.
 *
 * **A definition's file is named after its identifier, and that identifier never changes.** The
 * opposite of a remote, whose folder name is its name and therefore its identity, and the difference is
 * deliberate: a person names a remote and they do not name a definition, they name the **use** of one
 * on a particular remote. So everything about a definition can be corrected later, a manufacturer
 * spelled two ways is one appliance, and nothing that points at it breaks when somebody fixes a
 * spelling.
 *
 * Like `remotes.ts`, this imports no Electron and takes its root as an argument, so the whole of it can
 * be driven by the test runner against a temporary directory.
 *
 *     Documents/FreeHarmony/devices/<id>.json
 *
 * One file per definition rather than one index, for the reason the remotes store gives: a half written
 * index loses every entry, where an unreadable file loses itself.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { RemoteContent } from '../../shared/content.ts';
import type { DeviceDefinition } from '../../shared/library.ts';
import { fingerprintOf } from '../../shared/library.ts';

/** Characters an identifier may hold, which is what makes it safe as a file name on every platform. */
const IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,119}$/;

export interface LibraryOptions {
  readonly root: string;
}

export class DeviceLibrary {
  readonly #root: string;

  constructor(options: LibraryOptions) {
    this.#root = options.root;
  }

  fileOf(id: string): string {
    return join(this.#root, `${this.#acceptable(id)}.json`);
  }

  /** Every definition this machine holds, by identifier. */
  async list(): Promise<DeviceDefinition[]> {
    let names: string[];
    try {
      names = (await readdir(this.#root, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name);
    } catch {
      // No library yet is an empty library. The first run of the application has none and should not
      // have to create anything before it can show a screen.
      return [];
    }

    const found: DeviceDefinition[] = [];
    for (const name of names) {
      const one = await this.#read(name.replace(/\.json$/, ''));
      // A file that will not parse costs one appliance rather than the whole library, which is the
      // reason there is no index.
      if (one !== undefined) found.push(one);
    }
    return found.sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<DeviceDefinition> {
    const one = await this.#read(this.#acceptable(id));
    if (one === undefined) throw new Error(`there is no device definition called ${id}`);
    return one;
  }

  /**
   * Write a definition, whether it is new or a correction of one already there.
   *
   * One method rather than a create and an update, because a definition has no state to protect: its
   * identifier is its identity and the file is the whole of it. What a caller must not do is change the
   * identifier, which is why that is refused rather than treated as a move.
   */
  async put(definition: DeviceDefinition): Promise<DeviceDefinition> {
    const id = this.#acceptable(definition.id);
    await mkdir(this.#root, { recursive: true });
    await writeFile(this.fileOf(id), `${JSON.stringify(definition, undefined, 2)}\n`, 'utf8');
    return definition;
  }

  async remove(id: string): Promise<void> {
    const wanted = this.#acceptable(id);
    await this.get(wanted);
    await rm(this.fileOf(wanted), { force: true });
  }

  /**
   * Which definitions a document refers to and this library has not got.
   *
   * **The consequence of putting the library outside the document, made checkable.** A document is no
   * longer self contained: it names appliances that live somewhere else, so moving one to another
   * machine has to take them along. A folder that cannot be opened because a television is unknown
   * would be the failure to avoid, so the question gets a method rather than being discovered by a
   * screen with holes in it.
   */
  async missingFor(content: RemoteContent): Promise<string[]> {
    const held = new Set((await this.list()).map((one) => one.id));
    const wanted = new Set(content.devices
      .map((use) => use.definition)
      .filter((id): id is string => id !== undefined));
    return [...wanted].filter((id) => !held.has(id)).sort();
  }

  /**
   * Definitions that look like the same appliance, grouped, and **nothing is merged**.
   *
   * The mess a shared library invites: two remotes both drive the living room television, both are
   * imported, and the library holds it twice. Two definitions are the same appliance when they send the
   * same things, which is checkable without knowing what either of them is, so this reports it.
   *
   * It reports and does not act, on purpose. Merging two definitions changes what every document that
   * refers to either one is pointing at, which is a decision for a person. A library that quietly
   * merged would be a library that can silently change what a remote does.
   */
  async likelyDuplicates(): Promise<DeviceDefinition[][]> {
    const groups = new Map<string, DeviceDefinition[]>();
    for (const one of await this.list()) {
      const key = fingerprintOf(one.commands);
      // An appliance with no commands at all fingerprints as the empty string, and every one of those
      // would group with every other. That is not a duplicate, it is an absence, so they are left out.
      if (key === '') continue;
      groups.set(key, [...(groups.get(key) ?? []), one]);
    }
    return [...groups.values()].filter((group) => group.length > 1);
  }

  #acceptable(id: string): string {
    if (!IDENTIFIER.test(id)) {
      throw new Error(
        `${id} is not a usable identifier: lower case letters, digits, dashes and underscores`);
    }
    return id;
  }

  async #read(id: string): Promise<DeviceDefinition | undefined> {
    try {
      return JSON.parse(await readFile(this.fileOf(id), 'utf8')) as DeviceDefinition;
    } catch {
      return undefined;
    }
  }
}

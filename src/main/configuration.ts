/**
 * The configuration a document is based on: getting one off a remote, and reading one back.
 *
 * Two halves that look alike and are not. `readConfigurationFrom` **opens an irreplaceable device**
 * and pulls a megabyte and a half off it; `contentsOf` opens a file this application wrote earlier.
 * They live in one file because they are the two ends of the same fact, and their docstrings say which
 * is which so nobody has to guess from a name.
 *
 * **The bytes never cross the bridge**, which is a decision and not an accident. A configuration is up
 * to 1.6 MB and only the library may interpret one, so the main process keeps the file and the window
 * receives the **model**: devices, activities, what each button sends. That is what `src/shared` holds
 * and it is a few kilobytes.
 *
 * **The read is the sibling repository's, `readConfig`, and not a loop of ours.** It carries two checks
 * that took a long time to learn and that nothing here should reimplement: the end marker has to sit
 * where the header said it would, and the trailer checksum has to recompute. A transfer can insert
 * bytes without losing any, so a configuration that parses is not a configuration that arrived.
 *
 * One thing worth flagging rather than hiding: `readConfig` lives in a package called `@harmony/corpus`,
 * whose other half files reads into the private lab directory. Only the `read` subpath is imported here,
 * which pulls in no lab and no filing. Whether that function belongs in `@harmony/usb` instead is a
 * question for the repository that owns it.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { profileFor, readConfig } from '@harmony/corpus/read';
import { HarmonyRemote, openHarmony } from '@harmony/usb';

import type { DocumentContents, FiledDefinitions } from '../shared/content.ts';
import type { DeviceDefinition } from '../shared/library.ts';
import type { RemoteDocument } from '../shared/remote.ts';
import { importConfiguration } from './import.ts';
import type { DeviceLibrary } from './store/library.ts';
import type { RemoteStore } from './store/remotes.ts';

/**
 * Read the whole configuration off an attached remote and attach it to a document.
 *
 * **The heaviest thing this application does.** It claims a device nobody can replace and holds it for
 * as long as the transfer takes, which is thousands of `READ_FLASH` commands. So:
 *
 *   - it is a read path and nothing else. `readConfig` sends `GET_VERSION` and `READ_FLASH` and the
 *     write rails in `@harmony/usb` are what refuse the rest, here as everywhere
 *   - it runs when somebody asks, once, and never on a timer
 *   - the handle is closed in a `finally`, because a clean read only session is what leaves a remote
 *     on its normal screen afterwards
 *   - **nothing is filed until both of the read's own checks pass.** A failure throws and the document
 *     keeps whatever it had, which for a new document is nothing at all. A configuration that half
 *     arrived is worse than none, because everything downstream would then be reading somebody's
 *     equipment out of the wrong bytes
 *
 * The file name carries the moment of the read, so a second read of the same remote does not overwrite
 * the first, and the store records its digest.
 */
export async function readConfigurationFrom(
  store: RemoteStore, library: DeviceLibrary, name: string, productId: number, now: () => string,
): Promise<RemoteDocument> {
  const profile = profileFor(productId);
  const remote = new HarmonyRemote(await openHarmony({ productId }));
  let bytes: Uint8Array;
  try {
    bytes = (await readConfig(remote, profile)).bytes;
  } finally {
    await remote.close();
  }

  const at = now();
  const document = await store.attachConfiguration(name, fileNameFor(at), bytes,
                                                   'read-from-device', at);
  // The appliances go into the library as part of the read, and that is a considered exception to the
  // rule that nothing writes a shared collection as a side effect. Looking at a document must not,
  // which is why `contentsOf` files nothing. But this **is** the import: somebody asked for their
  // remote to be read, and a document whose four televisions are not described anywhere is an import
  // that only half happened. Nothing is overwritten, so a re-read costs nothing and changes nothing.
  await fileDefinitionsOf(store, library, name, now);
  return document;
}

/**
 * The fallback identifier for an appliance with nothing to send, which is the only kind that needs one.
 *
 * **The configuration's digest and not the document's name.** An identifier is a file name and a
 * definition's identity is permanent, so deriving one from something a person can rename is wrong twice
 * over: `living room-device-0` is not a usable file name, and even spelled acceptably it would change
 * under a rename. A digest is stable, safe, and says which read produced the thing.
 */
function prefixFor(sha256: string): string {
  return `config-${sha256.slice(0, 16)}`;
}

/**
 * A file name that says when it was read and cannot collide with the last one.
 *
 * `.bin` rather than anything more specific: the format has no extension of its own, and naming it
 * after a container format would be this application claiming to know what the library knows.
 */
function fileNameFor(at: string): string {
  return `configuration-${at.replace(/[:.]/g, '-')}.bin`;
}

/**
 * What a document holds, or `undefined` because it holds nothing yet.
 *
 * `undefined` rather than an empty model, and the difference is the whole honesty rule of this
 * application: a document created by picking a model from a list genuinely has no contents, and a
 * screen that drew it as a remote with no devices would be describing somebody's equipment wrongly.
 * There is nothing to show, so there is nothing.
 *
 * Recomputed from the bytes on every call rather than cached beside them. A cache would be a second
 * copy of what the file already says, and this repository's neighbour is named for what happens next.
 * It costs a parse of a file this machine wrote, which is milliseconds.
 */
export async function contentsOf(
  store: RemoteStore, library: DeviceLibrary, name: string,
): Promise<DocumentContents | undefined> {
  const document = await store.get(name);
  const base = document.baseConfiguration;
  if (base === undefined) return undefined;

  const bytes = await readFile(join(store.folderOf(name), base.fileName));
  // The timestamp is the document's own rather than the clock's, and this is the one call where that
  // is the right answer: it only stamps the provisional definitions, which this function throws away,
  // so reading a document twice must not produce two different answers. `fileDefinitionsOf` below is
  // where a definition is kept, and that one takes a real clock.
  const imported = importConfiguration(
    bytes, { idPrefix: prefixFor(base.sha256), now: base.readAt ?? document.updatedAt });
  return { content: imported.content, missing: await library.missingFor(imported.content) };
}

/**
 * Read a document's configuration and put a definition in the library for every appliance in it.
 *
 * Separate from `contentsOf` because it **writes**, and the two questions are genuinely different: one
 * asks what a document holds, the other adds appliances to a collection shared by every document on
 * this machine. Nothing should do the second as a side effect of the first.
 *
 * **It does not overwrite.** A definition already in the library may have been corrected by hand, given
 * a manufacturer, or had a better code learned into it, and a re-import would throw all of that away.
 * So an identifier already present is left exactly as it is and reported instead.
 */
export async function fileDefinitionsOf(
  store: RemoteStore, library: DeviceLibrary, name: string, now: () => string,
): Promise<FiledDefinitions> {
  const document = await store.get(name);
  const base = document.baseConfiguration;
  if (base === undefined) return { added: [], kept: [] };

  const bytes = await readFile(join(store.folderOf(name), base.fileName));
  const imported = importConfiguration(bytes, { idPrefix: prefixFor(base.sha256), now: now() });
  const held = new Set((await library.list()).map((one) => one.id));

  const added: string[] = [];
  const kept: string[] = [];
  for (const definition of imported.definitions) {
    if (held.has(definition.id)) kept.push(definition.id);
    else { await library.put(definition as DeviceDefinition); added.push(definition.id); }
  }
  return { added, kept };
}

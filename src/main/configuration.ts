/**
 * The configuration a document is based on: getting one off a remote, and reading one back.
 *
 * **An import, never a synchronisation**, and that word is the shape of this file. `inspectAttached`
 * opens an irreplaceable device, pulls a megabyte and a half off it, works out what is on it and writes
 * **nothing**. `importInto` writes. `contentsOf` opens a file this application wrote earlier. The first
 * two are one act split in two, because looking and committing have different costs and somebody who
 * only wants to know what is on their remote should be able to find out and leave no trace.
 *
 * The split is also what makes the confirmation honest: an import replaces everything a document holds,
 * so the screen that asks can state what is about to go in numbers, having already read the remote.
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
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { profileFor, readConfig } from '@harmony/corpus/read';
import { HarmonyRemote, openHarmony } from '@harmony/usb';

import type { DocumentContents, FiledDefinitions } from '../shared/content.ts';
import type { AppliancePlan, AttachedSummary, ImportOutcome } from '../shared/import.ts';
import type { DeviceDefinition } from '../shared/library.ts';
import { remoteModelForSkin, whyImportIsRefused } from '../shared/models.ts';
import { matchBySignal, relinkAppliance } from '../shared/relink.ts';
import type { RemoteModel } from '../shared/remote.ts';
import { storedContentOf, writeContent } from './content.ts';
import { attachedRemotes } from './devices.ts';
import { pretence, pretendedBytes } from './pretend.ts';
import { importConfiguration } from './import.ts';
import type { DeviceLibrary } from './store/library.ts';
import type { RemoteStore } from './store/remotes.ts';

/**
 * The bytes of the one reading waiting for a decision, and nothing else.
 *
 * **At most one**, which is a statement about what this is for rather than a limit: a person inspects a
 * remote, looks at what came back, and either imports it or does not. A second inspection means they
 * changed their mind, so it replaces the first.
 *
 * They are held in memory and never written, which is the whole point of the split. Walk away and the
 * reading is gone; the cost of being wrong about that is one repeated read, which takes a minute and
 * touches nothing on the remote. The alternative, writing the bytes somewhere provisional, would mean
 * the "writes nothing" half writes something.
 */
let waiting: {
  token: string; bytes: Uint8Array; skin?: number; model?: RemoteModel;
  /** Read out of a file rather than off a remote, which `importInto` refuses. See `pretend.ts`. */
  pretended?: true;
} | undefined;

/**
 * Read the whole configuration off an attached remote and say what is on it. **Writes nothing.**
 *
 * **The heaviest thing this application does.** It claims a device nobody can replace and holds it for
 * as long as the transfer takes, which is thousands of `READ_FLASH` commands. So:
 *
 *   - it is a read path and nothing else. `readConfig` sends `GET_VERSION` and `READ_FLASH` and the
 *     write rails in `@harmony/usb` are what refuse the rest, here as everywhere
 *   - it runs when somebody asks, once, and never on a timer
 *   - the handle is closed in a `finally`, because a clean read only session is what leaves a remote
 *     on its normal screen afterwards
 *   - **the refusal comes first.** Whether this remote's configuration may go into this document is
 *     settled by enumeration, before the device is opened, so an incompatible remote is never claimed
 *     and never read. Getting that order the other way round would mean holding somebody's hardware for
 *     a minute in order to tell them no
 *
 * `into` names the document this is destined for, and is absent when there is not one yet, which is the
 * route from the chooser. With it, the summary can also say what would be replaced.
 */
export async function inspectAttached(
  store: RemoteStore, library: DeviceLibrary, productId: number,
  into: string | undefined, now: () => string,
): Promise<AttachedSummary> {
  const faking = pretence();
  const candidates = faking !== undefined
    // The pretence stands in for enumeration as well, because there is nothing on the bus to enumerate.
    // The refusal below still runs against it, so an incompatible pretence is refused like a real remote.
    ? [{ productId, ...(faking.skin === undefined ? {} : { skin: faking.skin }),
         ...(remoteModelForSkin(faking.skin) === undefined
           ? {} : { model: remoteModelForSkin(faking.skin)! }) }]
    : (await attachedRemotes()).filter((one) => one.productId === productId);
  if (candidates.length === 0) throw new Error('no remote of that kind is attached');
  // `openHarmony` refuses an ambiguous selector rather than guessing, and a product id names a model
  // rather than a unit, so two of one model is a real case with no answer. Saying so beats its error.
  if (candidates.length > 1) {
    throw new Error(`two of that remote are attached, so there is no way to say which one to read`);
  }
  const attached = candidates[0]!;

  const document = into === undefined ? undefined : await store.get(into);
  const refused = whyImportIsRefused(document?.model, attached.skin);
  if (refused !== undefined) throw new Error(refused);

  let bytes: Uint8Array;
  if (faking !== undefined) {
    bytes = await pretendedBytes(faking);
  } else {
    const profile = profileFor(productId);
    const remote = new HarmonyRemote(await openHarmony({ productId }));
    try {
      bytes = (await readConfig(remote, profile)).bytes;
    } finally {
      await remote.close();
    }
  }

  const digest = createHash('sha256').update(bytes).digest('hex');
  const imported = importConfiguration(bytes, { idPrefix: prefixFor(digest), now: now() });
  const held = new Map((await library.list()).map((one) => [one.id, one]));

  const appliances: AppliancePlan[] = imported.content.devices.map((use) => {
    const definition = imported.definitions.find((one) => one.id === use.definition);
    const already = use.definition === undefined ? undefined : held.get(use.definition);
    const knownAs = already === undefined ? undefined : describe(already);
    return {
      slot: use.slot,
      ...(use.label === undefined ? {} : { label: use.label }),
      commandCount: definition?.commands.length ?? 0,
      definition: use.definition ?? '',
      disposition: already === undefined ? 'new' : 'linked',
      ...(knownAs === undefined ? {} : { knownAs }),
    };
  });

  // **What the document shows, not what it has written down**, and the difference was a real fault: a
  // document with bytes and no contents file of its own still displays four appliances and eight
  // activities, and computing this from the file alone made the confirmation silently claim there was
  // nothing to lose. Found by looking at the dialogue rather than by a test, which is what looking is for.
  const existing = into === undefined
    ? undefined : (await contentsOf(store, library, into))?.content;
  const token = randomUUID();
  waiting = {
    token, bytes,
    ...(attached.skin === undefined ? {} : { skin: attached.skin }),
    ...(attached.model === undefined ? {} : { model: attached.model }),
    ...(faking === undefined ? {} : { pretended: true as const }),
  };

  return {
    token,
    ...(attached.model === undefined ? {} : { model: attached.model }),
    ...(attached.skin === undefined ? {} : { skin: attached.skin }),
    byteLength: bytes.byteLength,
    appliances,
    activities: imported.content.activities.map((activity) => ({
      slot: activity.slot,
      ...(activity.name === undefined ? {} : { name: activity.name }),
    })),
    buttonCount: imported.content.buttons.length,
    ...(imported.content.language === undefined ? {} : { language: imported.content.language }),
    ...(existing === undefined ? {} : {
      replacing: {
        devices: existing.devices.length,
        activities: existing.activities.length,
        buttons: existing.buttons.length,
        labels: existing.devices.filter((one) => one.label !== undefined).length,
      },
    }),
  };
}

/**
 * What the library already calls an appliance, for a summary to show beside a position on the remote.
 *
 * The reason a person cares whether an appliance was recognised: a configuration offers no manufacturer,
 * no model and no command names at all, so what survives an import is whatever they or Logitech's
 * catalogue put there. `undefined` where nothing has, which is every appliance that only ever came out
 * of a configuration.
 */
function describe(definition: DeviceDefinition): string | undefined {
  const words = [definition.manufacturer, definition.model].filter((one) => one !== undefined);
  return words.length === 0 ? undefined : words.join(' ');
}

/**
 * Commit the reading that is waiting: the bytes, the contents, and a library entry per appliance.
 *
 * **This replaces everything the document holds.** That is the decision of 22 August 2026 and it is why
 * the caller is expected to have shown `AttachedSummary.replacing` first. What is never lost is the
 * bytes: every reading is a file of its own with its own timestamp, so an earlier import can be
 * projected again even after this one.
 *
 * Three things happen that are worth naming separately, because each could go wrong on its own:
 *
 *   - **the document adopts the model the remote reported.** An import knows more than the chooser did,
 *     so a document created by picking `Harmony One` from a list records the skin its own remote states
 *   - **appliances go into the library and nothing is overwritten.** An entry already there may have been
 *     corrected by hand, named, or had a better code learned into it
 *   - **every reference to a linked appliance is rewritten onto the code it names**, per `relink.ts`,
 *     because identity is blind to the order the commands sit in and a button reference is not
 */
export async function importInto(
  store: RemoteStore, library: DeviceLibrary, name: string, token: string, now: () => string,
): Promise<ImportOutcome> {
  const ready = waiting;
  if (ready === undefined || ready.token !== token) {
    throw new Error('that reading is no longer held, so the remote has to be read again');
  }
  // The refusal that makes `pretend.ts` acceptable. A pretended reading may be looked at and may never be
  // filed, because a document saying it was read off a device has to have been.
  if (ready.pretended === true) {
    throw new Error('this reading came out of a file rather than off a remote, so it cannot be imported');
  }
  const outcome = await importReading(store, library, name, ready, now);
  waiting = undefined;
  return outcome;
}

/**
 * Everything importing does, given bytes, and **that is why it is a separate function**.
 *
 * The half above decides *which* bytes; this one is all of the behaviour. Keeping them together made the
 * behaviour reachable only through a remote on the bus, so the replacement, the model adoption, the
 * library filing and the rewrite of every button reference were between them untestable. A function whose
 * only route in is somebody's hardware is a function with no tests, which was not noticed until it was
 * time to write them.
 *
 * `reading` is what came off a remote: the bytes, and what that remote said about itself.
 */
export async function importReading(
  store: RemoteStore, library: DeviceLibrary, name: string,
  reading: { bytes: Uint8Array; skin?: number; model?: RemoteModel }, now: () => string,
): Promise<ImportOutcome> {
  const ready = reading;
  const document = await store.get(name);
  // Checked again rather than trusted: the summary may have been taken for a different document, or this
  // one may have been renamed or re-modelled in between. The reading knows which remote it came off.
  const refused = whyImportIsRefused(document.model, ready.skin);
  if (refused !== undefined) throw new Error(refused);

  // The same question as `AttachedSummary.replacing`, so the two cannot disagree: whether the document
  // held anything a person was looking at, however it came to be holding it.
  const replaced = (await contentsOf(store, library, name)) !== undefined;
  const at = now();
  await store.attachConfiguration(name, fileNameFor(at), ready.bytes, 'read-from-device', at);
  if (ready.model !== undefined) await store.setModel(name, ready.model);

  const digest = createHash('sha256').update(ready.bytes).digest('hex');
  const imported = importConfiguration(ready.bytes, { idPrefix: prefixFor(digest), now: at });
  const held = new Map((await library.list()).map((one) => [one.id, one]));

  const linked: string[] = [];
  const created: string[] = [];
  let content = imported.content;
  let moved = 0;
  let unmatched = 0;

  for (const use of imported.content.devices) {
    const provisional = imported.definitions.find((one) => one.id === use.definition);
    if (use.definition === undefined || provisional === undefined) continue;
    const already = held.get(use.definition);
    if (already === undefined) {
      await library.put(provisional);
      created.push(use.definition);
      continue;
    }
    linked.push(use.definition);
    const result = relinkAppliance(
      content, use.slot, matchBySignal(provisional.commands, already.commands));
    content = result.content;
    moved += result.moved;
    unmatched += result.unmatched;
  }

  await writeContent(store, name, content);
  return { linked, created, replaced, moved, unmatched };
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
 * **The stored contents win, and the projection is the fallback.** That is the import decision expressed
 * as a lookup order: a document that has been imported into holds its own contents, and those are what is
 * being edited. Projecting the bytes again would throw away everything added since.
 *
 * The fallback is not dead code and not a migration hack either. It carries the documents written before
 * `content.json` existed, and it is what makes a document usable the moment its bytes arrive even if
 * writing the contents failed. It costs a parse of a file this machine wrote, which is milliseconds.
 */
export async function contentsOf(
  store: RemoteStore, library: DeviceLibrary, name: string,
): Promise<DocumentContents | undefined> {
  const stored = await storedContentOf(store, name);
  if (stored !== undefined) {
    return { content: stored, missing: await library.missingFor(stored) };
  }

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

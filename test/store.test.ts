/**
 * The store, exercised with no Electron, no window and no documents folder on this machine.
 *
 * That this file can exist at all is the argument for the architecture rather than a convenience.
 * The store takes its root and its clock as arguments, so everything about how somebody's remotes are
 * kept can be driven from here, including the cases that are awkward to reach by clicking: a store
 * that does not exist yet, a folder that will not parse, a folder somebody copied in a file manager,
 * a name the file system will not accept.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { RemoteStore } from '../src/main/store/remotes.ts';
import { isWritable } from '../src/shared/remote.ts';

/** A store whose clock ticks one second per call, so every result here is exact rather than close. */
async function freshStore() {
  const root = await mkdtemp(join(tmpdir(), 'freeharmony-store-'));
  let tick = 0;
  const store = new RemoteStore({
    root,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
  });
  return { root, store, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('a store that has never been written to is empty rather than broken', async () => {
  // The first run of the application, which is the ordinary case and must not have to create
  // anything before it can draw a screen.
  const { root, store, cleanup } = await freshStore();
  await rm(root, { recursive: true, force: true });
  assert.deepEqual(await store.list(), []);
  await cleanup();
});

test('the folder is named after the remote, which is what makes it findable', async () => {
  // The reason the store moved into somebody's documents at all: they can open it and see what is
  // theirs. A folder named after a generated identifier would defeat that.
  const { root, store, cleanup } = await freshStore();
  await store.create('  Living room  ');

  assert.deepEqual(await readdir(root), ['Living room'], 'trimmed, and the folder carries the name');
  assert.deepEqual((await readdir(join(root, 'Living room'))).sort(), ['backups', 'remote.json']);
  await cleanup();
});

test('the manifest holds no name and no identifier, so no fact is in two places', async () => {
  // The design decision this store exists to demonstrate. If the name were in the manifest as well
  // as in the folder, the two would disagree the first time anybody renamed a folder in Finder.
  const { root, store, cleanup } = await freshStore();
  await store.create('study');

  const manifest = JSON.parse(await readFile(join(root, 'study', 'remote.json'), 'utf8')) as
    Record<string, unknown>;
  assert.deepEqual(Object.keys(manifest).sort(), ['createdAt', 'provenance', 'updatedAt']);
  await cleanup();
});

test('a created remote knows where it came from and that nothing is behind it', async () => {
  const { store, cleanup } = await freshStore();
  const remote = await store.create('bedroom');

  assert.equal(remote.name, 'bedroom');
  assert.equal(remote.provenance, 'created-empty');
  assert.equal(isWritable(remote), false, 'nothing behind it, so nothing to send');
  await cleanup();
});

test('a name the file system cannot hold is refused rather than quietly changed', async () => {
  // Refused, not transformed. A name silently turned into something else is the name the user meant,
  // lost, and they find out by reading a list that does not say what they typed.
  const { root, store, cleanup } = await freshStore();
  for (const [name, why] of [
    ['   ', /needs a name/],
    ['Living room / TV', /cannot contain/],
    ['..', /means something else/],
    ['bedroom.', /full stop/],
    ['NUL', /reserves/],
    ['x'.repeat(121), /too long/],
  ] as const) {
    await assert.rejects(() => store.create(name), why, name);
  }
  assert.deepEqual(await readdir(root), [], 'and nothing was created on the way');
  await cleanup();
});

test('two remotes cannot share a name, since the name is the folder', async () => {
  const { store, cleanup } = await freshStore();
  await store.create('bedroom');
  await assert.rejects(() => store.create('bedroom'), /already a remote called bedroom/);
  await cleanup();
});

test('renaming moves the folder, and there is no second place holding the old name', async () => {
  const { root, store, cleanup } = await freshStore();
  await store.create('bedrom');
  const fixed = await store.rename('bedrom', 'bedroom');

  assert.equal(fixed.name, 'bedroom');
  assert.deepEqual(await readdir(root), ['bedroom']);
  assert.notEqual(fixed.updatedAt, fixed.createdAt, 'a rename is a change to the remote');
  await cleanup();
});

test('renaming onto an existing name is refused, and so is renaming to an unusable one', async () => {
  const { root, store, cleanup } = await freshStore();
  await store.create('bedroom');
  await store.create('study');

  await assert.rejects(() => store.rename('study', 'bedroom'), /already a remote called/);
  await assert.rejects(() => store.rename('study', 'a/b'), /cannot contain/);
  assert.deepEqual((await readdir(root)).sort(), ['bedroom', 'study'], 'both survived intact');
  await cleanup();
});

test('the list is most recently changed first', async () => {
  const { store, cleanup } = await freshStore();
  await store.create('first');
  await store.create('second');
  await store.rename('first', 'first, renamed');

  assert.deepEqual((await store.list()).map((r) => r.name), ['first, renamed', 'second']);
  await cleanup();
});

test('a duplicate takes the first free name and carries the configuration, not the backups', async () => {
  // The rule the format forces: an entry is the configuration it started from plus what has been
  // changed, so a copy with no bytes behind it could never be sent anywhere. The backups are the
  // history of a different unit and deliberately stay with it.
  const { root, store, cleanup } = await freshStore();
  const bytes = new Uint8Array([1, 2, 3, 4]);
  await store.create('bedroom');
  await store.attachConfiguration('bedroom', 'config.bin', bytes, 'read-from-device');
  await writeFile(join(root, 'bedroom', 'backups', 'first-read.bin'), bytes);

  const first = await store.duplicate('bedroom');
  const second = await store.duplicate('bedroom');
  assert.equal(first.name, 'bedroom copy');
  assert.equal(second.name, 'bedroom copy 2');
  assert.equal(first.provenance, 'duplicated');
  assert.equal(isWritable(first), true);
  assert.deepEqual(new Uint8Array(await readFile(join(root, first.name, 'config.bin'))), bytes);
  assert.deepEqual(await readdir(join(root, first.name, 'backups')), [], 'the backups stayed behind');
  await cleanup();
});

test('attaching a configuration records its length and its digest and not its meaning', async () => {
  // The store stores bytes. What is in them is the library's business on the other side of the
  // boundary, and this is the assertion that says so: nothing here parses anything.
  const { store, cleanup } = await freshStore();
  await store.create('study');
  const updated = await store.attachConfiguration(
    'study', 'config.bin', new Uint8Array([0]), 'read-from-device', '2026-08-16T10:00:00.000Z');

  assert.equal(updated.baseConfiguration?.byteLength, 1);
  assert.equal(updated.baseConfiguration?.readAt, '2026-08-16T10:00:00.000Z');
  assert.equal(
    updated.baseConfiguration?.sha256,
    '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d',
    'the digest of a single zero byte, so a stored file can be checked rather than trusted',
  );
  await cleanup();
});

test('a folder copied in a file manager is simply another remote', async () => {
  // The payoff of the name being the identity, and the case that decided it. With an identifier in
  // the manifest this would be two entries claiming to be the same remote, and something would have
  // to notice and repair it. Here there is nothing to repair.
  const { root, store, cleanup } = await freshStore();
  await store.create('bedroom');
  await cp(join(root, 'bedroom'), join(root, 'bedroom spare'), { recursive: true });

  assert.deepEqual((await store.list()).map((r) => r.name).sort(), ['bedroom', 'bedroom spare']);
  await cleanup();
});

test('one unreadable folder costs one remote, which is why there is no index file', async () => {
  // The reason the store is a folder per remote rather than one list. A half written index loses
  // every entry; a folder that will not parse loses itself.
  const { root, store, cleanup } = await freshStore();
  await store.create('good');
  await mkdir(join(root, 'broken'), { recursive: true });
  await writeFile(join(root, 'broken', 'remote.json'), 'not json at all');

  assert.deepEqual((await store.list()).map((r) => r.name), ['good']);
  await cleanup();
});

test('removing a remote takes everything under it, and removing a missing one is an error', async () => {
  const { root, store, cleanup } = await freshStore();
  await store.create('gone');
  await store.remove('gone');

  assert.deepEqual(await readdir(root), []);
  await assert.rejects(() => store.remove('gone'), /there is no remote called gone/);
  await cleanup();
});

/**
 * The store, exercised with no Electron, no window and no user data on this machine.
 *
 * That this file can exist at all is the argument for the architecture rather than a convenience.
 * The store takes its root, its clock and its identity source as arguments, so everything about how
 * somebody's remotes are kept can be driven from here, including the cases that are awkward to reach
 * by clicking: a store that does not exist yet, a directory that will not parse, a duplicate whose
 * original has a configuration behind it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { RemoteStore } from '../src/main/store/remotes.ts';
import { isWritable } from '../src/shared/remote.ts';

/** A store with a clock that ticks one second per call and identities that count, so results are exact. */
async function freshStore() {
  const root = await mkdtemp(join(tmpdir(), 'freeharmony-store-'));
  let tick = 0;
  let next = 0;
  const store = new RemoteStore({
    root,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
    nextId: () => `id-${++next}`,
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

test('a created remote has a name, an identity and no configuration behind it', async () => {
  const { store, cleanup } = await freshStore();
  const remote = await store.create('  Living room  ');

  assert.equal(remote.name, 'Living room', 'the name is trimmed here rather than in a form');
  assert.equal(remote.id, 'id-1');
  assert.equal(remote.provenance, 'created-empty');
  assert.equal(isWritable(remote), false, 'nothing behind it, so nothing to send');
  await cleanup();
});

test('a remote with no name is refused, because a row nobody can tell apart is worse than none', async () => {
  const { store, cleanup } = await freshStore();
  await assert.rejects(() => store.create('   '), /needs a name/);
  assert.deepEqual(await store.list(), []);
  await cleanup();
});

test('the list is most recently changed first', async () => {
  const { store, cleanup } = await freshStore();
  await store.create('first');
  await store.create('second');
  await store.rename('id-1', 'first, renamed');

  assert.deepEqual((await store.list()).map((r) => r.name), ['first, renamed', 'second']);
  await cleanup();
});

test('a duplicate carries the configuration and not the backups', async () => {
  // The rule the format forces: an entry is the configuration it started from plus what has been
  // changed, so a copy with no bytes behind it could never be sent anywhere. The backups are the
  // history of a different unit and deliberately stay with it.
  const { root, store, cleanup } = await freshStore();
  const original = await store.create('bedroom');
  const bytes = new Uint8Array([1, 2, 3, 4]);
  await store.attachConfiguration(original.id, 'config.bin', bytes, 'read-from-device');
  await writeFile(join(root, original.id, 'backups', 'first-read.bin'), bytes);

  const copy = await store.duplicate(original.id);
  assert.equal(copy.provenance, 'duplicated');
  assert.equal(copy.name, 'bedroom copy');
  assert.notEqual(copy.id, original.id);
  assert.equal(isWritable(copy), true);
  assert.deepEqual(new Uint8Array(await readFile(join(root, copy.id, 'config.bin'))), bytes);
  await assert.rejects(() => readFile(join(root, copy.id, 'backups', 'first-read.bin')));
  await cleanup();
});

test('attaching a configuration records its length and its digest and not its meaning', async () => {
  // The store stores bytes. What is in them is the library's business on the other side of the
  // boundary, and this is the assertion that says so: nothing here parses anything.
  const { store, cleanup } = await freshStore();
  const remote = await store.create('study');
  const updated = await store.attachConfiguration(
    remote.id, 'config.bin', new Uint8Array([0]), 'read-from-device', '2026-08-16T10:00:00.000Z');

  assert.equal(updated.baseConfiguration?.byteLength, 1);
  assert.equal(updated.baseConfiguration?.readAt, '2026-08-16T10:00:00.000Z');
  assert.equal(
    updated.baseConfiguration?.sha256,
    '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d',
    'the digest of a single zero byte, so a stored file can be checked rather than trusted',
  );
  await cleanup();
});

test('one unreadable remote costs one remote, which is why there is no index file', async () => {
  // The reason the store is a directory per remote rather than one list. A half written index loses
  // every entry; a directory that will not parse loses itself.
  const { root, store, cleanup } = await freshStore();
  await store.create('good');
  await mkdir(join(root, 'broken'), { recursive: true });
  await writeFile(join(root, 'broken', 'remote.json'), 'not json at all');

  assert.deepEqual((await store.list()).map((r) => r.name), ['good']);
  await cleanup();
});

test('the directory name is the identity, so a document that disagrees is corrected', async () => {
  // Somebody copies a directory by hand to make a second remote. Believing the file would give two
  // entries the same id, and then the list would show one of them twice.
  const { root, store, cleanup } = await freshStore();
  const original = await store.create('one');
  await mkdir(join(root, 'copied-by-hand'), { recursive: true });
  await writeFile(join(root, 'copied-by-hand', 'remote.json'),
                  await readFile(join(root, original.id, 'remote.json'), 'utf8'));

  const ids = (await store.list()).map((r) => r.id).sort();
  assert.deepEqual(ids, ['copied-by-hand', 'id-1']);
  await cleanup();
});

test('removing a remote takes everything under it, and removing a missing one is an error', async () => {
  const { store, cleanup } = await freshStore();
  const remote = await store.create('gone');
  await store.remove(remote.id);
  assert.deepEqual(await store.list(), []);
  await assert.rejects(() => store.remove(remote.id), /no remote with id/);
  await cleanup();
});

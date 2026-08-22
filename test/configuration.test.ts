/**
 * A document with a real configuration behind it, from the bytes on disk to the model the window sees.
 *
 * This is the join `test/store.test.ts` and `test/import.test.ts` each cover one half of: the store
 * knows how to keep bytes and not what they mean, the import knows what they mean and nothing about
 * disks, and everything that goes wrong at a seam goes wrong here.
 *
 * **The hardware half is not in this file and cannot be.** `readConfigurationFrom` opens a remote, so
 * what is exercised below is every step after the transfer: attaching, reading back, filing appliances
 * into the shared library. The transfer itself is the sibling repository's `readConfig`, with its own
 * two checks and its own tests, and the only thing here that would have caught a fault in it is that
 * nothing is attached to a document unless it passed them.
 *
 * Needs a lab and skips without one, per the neighbour's rule, since this repository holds no
 * configuration of anybody's.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { require_, skipUnless } from '@harmony/lab';

import { contentsOf, fileDefinitionsOf } from '../src/main/configuration.ts';
import { DeviceLibrary } from '../src/main/store/library.ts';
import { RemoteStore } from '../src/main/store/remotes.ts';

/** Two architectures, because one proves much less than two, and the smaller pair reads faster. */
const SAMPLES = ['h600_config', 'h525_config'] as const;

const NOW = '2026-08-21T12:00:00.000Z';

interface Bench {
  readonly store: RemoteStore;
  readonly library: DeviceLibrary;
  readonly root: string;
}

async function bench(): Promise<Bench> {
  const root = await mkdtemp(join(tmpdir(), 'freeharmony-configuration-'));
  return {
    root,
    store: new RemoteStore({ root: join(root, 'remotes'), now: () => NOW }),
    library: new DeviceLibrary({ root: join(root, 'devices') }),
  };
}

/** A document with a real configuration attached, which is what every test below starts from. */
async function documentFrom(at: Bench, sample: string): Promise<string> {
  const name = 'living room';
  await at.store.create(name, { name: 'Harmony 600' });
  await at.store.attachConfiguration(name, 'configuration.bin', require_(sample),
                                     'read-from-device', NOW);
  return name;
}

test('a document with no configuration holds nothing, and says so as nothing',
     async () => {
  // The ordinary state of a document somebody made by picking a model from a list, and the reason the
  // answer is `undefined` rather than an empty model: a remote drawn with no devices would be a claim
  // about somebody's equipment, and there is no claim to make.
  const at = await bench();
  try {
    await at.store.create('empty one', { name: 'Harmony One' });
    assert.equal(await contentsOf(at.store, at.library, 'empty one'), undefined);
    assert.deepEqual(await fileDefinitionsOf(at.store, at.library, 'empty one', () => NOW),
                     { added: [], kept: [] });
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a configuration on disk reads back as devices, activities and buttons',
     skipUnless(...SAMPLES), async () => {
  // Exact per sample, as `test/import.test.ts` is, and for the same reason: a total hides which side
  // moved. These are that file's own figures, which is the point of asserting them again here. They
  // arrive through a different route, off a disk rather than out of a fixture, and a seam that dropped
  // something would show up as a number that no longer matches its neighbour.
  // The three binding populations rather than one total, per `test/import.test.ts`: an activity's map,
  // the screen keys, and the device's own map, which is what device mode uses.
  const expected = { h600_config: { devices: 4, activities: 3, activity: 74, screen: 155, map: 68 },
                     h525_config: { devices: 4, activities: 3, activity: 90, screen: 130, map: 54 },
                   } as const;

  for (const sample of SAMPLES) {
    const at = await bench();
    try {
      const name = await documentFrom(at, sample);
      const found = await contentsOf(at.store, at.library, name);
      assert.ok(found !== undefined, sample);
      assert.equal(found.content.devices.length, expected[sample].devices, `${sample}: devices`);
      assert.equal(found.content.activities.length, expected[sample].activities, `${sample}: activities`);
      const buttons = found.content.buttons;
      assert.deepEqual({
        activity: buttons.filter((one) => one.inActivity !== undefined).length,
        screen: buttons.filter((one) => one.surface === 'screen').length,
        map: buttons.filter((one) => one.surface === 'keypad' && one.inActivity === undefined).length,
      }, { activity: expected[sample].activity, screen: expected[sample].screen,
           map: expected[sample].map }, `${sample}: bindings, per population`);
      assert.equal(found.content.filledFrom, 'a-configuration');
    } finally {
      await rm(at.root, { recursive: true, force: true });
    }
  }
});

test('every appliance a document drives is named as missing until the read files it',
     skipUnless(...SAMPLES), async () => {
  // The two halves of the library sitting outside the document, in one test because neither means
  // anything without the other: a document names appliances, and until somebody files them this
  // machine has not got them.
  const at = await bench();
  try {
    const name = await documentFrom(at, 'h600_config');

    const before = await contentsOf(at.store, at.library, name);
    assert.equal(before?.missing.length, 4, 'nothing is in the library yet, so all four are missing');

    const filed = await fileDefinitionsOf(at.store, at.library, name, () => NOW);
    assert.equal(filed.added.length, 4);
    assert.deepEqual(filed.kept, []);
    assert.equal((await at.library.list()).length, 4);

    const after = await contentsOf(at.store, at.library, name);
    assert.deepEqual(after?.missing, [], 'and now none of them is');
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('filing twice keeps what is there rather than overwriting it',
     skipUnless(...SAMPLES), async () => {
  // The rule that makes the library worth having: a definition can be corrected by hand, given a
  // manufacturer, or have a better code learned into it, and a second import must not discard that.
  const at = await bench();
  try {
    const name = await documentFrom(at, 'h600_config');
    const filed = await fileDefinitionsOf(at.store, at.library, name, () => NOW);
    const first = filed.added[0]!;

    // Somebody says what one of them is, which is the whole point of a definition being editable.
    await at.library.put({ ...(await at.library.get(first)), manufacturer: 'A manufacturer' });

    const again = await fileDefinitionsOf(at.store, at.library, name, () => NOW);
    assert.deepEqual(again.added, [], 'nothing is new the second time');
    assert.equal(again.kept.length, 4);
    assert.equal((await at.library.get(first)).manufacturer, 'A manufacturer',
                 'and what somebody typed survived a re-import');
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('reading a document twice gives the same answer, so nothing is stamped by a clock',
     skipUnless(...SAMPLES), async () => {
  // A query has to be a query. `contentsOf` builds provisional definitions on its way past and throws
  // them away, and if it stamped them with the wall clock then two identical reads would differ, which
  // is the sort of thing that only shows up as a screen flickering or a diff that will not settle.
  const at = await bench();
  try {
    const name = await documentFrom(at, 'h525_config');
    const once = await contentsOf(at.store, at.library, name);
    const twice = await contentsOf(at.store, at.library, name);
    assert.deepEqual(once, twice);
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('the configuration file sits in the document folder and the manifest describes it',
     skipUnless(...SAMPLES), async () => {
  // Where somebody's own bytes end up, asserted because it is in their documents folder and they are
  // entitled to know. The digest is what will let a later read say the file changed under it.
  const at = await bench();
  try {
    const name = await documentFrom(at, 'h600_config');
    const document = await at.store.get(name);
    assert.equal(document.baseConfiguration?.fileName, 'configuration.bin');
    assert.equal(document.baseConfiguration?.byteLength, require_('h600_config').byteLength);
    assert.match(document.baseConfiguration?.sha256 ?? '', /^[0-9a-f]{64}$/);
    assert.deepEqual((await readdir(at.store.folderOf(name))).sort(),
                     ['backups', 'configuration.bin', 'remote.json']);
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

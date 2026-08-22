/**
 * The device library on disk, against a temporary directory.
 *
 * The same shape as `test/store.test.ts`: the store takes its root as an argument, so all of this runs
 * with no window, no application and nothing in anybody's documents folder.
 *
 * What is worth testing here is not that a file can be written. It is the three rules the placement of
 * this library outside the document brought with it: that a definition's identifier is safe as a file
 * name, that a document referring to a definition this machine has not got can be **told** so rather
 * than discovering it on screen, and that two descriptions of one appliance are reported and never
 * merged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { RemoteContent } from '../src/shared/content.ts';
import type { DeviceDefinition, Pulse } from '../src/shared/library.ts';
import { DeviceLibrary } from '../src/main/store/library.ts';

const AT = '2026-08-21T12:00:00.000Z';

/** A definition with one command, whose pulses are what makes it the same appliance or a different one. */
function television(id: string, pulses: readonly Pulse[]): DeviceDefinition {
  return {
    id,
    kind: 'television',
    commands: [{ slot: 0, signal: { carrierHz: 38000, once: pulses }, origin: 'from-a-configuration' }],
    properties: [],
    timing: {},
    origin: 'from-a-configuration',
    addedAt: AT,
  };
}

const ON: readonly Pulse[] = [{ mark: true, us: 9000 }, { mark: false, us: 4500 }];
const OFF: readonly Pulse[] = [{ mark: true, us: 8000 }, { mark: false, us: 4000 }];

async function library(): Promise<{ library: DeviceLibrary; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'freeharmony-library-'));
  return { library: new DeviceLibrary({ root }), root };
}

test('an empty machine has an empty library rather than an error', async () => {
  // The first run of the application, which must not have to create anything before it shows a screen.
  const { library: held, root } = await library();
  try {
    assert.deepEqual(await held.list(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a definition is written, read back and corrected, and its file is named after it', async () => {
  const { library: held, root } = await library();
  try {
    await held.put(television('a-television', ON));
    assert.deepEqual(await readdir(root), ['a-television.json']);
    assert.equal((await held.get('a-television')).kind, 'television');

    // A correction is the same call, because a definition has no state to protect: everything about it
    // can be wrong and its identifier is the only thing that must not move.
    await held.put({ ...television('a-television', ON), manufacturer: 'A manufacturer' });
    assert.equal((await held.get('a-television')).manufacturer, 'A manufacturer');
    assert.deepEqual(await readdir(root), ['a-television.json'], 'a correction is not a second file');

    await held.remove('a-television');
    assert.deepEqual(await readdir(root), []);
    await assert.rejects(held.get('a-television'), /no device definition called/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an identifier that could escape its folder is refused', async () => {
  // The identifier becomes a file name, so it is the one field with a path traversal in it if nobody
  // looks. Refused rather than sanitised, by the same argument `whyNameIsRefused` makes for a remote's
  // name: a value quietly turned into something else is the value the caller meant, lost.
  const { library: held, root } = await library();
  try {
    for (const bad of ['../escape', 'Maker/Model', 'has space', 'UPPER', '', '.', 'x'.repeat(121)]) {
      await assert.rejects(held.put(television(bad, ON)), /not a usable identifier/, bad);
    }
    assert.deepEqual(await readdir(root), [], 'and none of them wrote anything');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a file that will not parse costs one appliance and not the library', async () => {
  // The reason there is no index. A half written index loses every entry.
  const { library: held, root } = await library();
  try {
    await held.put(television('good-one', ON));
    await writeFile(join(root, 'broken.json'), '{ this is not json', 'utf8');
    const found = await held.list();
    assert.deepEqual(found.map((one) => one.id), ['good-one']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a document can be told which appliances this machine has not got', async () => {
  // The cost of keeping the library outside the document, and the whole reason this method exists: a
  // screen should be able to say what is missing rather than draw holes where a television should be.
  const { library: held, root } = await library();
  try {
    await held.put(television('here', ON));
    const content: RemoteContent = {
      devices: [
        { slot: 0, definition: 'here' },
        { slot: 1, definition: 'elsewhere' },
        // A device with no definition at all is the ordinary state of an import and is not missing:
        // nothing was promised, so nothing is absent. Only a named definition can be missing.
        { slot: 2 },
      ],
      activities: [], buttons: [], filledFrom: 'a-configuration',
    };
    assert.deepEqual(await held.missingFor(content), ['elsewhere']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('two descriptions of one appliance are reported and nothing is merged', async () => {
  const { library: held, root } = await library();
  try {
    // Two imports of the same television from two remotes, which is exactly what a shared library
    // invites. They are the same appliance because they send the same thing, which is decidable
    // without knowing what either of them is.
    await held.put({ ...television('from-living-room', ON), model: 'A model' });
    await held.put(television('from-bedroom', ON));
    await held.put(television('an-amplifier', OFF));

    const groups = await held.likelyDuplicates();
    assert.equal(groups.length, 1, 'one pair, and the amplifier is not in it');
    assert.deepEqual(groups[0]?.map((one) => one.id).sort(), ['from-bedroom', 'from-living-room']);

    // And nothing moved. Merging changes what every document pointing at either one is pointing at,
    // so it is a decision for a person; a library that merged on its own could silently change what a
    // remote does.
    assert.deepEqual((await readdir(root)).sort(),
                     ['an-amplifier.json', 'from-bedroom.json', 'from-living-room.json']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an appliance with nothing to send is not a duplicate of every other empty one', async () => {
  // The trap in comparing by what a thing sends: two appliances that send nothing agree perfectly.
  // That is an absence rather than a match, and a library that reported it would offer to merge every
  // half finished definition with every other.
  const { library: held, root } = await library();
  try {
    const empty = (id: string): DeviceDefinition =>
      ({ ...television(id, ON), commands: [] });
    await held.put(empty('nothing-yet'));
    await held.put(empty('also-nothing'));
    assert.deepEqual(await held.likelyDuplicates(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a name is not what makes two appliances the same, and pulses are', async () => {
  // The rule stated as its own test because it is the reason the comparison reads pulses at all: a
  // person calls the same television different things on two remotes, and it is still one television.
  const { library: held, root } = await library();
  try {
    await held.put({ ...television('one-name', ON), manufacturer: 'A maker', model: 'A' });
    await held.put({ ...television('other-name', ON), manufacturer: 'A makr', model: 'B' });
    assert.equal((await held.likelyDuplicates()).length, 1);

    // And the control: the same names with different pulses are not one appliance.
    await held.remove('other-name');
    await held.put({ ...television('other-name', OFF), manufacturer: 'A maker', model: 'A' });
    assert.deepEqual(await held.likelyDuplicates(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

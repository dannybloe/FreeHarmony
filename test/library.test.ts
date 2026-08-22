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
import { mayBeShared } from '../src/shared/library.ts';
import { cloneDefinition, createDefinition } from '../src/main/library.ts';
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

/**
 * The same thing with the cleanup folded in, for the tests below that do not need the root itself.
 *
 * Added rather than repeating a `try` and a `finally` per test: the tests above want the path, because they
 * check what the files are called, and these ones only want a library.
 */
async function withLibrary(body: (library: DeviceLibrary) => Promise<void>): Promise<void> {
  const { library: held, root } = await library();
  try {
    await body(held);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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

// Writing one down by hand, and copying one. Both are composed in `src/main/library.ts` out of the
// store's own `get` and `put`, so what is worth testing is the policy they add: the origin, the words,
// and above all the identifiers, because an identifier is the one thing about a definition that can never
// be corrected afterwards.

test('an appliance written down by hand is typed-here, and that is not shareable', async () => {
await withLibrary(async (held) => {
      const made = await createDefinition(held, { kind: 'receiver', name: 'The study one' }, AT);

    assert.equal(made.origin, 'typed-here');
    // The whole reason for a fourth origin value rather than reusing the nearest of the three: nothing was
    // learned from any hardware, so this may never be shared, and filling in `learned-here` would have put
    // a falsehood in the one field this model cannot repair in hindsight.
    assert.equal(mayBeShared(made.origin), false);
    assert.equal(made.name, 'The study one');
    assert.equal(made.kind, 'receiver');
    assert.deepEqual(made.commands, []);
    assert.equal(made.addedAt, AT);
    // And it is on disk under an identifier the store accepts as a file name, which is the constraint that
    // a hand minted identifier is most likely to break.
    assert.deepEqual(await held.get(made.id), made);});
});

test('an empty field is left out rather than stored as an empty string', async () => {
await withLibrary(async (held) => {
      // What a form hands back for a field nobody filled in. An empty string would satisfy every presence
    // test and then render as nothing, which is a field that looks filled in and is not.
    const made = await createDefinition(
      held, { kind: 'other', name: '  ', manufacturer: 'Sony', model: '' }, AT);

    assert.equal(made.name, undefined);
    assert.equal(made.model, undefined);
    assert.equal(made.manufacturer, 'Sony');
    // Trimmed as well, so a trailing space cannot make two makes look like two makes.
    assert.equal((await createDefinition(held, { kind: 'other', model: ' X1 ' }, AT)).model, 'X1');});
});

test('two hand written appliances never share an identifier, however alike they are', async () => {
await withLibrary(async (held) => {
      const draft = { kind: 'television' as const, manufacturer: 'LG', model: 'OLED55' };
    const first = await createDefinition(held, draft, AT);
    const second = await createDefinition(held, draft, AT);

    // Identical in every field a person typed, and still two appliances: somebody with two of the same
    // television has two of them, and a digest of the typed words would have made them one row.
    assert.notEqual(first.id, second.id);
    assert.equal((await held.list()).length, 2);});
});

test('an identifier is never reused, so a deleted appliance cannot be resurrected under a new one',
     async () => {
await withLibrary(async (held) => {
      const first = await createDefinition(held, { kind: 'television' }, AT);
    await held.remove(first.id);
    const second = await createDefinition(held, { kind: 'television' }, AT);

    // The failure this rules out is silent and it is the reason the identifier is random rather than the
    // lowest free number: a document still naming the old appliance would quietly be pointing at the new
    // one, and every button on it would send the wrong thing with nothing to say so.
    assert.notEqual(first.id, second.id);});
});

test('a copy is a second appliance with the same codes and the same provenance', async () => {
await withLibrary(async (held) => {
      const original = await held.put({ ...television('appliance-abc', ON), origin: 'learned-here' });
    const copy = await cloneDefinition(held, original.id, 'The bedroom one');

    assert.notEqual(copy.id, original.id);
    assert.equal(copy.name, 'The bedroom one');
    assert.deepEqual(copy.commands, original.commands);
    // The origin is carried and not restamped, which is the decision worth pinning: a copy of a description
    // learned from real hardware still describes what that hardware sends, so it stays shareable. Stamping
    // `typed-here` here would throw away a true provenance that cannot be recovered.
    assert.equal(copy.origin, 'learned-here');
    assert.equal(mayBeShared(copy.origin), true);

    // And the held now reports them as probably one appliance, which is exactly right: they are one
    // appliance described twice, and it reports rather than merging because only a person can know that.
    const groups = await held.likelyDuplicates();
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]?.map((one) => one.id).sort(), [copy.id, original.id].sort());});
});

test('a copy without a new name keeps the old one, so nothing is silently blanked', async () => {
await withLibrary(async (held) => {
      await held.put({ ...television('appliance-abc', ON), name: 'The big one' });
    assert.equal((await cloneDefinition(held, 'appliance-abc')).name, 'The big one');
    // An empty string is the other thing a form hands back, and it means "I typed nothing" rather than
    // "call it nothing".
    assert.equal((await cloneDefinition(held, 'appliance-abc', '')).name, 'The big one');});
});

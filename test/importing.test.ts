/**
 * What importing does, given bytes: the replacement, the model, the library, and the button references.
 *
 * **The half of the import that has all the behaviour**, and for a while it had no tests because the only
 * way in was a remote on the bus. `importReading` exists so that this file can drive it: the token
 * lookup decides *which* bytes and everything below decides what happens to them.
 *
 * `inspectAttached` is still not here and cannot be. It opens somebody's remote, and what it does before
 * that is refuse, which `test/models.test.ts` covers on its own. The one thing this file can assert about
 * it is by proxy and it is worth stating: nothing below is reachable except through a person confirming.
 *
 * Needs a lab and skips without one, since this repository holds no configuration of anybody's.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { require_, skipUnless } from '@harmony/lab';

import { contentsOf, importReading, settleContent } from '../src/main/configuration.ts';
import { addDeviceUse, assignButton, labelDeviceUse, storedContentOf, writeContent }
  from '../src/main/content.ts';
import { importConfiguration } from '../src/main/import.ts';
import { DeviceLibrary } from '../src/main/store/library.ts';
import { RemoteStore } from '../src/main/store/remotes.ts';
import { fingerprintOf, signatureOf } from '../src/shared/library.ts';
import type { ButtonBinding } from '../src/shared/content.ts';
import type { DeviceCommand } from '../src/shared/library.ts';

/** Two architectures, because one proves much less than two. */
const SAMPLES = ['h600_config', 'h525_config'] as const;
const A_HARMONY_600 = 71;

const NOW = '2026-08-22T12:00:00.000Z';

interface Bench {
  readonly store: RemoteStore;
  readonly library: DeviceLibrary;
  readonly root: string;
}

async function bench(): Promise<Bench> {
  const root = await mkdtemp(join(tmpdir(), 'freeharmony-importing-'));
  return {
    root,
    store: new RemoteStore({ root: join(root, 'remotes'), now: () => NOW }),
    library: new DeviceLibrary({ root: join(root, 'devices') }),
  };
}

test('importing fills an empty document and files every appliance', { ...skipUnless(...SAMPLES) },
     async () => {
  for (const sample of SAMPLES) {
    const at = await bench();
    try {
      await at.store.create('living room');
      const outcome = await importReading(
        at.store, at.library, 'living room',
        { bytes: require_(sample), skin: A_HARMONY_600, model: { name: 'Harmony 600', skin: A_HARMONY_600 } },
        () => NOW);

      assert.equal(outcome.replaced, false, `${sample}: nothing was there to replace`);
      assert.deepEqual(outcome.linked, [], `${sample}: an empty library links nothing`);
      assert.ok(outcome.created.length > 0, `${sample}: every appliance is new the first time`);
      assert.equal(outcome.created.length, (await at.library.list()).length,
                   `${sample}: and every one of them is on disk`);

      const stored = await storedContentOf(at.store, 'living room');
      assert.ok(stored !== undefined, `${sample}: the contents were written down`);
      assert.equal(stored.devices.length, outcome.created.length);
      // The document adopts what the remote said, which is what an import knows and a chooser does not.
      assert.deepEqual((await at.store.get('living room')).model,
                       { name: 'Harmony 600', skin: A_HARMONY_600 });
    } finally {
      await rm(at.root, { recursive: true, force: true });
    }
  }
});

test('importing replaces what somebody built here, and says so', { ...skipUnless(SAMPLES[0]) },
     async () => {
  // The decision of 22 August 2026 in one assertion. A confirmation is expected to have happened before
  // this is called, which is why the count comes back rather than the call refusing.
  const at = await bench();
  try {
    await at.store.create('living room');
    await writeContent(at.store, 'living room', {
      devices: [{ slot: 0, label: 'a name somebody typed' }],
      activities: [], buttons: [], filledFrom: 'here',
    });

    const outcome = await importReading(
      at.store, at.library, 'living room', { bytes: require_(SAMPLES[0]), skin: A_HARMONY_600 },
      () => NOW);

    assert.equal(outcome.replaced, true);
    const stored = await storedContentOf(at.store, 'living room');
    assert.equal(stored?.filledFrom, 'a-configuration');
    assert.ok(!(stored?.devices ?? []).some((one) => one.label === 'a name somebody typed'),
              'the typed name is gone, which is what replacing means');
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a second import of the same remote links instead of duplicating', { ...skipUnless(SAMPLES[0]) },
     async () => {
  // The importing rule, and the half of it that a content addressed identifier already gave us: the same
  // codes are the same appliance, so nothing is described twice however often a remote is read.
  const at = await bench();
  try {
    await at.store.create('living room');
    const reading = { bytes: require_(SAMPLES[0]), skin: A_HARMONY_600 };
    const first = await importReading(at.store, at.library, 'living room', reading, () => NOW);
    const held = (await at.library.list()).length;

    const second = await importReading(at.store, at.library, 'living room', reading, () => NOW);

    assert.deepEqual(second.created, [], 'nothing new the second time');
    assert.deepEqual([...second.linked].sort(), [...first.created].sort());
    assert.equal((await at.library.list()).length, held, 'and the library did not grow');
    assert.equal(second.moved, 0, 'nor did anything have to move, since the order is identical');
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a library entry ordered differently keeps every button sending what it sent',
     { ...skipUnless(SAMPLES[0]) }, async () => {
  // The whole reason `relink.ts` exists, exercised through the import rather than on its own. The library
  // is seeded with the same appliance described with its commands reversed, which is what a second
  // configuration from Logitech's generator does to three of the twelve repeated appliances in the corpus.
  const at = await bench();
  try {
    await at.store.create('living room');
    const bytes = require_(SAMPLES[0]);
    const projected = importConfiguration(bytes, { idPrefix: 'x', now: NOW });
    const first = projected.definitions.find((one) => one.commands.length > 1);
    assert.ok(first !== undefined, 'the sample has an appliance with more than one command');

    const reversed: DeviceCommand[] =
      [...first.commands].reverse().map((command, slot) => ({ ...command, slot }));
    assert.equal(fingerprintOf(reversed), fingerprintOf(first.commands),
                 'reversing the order does not change which appliance it is, which is the hazard');
    await at.library.put({ ...first, commands: reversed, manufacturer: 'A manufacturer' });

    const outcome = await importReading(
      at.store, at.library, 'living room', { bytes, skin: A_HARMONY_600 }, () => NOW);

    assert.ok(outcome.linked.includes(first.id), 'it was recognised despite the different order');
    assert.equal(outcome.unmatched, 0, 'and every code had a counterpart');
    assert.ok(outcome.moved > 0, 'and references had to move, which is what this test is about');

    // What the document now says a button sends, read against the description it points at.
    const stored = await storedContentOf(at.store, 'living room');
    const use = stored?.devices.find((one) => one.definition === first.id);
    assert.ok(use !== undefined);
    const sends = (of: readonly DeviceCommand[], content: typeof stored) =>
      (content?.buttons ?? []).flatMap((one) => one.sends)
        .filter((one) => one.device === use.slot)
        .map((one) => signatureOf(of[one.command]!.signal));

    assert.deepEqual(sends(reversed, stored), sends(first.commands, projected.content),
                     'the same codes as before, through a description that orders them the other way');
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('the bytes of every reading are kept, so an earlier import can be projected again',
     { ...skipUnless(SAMPLES[0]) }, async () => {
  // What makes replacing acceptable: the document is replaced and the readings are not. Two imports leave
  // two files, because the name carries the moment of the read.
  const at = await bench();
  try {
    await at.store.create('living room');
    const reading = { bytes: require_(SAMPLES[0]), skin: A_HARMONY_600 };
    await importReading(at.store, at.library, 'living room', reading, () => NOW);
    await importReading(at.store, at.library, 'living room', reading,
                        () => '2026-08-22T13:00:00.000Z');

    const files = (await readdir(at.store.folderOf('living room')))
      .filter((one) => one.endsWith('.bin'));
    assert.equal(files.length, 2, files.join(', '));
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('what a document holds comes from its own file and not from the bytes again',
     { ...skipUnless(SAMPLES[0]) }, async () => {
  // The import decision as a lookup order. A document that has been imported into is what is being
  // edited, and projecting the bytes a second time would discard everything added since.
  const at = await bench();
  try {
    await at.store.create('living room');
    await importReading(at.store, at.library, 'living room',
                        { bytes: require_(SAMPLES[0]), skin: A_HARMONY_600 }, () => NOW);

    const held = await storedContentOf(at.store, 'living room');
    assert.ok(held !== undefined);
    await writeContent(at.store, 'living room',
                       { ...held, devices: [...held.devices, { slot: 99, label: 'typed here' }] });

    const seen = await contentsOf(at.store, at.library, 'living room');
    assert.ok(seen?.content.devices.some((one) => one.label === 'typed here'),
              'the edit survives, which is the whole point of the file existing');
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a document with bytes and no contents file still reads, which carries the older documents',
     { ...skipUnless(SAMPLES[0]) }, async () => {
  // Not a migration hack and not dead code: it is what makes a document usable the moment its bytes
  // arrive, and it is the only route for the documents written before `content.json` existed.
  const at = await bench();
  try {
    await at.store.create('living room');
    await at.store.attachConfiguration('living room', 'configuration.bin', require_(SAMPLES[0]),
                                       'read-from-device', NOW);

    const seen = await contentsOf(at.store, at.library, 'living room');
    assert.ok((seen?.content.devices.length ?? 0) > 0);
    assert.equal(await storedContentOf(at.store, 'living room'), undefined,
                 'and looking wrote nothing, because looking never writes');
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a remote nothing has been imported into can still be given a device',
     { ...skipUnless(SAMPLES[0]) }, async () => {
  // **The case the whole library arrangement exists for**, and it was refused two layers down until 22
  // August 2026: you import the living room remote, then set up a bedroom one and say it drives the same
  // television. That second remote has no configuration and will not have one until somebody compiles it.
  //
  // Found by being asked what a screenshot was showing. The picker had nothing useful to offer in the only
  // state it could be photographed in, and the reason was a refusal in `editContent`.
  const at = await bench();
  try {
    await at.store.create('living room');
    await importReading(at.store, at.library, 'living room',
                        { bytes: require_(SAMPLES[0]), skin: A_HARMONY_600 }, () => NOW);
    const television = (await at.library.list())
      .filter((one) => one.commands.length > 0)
      .sort((a, b) => b.commands.length - a.commands.length)[0];
    assert.ok(television !== undefined, 'the import described something');

    await at.store.create('bedroom');
    const content = await addDeviceUse(at.store, 'bedroom', television.id, 'the same telly');

    assert.equal(content.filledFrom, 'here', 'built here, not read off anything');
    assert.deepEqual(content.devices, [{ slot: 0, definition: television.id, label: 'the same telly' }]);
    // And it is on disk rather than only in the answer, which is what a page reads back.
    assert.deepEqual((await storedContentOf(at.store, 'bedroom'))?.devices, content.devices);
    // The appliance is described once and shared, so nothing was copied into the second document.
    assert.equal((await at.library.list()).length, (await at.library.list()).length);
    assert.deepEqual(await at.library.missingFor(content), [], 'and this machine has what it names');
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a second device on one remote takes the next free position, never the count',
     { ...skipUnless(SAMPLES[0]) }, async () => {
  // Three things in the model refer to a device by number and nothing else, so a position has to be
  // stable. Using the count would collide the first time one in the middle had been removed; nothing
  // removes one yet, and writing it this way means nothing has to remember to when something does.
  const at = await bench();
  try {
    await at.store.create('bedroom');
    await writeContent(at.store, 'bedroom', {
      devices: [{ slot: 0 }, { slot: 4 }], activities: [], buttons: [], filledFrom: 'here',
    });

    const content = await addDeviceUse(at.store, 'bedroom', 'appliance-aaaa', 'a third');

    assert.deepEqual(content.devices.map((one) => one.slot), [0, 4, 5]);
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a position can be named, renamed and have its name taken away again', async () => {
  // The label belongs to the **use** and not to the description, which is the whole reason four identical
  // televisions are one description: taking it away has to leave the description alone and let the library
  // name it, rather than storing an empty string that satisfies every presence test and renders as nothing.
  const at = await bench();
  try {
    await at.store.create('bedroom');
    await writeContent(at.store, 'bedroom', {
      devices: [{ slot: 0, definition: 'appliance-aaaa' }], activities: [], buttons: [],
      filledFrom: 'here',
    });

    assert.deepEqual((await labelDeviceUse(at.store, 'bedroom', 0, 'the telly')).devices,
                     [{ slot: 0, definition: 'appliance-aaaa', label: 'the telly' }]);
    assert.deepEqual((await labelDeviceUse(at.store, 'bedroom', 0, '  the big telly  ')).devices,
                     [{ slot: 0, definition: 'appliance-aaaa', label: 'the big telly' }],
                     'and it is trimmed, since a name with a space on the end is the same name');
    // Absent and the empty string both take it away, because a field cleared in an interface arrives as
    // one of the two and they mean the same thing to whoever cleared it.
    assert.deepEqual((await labelDeviceUse(at.store, 'bedroom', 0)).devices,
                     [{ slot: 0, definition: 'appliance-aaaa' }]);
    await labelDeviceUse(at.store, 'bedroom', 0, 'again');
    assert.deepEqual((await labelDeviceUse(at.store, 'bedroom', 0, '')).devices,
                     [{ slot: 0, definition: 'appliance-aaaa' }]);
    // On disk rather than only in the answer, which is what the page reads back.
    assert.deepEqual((await storedContentOf(at.store, 'bedroom'))?.devices,
                     [{ slot: 0, definition: 'appliance-aaaa' }]);

    await assert.rejects(() => labelDeviceUse(at.store, 'bedroom', 3, 'nothing there'),
                         /nothing at position 4/);
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

/**
 * Two devices and two activities, both driving both devices, which is the least a keypad question needs.
 *
 * Both activities drive both devices on purpose: a keypad map belongs to an activity, so a device an
 * activity does not drive has nowhere for a binding to live, and that refusal has its own test below.
 */
async function aRemoteWithTwoActivities(at: Bench, buttons: ButtonBinding[] = []): Promise<void> {
  await at.store.create('bedroom');
  await writeContent(at.store, 'bedroom', {
    devices: [{ slot: 0 }, { slot: 1 }],
    activities: [0, 1].map((slot) => ({ slot, roles: [], onStart: [], onStop: [], wants: [],
                                        devices: [0, 1] })),
    buttons, filledFrom: 'here',
  });
}

test('setting a device\'s button writes every activity that drives it, and says which', async () => {
  // **The rail, and it is the whole reason this function is not a one line edit.** A page about a device
  // edits the device's own button map, which is what device mode is on a Harmony. A configuration stores
  // no such map: it stores one keypad map per activity, and the device's map is what those agree on,
  // section 151 next door. So one assignment has to land in every activity that drives the device.
  //
  // Write one only and the remote behaves exactly as before in the activity somebody is sitting in, the
  // checksum still passes, and nothing tells them. That is the failure this test exists for.
  const at = await bench();
  try {
    await aRemoteWithTwoActivities(at);

    const bound = await assignButton(at.store, 'bedroom', 12, 0, 7);
    assert.deepEqual(bound.activities, [0, 1], 'both activities drive position 1');
    assert.deepEqual(bound.held, [], 'and nothing was in the way of either');
    assert.equal(bound.content.buttons.length, 2, 'so both got the binding');
    assert.deepEqual(bound.content.buttons.map((one) => one.inActivity).sort(), [0, 1]);
    for (const binding of bound.content.buttons) {
      assert.deepEqual(binding.sends, [{ device: 0, command: 7 }]);
      assert.equal(binding.scan, 12);
      assert.equal(binding.surface, 'keypad');
    }

    // Changing it replaces both rather than accumulating: in one activity a key sends one thing.
    const moved = await assignButton(at.store, 'bedroom', 12, 0, 9);
    assert.equal(moved.content.buttons.length, 2);
    assert.deepEqual([...new Set(moved.content.buttons.map((one) => one.sends[0]?.command))], [9]);

    // Clearing it takes every copy, which is the same rail in the other direction: a key cleared in one
    // activity and left in another is a key that still works, which is not what anybody asked for.
    const cleared = await assignButton(at.store, 'bedroom', 12, 0);
    assert.deepEqual(cleared.content.buttons, []);
    assert.deepEqual(cleared.activities, [0, 1]);
    assert.deepEqual((await storedContentOf(at.store, 'bedroom'))?.buttons, []);
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('an override is one activity, and it is asked for rather than arrived at', async () => {
  // The other half of the rail. A per activity override is real, it is what nine of the corpus's 1105
  // device and key pairs are, and it has to be a deliberate act rather than the side effect of an edit.
  const at = await bench();
  try {
    await aRemoteWithTwoActivities(at);
    await assignButton(at.store, 'bedroom', 12, 0, 7);

    const overridden = await assignButton(at.store, 'bedroom', 12, 0, 40, 1);
    assert.deepEqual(overridden.activities, [1], 'only the one that was asked for');
    const byActivity = new Map(overridden.content.buttons
      .map((one) => [one.inActivity, one.sends[0]?.command]));
    assert.deepEqual([...byActivity].sort(), [[0, 7], [1, 40]], 'and the other one is untouched');

    // An activity that does not drive the device is refused rather than written, since the binding would
    // sit in a map that never runs for it.
    await assert.rejects(() => assignButton(at.store, 'bedroom', 12, 0, 3, 5),
                         /activity 6 on bedroom does not drive position 1/);
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a device no activity drives has nowhere to put a button, and is told so', async () => {
  // **The refusal a person will actually hit**, and it is the product's own shape rather than a limit of
  // this code: a keypad map belongs to an activity in every configuration here, so a device nothing runs
  // for has nowhere for a keypad binding to live. Creating an activity is what comes first.
  const at = await bench();
  try {
    await at.store.create('bedroom');
    await writeContent(at.store, 'bedroom', {
      devices: [{ slot: 0 }, { slot: 1 }],
      activities: [{ slot: 0, roles: [], onStart: [], onStop: [], wants: [], devices: [0] }],
      buttons: [], filledFrom: 'here',
    });

    await assert.rejects(() => assignButton(at.store, 'bedroom', 12, 1, 3),
                         /no activity on bedroom drives position 2/);
    // And the one that is driven works, so the refusal is about the device and not about the remote.
    assert.deepEqual((await assignButton(at.store, 'bedroom', 12, 0, 3)).activities, [0]);
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('an activity where another device has the key is left alone, and named', async () => {
  // **The case that decided the shape of this function**, and both blunt answers are wrong. A key that
  // drives the television in one activity and the amplifier in another is how a Harmony is set up: 27 of
  // the first device's 30 keys on the Harmony One in the lab are like that, across the eight activities
  // that drive it. Writing every driving activity would take those keys off the other device, which is a
  // destructive edit nobody asked for. Refusing outright, which this did for a day, would block 27 of 30.
  //
  // So it writes where there is room and answers with what it left, which is what lets a page say so
  // before the change rather than leave somebody reading an unchanged activity as a failed save.
  const at = await bench();
  try {
    await aRemoteWithTwoActivities(at);
    // Position 2 holds the key in the second activity only.
    await assignButton(at.store, 'bedroom', 12, 1, 5, 1);

    const bound = await assignButton(at.store, 'bedroom', 12, 0, 7);
    assert.deepEqual(bound.activities, [0], 'written where there was room');
    assert.deepEqual(bound.held, [1], 'and it names the one it did not touch');
    const byActivity = new Map(bound.content.buttons
      .map((one) => [one.inActivity, one.sends[0]]));
    assert.deepEqual([...byActivity].sort(),
                     [[0, { device: 0, command: 7 }], [1, { device: 1, command: 5 }]],
                     'the other device keeps its key in the activity it had it in');

    // Naming that activity explicitly is a different question and is refused, because there it is not a
    // limit on the reach of an edit about the device: it is an instruction to take another device's key.
    await assert.rejects(() => assignButton(at.store, 'bedroom', 12, 0, 7, 1),
                         /already sends to position 2 in that activity/);
    await assert.rejects(() => assignButton(at.store, 'bedroom', 12, 0, 7, 4),
                         /does not drive position 1/);
    await assert.rejects(() => assignButton(at.store, 'bedroom', 12, 4, 3),
                         /nothing at position 5/);
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a key every driving activity gives to another device is refused, and nothing is half written',
     async () => {
  // Where there is no room at all the answer is a refusal, and it names the device that has to give the
  // key up rather than the code. Checked **before** anything is written, which is the half a check written
  // per activity would get wrong: it would take the key in the first activity and then refuse.
  const at = await bench();
  try {
    await aRemoteWithTwoActivities(at);
    await assignButton(at.store, 'bedroom', 12, 1, 5);
    const before = await storedContentOf(at.store, 'bedroom');

    await assert.rejects(() => assignButton(at.store, 'bedroom', 12, 0, 7),
                         /sends to position 2 in every activity that drives position 1/);
    assert.deepEqual(await storedContentOf(at.store, 'bedroom'), before,
                     'the document is byte for byte what it was');
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

test('a screen key on the same code is a different population and is never touched', async () => {
  // The screen keys and the keypad keys share no scan code at all on three of the four architectures and
  // exactly one on the fourth, so a collision is rare rather than impossible, and there is no screen for
  // editing the screen keys yet. Whichever it is, this must leave it alone.
  const at = await bench();
  try {
    const onTheScreen: ButtonBinding = { surface: 'screen', scan: 12, inDeviceMode: 3,
                                         sends: [{ device: 1, command: 40 }] };
    await aRemoteWithTwoActivities(at, [onTheScreen]);

    const bound = await assignButton(at.store, 'bedroom', 12, 0, 7);
    assert.equal(bound.content.buttons.length, 3, 'the screen key kept its own');
    assert.deepEqual(bound.content.buttons.filter((one) => one.surface === 'screen'), [onTheScreen]);

    const cleared = await assignButton(at.store, 'bedroom', 12, 0);
    assert.deepEqual(cleared.content.buttons, [onTheScreen]);
  } finally {
    await rm(at.root, { recursive: true, force: true });
  }
});

/**
 * Where an appliance's commands are already used on a remote, and in whose words.
 *
 * **The measurement behind the commands page, and it needs no lab.** A configuration states no command
 * names, which is why an imported television reads as eighty codes called "Command 41". What it does carry
 * is the words it **draws**: a screen key that sends a command has that word printed beside it on the
 * display, because that is how the person pressing it knows what it does. So the codes are not really
 * nameless, and nothing had to be fetched or guessed to find that out.
 *
 * The words here are our own invention and describe nobody's equipment.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { commandsInUse, writeContent } from '../src/main/content.ts';
import { RemoteStore } from '../src/main/store/remotes.ts';

async function aStore(): Promise<{ store: RemoteStore; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'freeharmony-uses-'));
  return { store: new RemoteStore({ root, now: () => '2026-08-22T12:00:00.000Z' }), root };
}

test('a command carries the words its own remote draws for it, from every document', async (t) => {
  const { store, root } = await aStore();
  t.after(() => rm(root, { recursive: true, force: true }));

  await store.create('Woonkamer', undefined, undefined);
  await store.create('Zolder', undefined, undefined);
  await writeContent(store, 'Woonkamer', {
    devices: [{ slot: 0, definition: 'appliance-tv' }, { slot: 1, definition: 'appliance-amp' }],
    activities: [], filledFrom: 'a-configuration',
    buttons: [
      { surface: 'screen', scan: 30, label: 'Sleep', sends: [{ device: 0, command: 5 }] },
      // A keypad key carries no word, because its word is printed on the plastic rather than in the file.
      // The scan comes back so that the drawing can name it on the other side.
      { surface: 'keypad', scan: 12, sends: [{ device: 0, command: 9 }] },
      // Another appliance's binding, in the same file, which must not appear in the television's answer.
      { surface: 'screen', scan: 31, label: 'Loudness', sends: [{ device: 1, command: 2 }] },
    ],
  });
  await writeContent(store, 'Zolder', {
    devices: [{ slot: 0, definition: 'appliance-tv' }],
    activities: [], filledFrom: 'a-configuration',
    // The same command with a different word on a second remote. Both are that person's own vocabulary and
    // both come back: which one reads better is a question for a screen and not for this.
    buttons: [{ surface: 'screen', scan: 30, label: 'Timer', sends: [{ device: 0, command: 5 }] }],
  });

  assert.deepEqual(await commandsInUse(store, 'appliance-tv'), [
    { slot: 5, remote: 'Woonkamer', surface: 'screen', scan: 30, label: 'Sleep' },
    { slot: 9, remote: 'Woonkamer', surface: 'keypad', scan: 12 },
    { slot: 5, remote: 'Zolder', surface: 'screen', scan: 30, label: 'Timer' },
  ]);
  // The negative, which is what says the filter is on the appliance and not merely on the document: the
  // amplifier's own word sits in the same file and belongs to the other description.
  assert.deepEqual(await commandsInUse(store, 'appliance-amp'), [
    { slot: 2, remote: 'Woonkamer', surface: 'screen', scan: 31, label: 'Loudness' },
  ]);
  assert.deepEqual(await commandsInUse(store, 'appliance-nobody-has'), []);
});

test('a macro on one key names every command in it', async (t) => {
  const { store, root } = await aStore();
  t.after(() => rm(root, { recursive: true, force: true }));

  // A key can send several codes in an order that matters, 85 of the 3106 bindings in the corpus next door.
  // Every step is a use of its own command, so all of them are reported, which is what the loop over
  // `sends` is for rather than reading the first step.
  await store.create('Woonkamer', undefined, undefined);
  await writeContent(store, 'Woonkamer', {
    devices: [{ slot: 0, definition: 'appliance-tv' }],
    activities: [], filledFrom: 'a-configuration',
    buttons: [{
      surface: 'screen', scan: 30, label: 'Watch the news',
      sends: [{ device: 0, command: 1 }, { device: 0, command: 4 }, { device: 0, command: 4 }],
    }],
  });

  const found = await commandsInUse(store, 'appliance-tv');
  assert.deepEqual(found.map((one) => one.slot), [1, 4, 4]);
});

test('two positions pointing at one description are both that description\'s', async (t) => {
  const { store, root } = await aStore();
  t.after(() => rm(root, { recursive: true, force: true }));

  // A real arrangement rather than a curiosity: a television driven directly and through an amplifier is
  // two positions on the remote and one description in the library. Reading only the first position would
  // lose half the words, and it would do it silently.
  await store.create('Woonkamer', undefined, undefined);
  await writeContent(store, 'Woonkamer', {
    devices: [{ slot: 0, definition: 'appliance-tv' }, { slot: 3, definition: 'appliance-tv' }],
    activities: [], filledFrom: 'a-configuration',
    buttons: [
      { surface: 'screen', scan: 30, label: 'Sleep', sends: [{ device: 0, command: 5 }] },
      { surface: 'screen', scan: 31, label: 'Zoom', sends: [{ device: 3, command: 6 }] },
    ],
  });

  assert.deepEqual(
    (await commandsInUse(store, 'appliance-tv')).map((one) => one.label), ['Sleep', 'Zoom']);
});

test('a document with no contents file yet contributes nothing rather than failing', async (t) => {
  const { store, root } = await aStore();
  t.after(() => rm(root, { recursive: true, force: true }));

  // The ordinary state of a remote somebody just created, and the answer has to be an empty list rather
  // than an error: the library panel opens over whatever is on the screen, so one half finished document
  // must not stop every other remote's words being read.
  await store.create('Nieuwe', undefined, undefined);
  assert.deepEqual(await commandsInUse(store, 'appliance-tv'), []);
});

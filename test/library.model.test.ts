/**
 * The library screen's state, with no window and no React.
 *
 * It had no test at all until 22 August 2026, which is worth saying plainly: it was written the day before
 * as a read only list, and the four write operations arrived with the device manager. A model that only
 * reads is nearly all typecheck; one that writes has an ordering rule in it, and that rule is the whole
 * subject here.
 *
 * The rule: **every write reloads.** A screen that keeps its own copy of a list it has just changed is a
 * screen that can disagree with the disk, and the disk is the truth. So each of the four is checked for
 * having asked again, and the naming rules are checked separately because they are what a person actually
 * reads off a tile.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { LibraryApi } from '../src/shared/api.ts';
import type { DeviceDefinition, DeviceDraft, DeviceUsage } from '../src/shared/library.ts';
import {
  LibraryModel, captionFor, definitionIn, listed, nameFor, usedBy, usedByCount,
  type LibraryState,
} from '../src/renderer/src/viewmodels/library.model.ts';

function appliance(id: string, over: Partial<DeviceDefinition> = {}): DeviceDefinition {
  return {
    id,
    kind: 'other',
    commands: [],
    properties: [],
    timing: {},
    origin: 'from-a-configuration',
    addedAt: '2026-08-22T10:00:00.000Z',
    ...over,
  };
}

/** A ready state, which is what every naming rule below is asked about. */
function ready(
  definitions: readonly DeviceDefinition[], usage: readonly DeviceUsage[] = [],
): LibraryState {
  return { status: 'ready', definitions, usage };
}

/**
 * A bridge that records what it was asked, so the reload can be counted rather than inferred.
 *
 * Written out rather than a partial cast, because `LibraryApi` is the seam this whole design rests on: a
 * method added there and not here should stop this file compiling, which is what says a screen has a new
 * capability nothing has checked.
 */
function bridge(held: DeviceDefinition[] = []) {
  const asked: string[] = [];
  const api: LibraryApi = {
    list: async () => { asked.push('list'); return [...held]; },
    get: async (id) => { asked.push(`get ${id}`); return appliance(id); },
    put: async (definition) => { asked.push(`put ${definition.id}`); return definition; },
    create: async (draft: DeviceDraft) => {
      asked.push('create');
      const made = appliance('appliance-typed-new', { kind: draft.kind });
      held.push(made);
      return made;
    },
    clone: async (id, name) => {
      asked.push(`clone ${id}`);
      const made = appliance('appliance-copy-new', name === undefined ? {} : { name });
      held.push(made);
      return made;
    },
    remove: async (id) => { asked.push(`remove ${id}`); },
    missingFor: async () => { asked.push('missingFor'); return []; },
    likelyDuplicates: async () => { asked.push('likelyDuplicates'); return []; },
    usage: async () => { asked.push('usage'); return []; },
    nameCommands: async (id, names) => {
      asked.push(`nameCommands ${id} ${names.map((one) => `${one.slot}=${one.name ?? '-'}`).join(',')}`);
      return appliance(id);
    },
    framesOf: async (id) => { asked.push(`framesOf ${id}`); return []; },
    inUseOn: async (id) => { asked.push(`inUseOn ${id}`); return []; },
  };
  return { api, asked };
}

test('the list and the names arrive together, so no tile is drawn nameless', async () => {
  const { api, asked } = bridge([appliance('appliance-a')]);
  const seen: LibraryState[] = [];
  const model = new LibraryModel(api, (state) => seen.push(state));
  await model.load();

  // Both requests, and the state only becomes ready once both have answered. A ready state carrying
  // definitions and no usage would be a row of tiles that cannot be told apart.
  assert.deepEqual(asked, ['list', 'usage']);
  assert.deepEqual(seen.map((one) => one.status), ['loading', 'ready']);
  assert.equal(model.state.status, 'ready');
});

test('a failure is a failed screen and not an empty one', async () => {
  const { api } = bridge();
  const model = new LibraryModel({ ...api, list: async () => { throw new Error('no'); } }, () => {});
  await model.load();

  // The distinction that matters: an empty library and a broken one look the same on a screen unless the
  // state keeps them apart, and "you have no appliances" is a lie in the second case.
  assert.equal(model.state.status, 'failed');
});

test('every write asks the library again, so the screen cannot disagree with the disk', async () => {
  for (const [what, run] of [
    ['create', (model: LibraryModel) => model.create({ kind: 'television' })],
    ['clone', (model: LibraryModel) => model.clone('appliance-a')],
    ['put', (model: LibraryModel) => model.put(appliance('appliance-a'))],
    ['remove', (model: LibraryModel) => model.remove('appliance-a')],
  ] as const) {
    const { api, asked } = bridge([appliance('appliance-a')]);
    const model = new LibraryModel(api, () => {});
    await run(model);

    // The write first and the reload after it, in that order, which is the half a caller would otherwise
    // have to remember per screen.
    assert.equal(asked.length, 3, `${what}: ${asked.join(', ')}`);
    assert.deepEqual(asked.slice(1), ['list', 'usage'], what);
    assert.equal(model.state.status, 'ready', what);
  }
});

test('creating and copying hand back what was made, because the caller has to open it', async () => {
  const { api } = bridge();
  const model = new LibraryModel(api, () => {});

  // The identifier is minted on the other side of the bridge, so this is the only place it can come from.
  // Without the return value a person would write an appliance down and then have to find it in a row.
  assert.equal((await model.create({ kind: 'receiver' })).id, 'appliance-typed-new');
  assert.equal((await model.clone('appliance-a', 'A copy')).name, 'A copy');
});

test('an appliance is looked up in what is loaded, and absent is honestly absent', () => {
  const state = ready([appliance('appliance-a')]);

  assert.equal(definitionIn(state, 'appliance-a')?.id, 'appliance-a');
  assert.equal(definitionIn(state, 'appliance-b'), undefined);
  assert.equal(definitionIn(state, undefined), undefined);
  // Not loaded answers `undefined` as well, and the two are deliberately not told apart here: a screen
  // that has not loaded yet is a flicker, and one that has is a missing appliance.
  assert.equal(definitionIn({ status: 'loading' }, 'appliance-a'), undefined);
});

test('a tile is named by the best thing anybody knows about the appliance', () => {
  const usage: DeviceUsage[] = [
    { definition: 'appliance-c', remote: 'Living room', label: 'The big telly' },
    { definition: 'appliance-c', remote: 'Bedroom', label: 'Telly' },
  ];

  // Its own name wins, because somebody typed it about the appliance rather than about a remote.
  assert.equal(
    nameFor(appliance('appliance-a', { name: 'The study one', manufacturer: 'Sony' }), ready([])),
    'The study one');
  // Then the make and model together.
  assert.equal(
    nameFor(appliance('appliance-b', { manufacturer: 'LG', model: 'OLED55' }), ready([])),
    'LG OLED55');
  // Then what the documents call it, all of them, because several remotes may disagree and all are right.
  assert.equal(nameFor(appliance('appliance-c'), ready([], usage)), 'The big telly, Telly');
  // And then the only true thing left. This is the ordinary case for a fresh import, not an edge: a
  // configuration carries codes and no words at all.
  assert.equal(
    nameFor(appliance('appliance-d', { commands: [
      { slot: 0, signal: { carrierHz: 38000, once: [] }, origin: 'from-a-configuration' },
    ] }), ready([])),
    '1 command');
  assert.equal(nameFor(appliance('appliance-e'), ready([])), 'Nothing known yet');
});

test('the count is over distinct remotes and not over uses', () => {
  const twice: DeviceUsage[] = [
    { definition: 'appliance-a', remote: 'Living room', label: 'Telly' },
    // The same remote using one appliance in two positions, which is a real arrangement: a television
    // driven both directly and through an amplifier is two positions and one description.
    { definition: 'appliance-a', remote: 'Living room', label: 'Telly again' },
  ];

  // One remote, two positions on it. The control that says this is not the length of the usage list.
  assert.equal(usedByCount(ready([], twice), 'appliance-a'), 1);
  assert.equal(usedBy(ready([], twice), 'appliance-a').length, 2);
  assert.equal(
    usedByCount(ready([], [...twice, { definition: 'appliance-a', remote: 'Bedroom' }]), 'appliance-a'), 2);
  assert.equal(usedByCount(ready([]), 'appliance-a'), 0);

  // And a tile's words are the category alone, because the count is a badge now. A caption saying both ran
  // past the tile and was cut off mid word.
  assert.equal(captionFor(appliance('appliance-a', { kind: 'receiver' }), ready([])),
               'Amplifier or receiver');
});

test('the list is in the order a person reads it, not the order the library hands it over', () => {
  // The library sorts by identifier, which for a hand written appliance is a random string and for an
  // imported one is a digest of what it sends. Either way the order means nothing, and this was found by
  // looking at the page rather than by anything failing.
  const state = ready([
    appliance('appliance-zzz', { name: 'Amplifier' }),
    appliance('appliance-aaa', { name: 'Television' }),
    appliance('appliance-mmm', { manufacturer: 'Sony', model: 'BDP' }),
  ]);

  assert.deepEqual(listed(state).map((one) => nameFor(one, state)),
                   ['Amplifier', 'Sony BDP', 'Television']);
  // Sorted by what is shown and not by the stored name, which is why the middle one is placed by its make
  // and model: most of a fresh library has no stored name at all.
  assert.deepEqual(listed({ status: 'loading' }), []);
});

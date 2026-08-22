/**
 * What a device is called and where it says it came from, which is nearly all of what a screen shows.
 *
 * These rules live in `src/shared/library.ts` rather than in a view, and this is why: they are three
 * fallback chains with an ordering each, and the interesting arms are the ones that fire on the ordinary
 * case rather than on an edge. **Every device an import produces has no name, no make and no model**, so the
 * last arm of each chain is what most of a real library actually shows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { DeviceDefinition } from '../src/shared/library.ts';
import {
  KINDS, KIND_NAMES, ORIGINS, ORIGIN_NAMES, describeDefinition, headingFor, provenanceOf,
} from '../src/shared/library.ts';

function device(over: Partial<DeviceDefinition> = {}): DeviceDefinition {
  return {
    id: 'appliance-a',
    kind: 'television',
    commands: [],
    properties: [],
    timing: {},
    origin: 'from-a-configuration',
    addedAt: '2026-08-22T10:00:00.000Z',
    ...over,
  };
}

test('a device says which remote model it was read off, where that is known', () => {
  // The point of the field: "Imported from a Harmony 600" tells somebody which of their remotes to go and
  // look at, where "imported from a remote" tells them nothing they could act on.
  assert.equal(provenanceOf(device({ addedFrom: 'Harmony 600' })), 'Imported from a Harmony 600');
  // Absent on everything imported before the field existed, so the sentence has to work without it.
  assert.equal(provenanceOf(device()), 'Imported from a remote');
  // And the model is only ever folded into the one origin it is about. A device typed by hand that somehow
  // carried a model must not claim it was imported.
  assert.equal(provenanceOf(device({ origin: 'typed-here', addedFrom: 'Harmony 600' })),
               'Added by hand');
  assert.equal(provenanceOf(device({ origin: 'from-logitech' })), 'Downloaded from Logitech');
  assert.equal(provenanceOf(device({ origin: 'learned-here' })), 'Learned here');
});

test('the heading is a name and a line under it, in the order of how much anybody knows', () => {
  // A typed name on top, the make and model underneath: the name is what its owner recognises and the make
  // and model are what identify the thing.
  assert.deepEqual(headingFor(device({ name: 'The big one', manufacturer: 'LG', model: 'OLED55' })),
                   { title: 'The big one', under: 'LG OLED55' });
  // A name and nothing else: no second line rather than an empty one.
  assert.deepEqual(headingFor(device({ name: 'The big one' })), { title: 'The big one' });
  // No name: the make and model become the title, since together they are a name, and the line says where
  // it came from.
  assert.deepEqual(headingFor(device({ manufacturer: 'LG', model: 'OLED55', addedFrom: 'Harmony One' })),
                   { title: 'LG OLED55', under: 'Imported from a Harmony One' });
});

test('a device with nothing known says what it is and that it wants a name', () => {
  // The ordinary case for an import, not an edge. "Unnamed television" rather than "Television", because a
  // bare category reads as a name and then four televisions all have the same one.
  assert.deepEqual(headingFor(device({ addedFrom: 'Harmony 600' })),
                   { title: 'Unnamed television', under: 'Imported from a Harmony 600' });
  assert.deepEqual(headingFor(device({ kind: 'receiver', origin: 'typed-here' })),
                   { title: 'Unnamed amplifier or receiver', under: 'Added by hand' });
  // An empty string is what a form hands back for a field nobody filled in, and it must not count as a
  // name: a title of "" would be a page with no heading at all.
  assert.deepEqual(headingFor(device({ name: '', manufacturer: '', addedFrom: 'Harmony 600' })),
                   { title: 'Unnamed television', under: 'Imported from a Harmony 600' });
});

test("a device's own name wins over its make and model, and an empty one does not", () => {
  assert.equal(describeDefinition(device({ name: 'The big one', manufacturer: 'LG' })), 'The big one');
  assert.equal(describeDefinition(device({ manufacturer: 'LG', model: 'OLED55' })), 'LG OLED55');
  assert.equal(describeDefinition(device({ manufacturer: 'LG' })), 'LG');
  assert.equal(describeDefinition(device({ name: '', model: '' })), undefined);
  assert.equal(describeDefinition(device()), undefined);
});

test('every category and every origin has words, and the two lists are the same length as their tables', () => {
  // The `Record` types already make the tables exhaustive at compile time. What this checks is the thing a
  // type cannot: that no entry is empty, which would render as a gap rather than as a failure.
  for (const kind of KINDS) assert.notEqual(KIND_NAMES[kind], '', kind);
  for (const origin of ORIGINS) assert.notEqual(ORIGIN_NAMES[origin], '', origin);
  assert.equal(KINDS.length, Object.keys(KIND_NAMES).length);
  assert.equal(ORIGINS.length, Object.keys(ORIGIN_NAMES).length);
  // Exact, so adding a category shows up here rather than only in a screen nobody looked at.
  assert.equal(KINDS.length, 9);
  assert.equal(ORIGINS.length, 4);
});

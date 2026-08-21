/**
 * The lookup from a document's model to a drawing, with no browser in sight.
 *
 * This is the file that would quietly rot: it joins two libraries, and if a model were added next
 * door with a skin this side did not expect, nothing on screen would say so. A remote would simply
 * lose its picture, which reads as a design choice rather than as a fault.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { asRemoteModel, drawingFor, SUPPORTED } from '../src/renderer/src/catalogue.ts';

test('three models are offered, oldest hardware first, each with its own facts', () => {
  // Exact, not a floor. Three of the forty models Logitech retired are drawn, and when a fourth is
  // drawn next door this number moves in a diff somebody reads.
  assert.equal(SUPPORTED.length, 3);
  assert.deepEqual(SUPPORTED.map((m) => m.name), ['Harmony 525', 'Harmony One', 'Harmony 600']);
  assert.deepEqual(SUPPORTED.map((m) => m.drawing.architecture), [9, 12, 14]);
  for (const model of SUPPORTED) {
    assert.ok(model.skin > 0, `${model.name} has no skin to record`);
    assert.ok(model.facts.length >= 1, `${model.name} says nothing about itself`);
  }
});

test('the facts are measured off the drawing, and say what the hardware has', () => {
  const one = SUPPORTED.find((m) => m.name === 'Harmony One');
  assert.deepEqual(one?.facts, ['44 buttons', 'a touch screen of 176 by 220 pixels']);
  const six = SUPPORTED.find((m) => m.name === 'Harmony 600');
  assert.deepEqual(six?.facts, ['54 buttons', 'a screen of 128 by 128 pixels']);
});

test('a skin finds its drawing, and a regional twin finds the same one', () => {
  // The closure worth having: 54 and 59 are the Harmony One and the European Harmony One, which
  // differ by nothing this application can see, and both must land on one drawing.
  assert.equal(drawingFor({ name: 'whatever', skin: 54 })?.id, 'one');
  assert.equal(drawingFor({ name: 'whatever', skin: 59 })?.id, 'one');
  assert.equal(drawingFor({ name: 'whatever', skin: 71 })?.id, 'h600');
  assert.equal(drawingFor({ name: 'whatever', skin: 73 })?.id, 'h600');
  assert.equal(drawingFor({ name: 'whatever', skin: 22 })?.id, 'h525');
});

test('a name finds its drawing, which is what a document written by hand has', () => {
  assert.equal(drawingFor({ name: 'Harmony 600' })?.id, 'h600');
});

test('a model nobody has drawn has no drawing, and that is an answer rather than a failure', () => {
  // Skin 66 is a Harmony 700: a real remote, in the corpus next door, and not drawn. It must come
  // back undefined rather than being resolved to whichever drawing is nearest.
  assert.equal(drawingFor({ name: 'Harmony 700', skin: 66 }), undefined);
  assert.equal(drawingFor({ name: 'Harmony 880' }), undefined);
  assert.equal(drawingFor(undefined), undefined);
});

test('what a picked model puts in a document finds its way back to the drawing', () => {
  for (const picked of SUPPORTED) {
    assert.equal(drawingFor(asRemoteModel(picked))?.id, picked.id, picked.name);
  }
});

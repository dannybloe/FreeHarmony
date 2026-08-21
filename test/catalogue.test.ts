/**
 * The lookup from a document's model to a drawing, with no browser in sight.
 *
 * This is the file that would quietly rot: it joins two libraries, and if a model were added next
 * door with a skin this side did not expect, nothing on screen would say so. A remote would simply
 * lose its picture, which reads as a design choice rather than as a fault.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { modelForSkin } from '@harmony/usb/models';

import { asRemoteModel, drawingFor, isSameModel, SUPPORTED } from '../src/renderer/src/catalogue.ts';

test('three models are offered, in the order somebody reads them, each with its own facts', () => {
  // Exact, not a floor. Three of the forty models Logitech retired are drawn, and when a fourth is
  // drawn next door this number moves in a diff somebody reads.
  //
  // The order is a claim about the screen and not about the hardware: 525, 600, One is how a person
  // says it, where by architecture it came out 525, One, 600.
  assert.equal(SUPPORTED.length, 3);
  assert.deepEqual(SUPPORTED.map((m) => m.name), ['Harmony 525', 'Harmony 600', 'Harmony One']);
  for (const model of SUPPORTED) {
    assert.ok(model.skin > 0, `${model.name} has no skin to record`);
    assert.ok(model.facts.length >= 1, `${model.name} says nothing about itself`);
  }
});

test('the facts are measured off the drawing, and the vendor figure says it is a ceiling', () => {
  const one = SUPPORTED.find((m) => m.name === 'Harmony One');
  assert.deepEqual(one?.facts,
                   ['44 buttons', 'a touch screen of 176 by 220 pixels', 'up to 15 devices']);
  const six = SUPPORTED.find((m) => m.name === 'Harmony 600');
  assert.deepEqual(six?.facts, ['54 buttons', 'a screen of 128 by 128 pixels', 'up to 5 devices']);
});

test('a tile is a face, and it names every model number that face is sold as', () => {
  // Danny's rule for the chooser: two model numbers that are the same remote share one tile with both
  // numbers on it, rather than getting a picture each. Today every one of the three answers with a
  // single number, and that is the honest answer rather than a missing feature: the only aliases in
  // Logitech's table for these three are regional twins of the same name.
  //
  // The numbers are spelled the way a screen spells them, through `fullName`, because that is what a
  // caption puts beside a tile: nobody selling a remote called it "One".
  assert.deepEqual(SUPPORTED.map((m) => m.soldAs),
                   [['Harmony 525'], ['Harmony 600'], ['Harmony One']]);
});

test('a regional twin folds into its own number instead of appearing beside it', () => {
  // Skins 54 and 59 are the Harmony One and the European Harmony One. Both are claimed by one
  // drawing, because the faces are identical, and the suffix is Logitech's internal marker rather
  // than anything printed on a remote. So a chooser must not offer "One" and "One EMEA" as if they
  // were a choice. The 600 pair, skins 71 and 73, is the same case and is what makes this a rule.
  const one = SUPPORTED.find((m) => m.name === 'Harmony One');
  assert.deepEqual(one?.drawing.skins, [54, 59], 'the drawing claims both, which is the input');
  assert.deepEqual(one?.soldAs, ['Harmony One'], 'and the tile says one number, which is the output');
});

test('every skin one drawing claims agrees about the hardware the face shows', () => {
  /**
   * Danny's rule as a check: if the keys differ they are different remotes and must not be merged.
   *
   * The table has no button count, so this cannot verify the keys themselves. What it can verify is
   * everything a face would betray anyway, and it is a **necessary** condition rather than a
   * sufficient one: a drawing claiming two skins that disagree about the display, the touch panel or
   * the architecture is claiming something the drawing itself contradicts. Stated as such, because a
   * check that reads stronger than it is is worse than none.
   */
  for (const model of SUPPORTED) {
    const claimed = model.drawing.skins.map((skin) => modelForSkin(skin)).filter((m) => m !== undefined);
    assert.equal(claimed.length, model.drawing.skins.length, `${model.name}: a skin has no record`);
    const shapes = claimed.map((m) => `${m.architecture}/${m.panel}/${m.touch}/${m.favourites ?? 0}`);
    assert.equal(new Set(shapes).size, 1,
                 `${model.name} claims skins that disagree about the hardware: ${shapes.join(' vs ')}`);
  }
});

test('the 525 does not share its tile with the 520, because that is a different face', () => {
  // The case that made the rule worth writing down. Logitech's table pairs skin 22, the 525, with
  // skin 18, the 520, and that pair differs by exactly the four teletext keys. This drawing has
  // those four, so claiming the 520 here would draw a remote nobody owns. The drawing claims one
  // skin and the tile therefore says one number, which is the correct answer and not a gap.
  const h525 = SUPPORTED.find((m) => m.name === 'Harmony 525');
  assert.deepEqual(h525?.drawing.skins, [22]);
  assert.deepEqual(h525?.soldAs, ['Harmony 525']);
  assert.ok(!(h525?.soldAs.includes('Harmony 520') ?? true), 'the 520 is a different keypad');
  // And the reason it cannot creep back in: the record's own `alias` field says 520, so `soldAs` has
  // to be reading the drawing's skins rather than that field. This is the assertion that says which.
  assert.equal(modelForSkin(22)?.alias, '520', 'the table does pair them, which is the temptation');
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

test('the same model is the same face, so a regional pair is one answer', () => {
  /**
   * Danny's question needs one comparison and this is it: is the remote being added one there is
   * already a document for. **By face, because a skin comparison gets the regional pair wrong**: a
   * European Harmony One reports skin 59 where the chooser records 54, and those are the same remote to
   * everybody except Logitech's table.
   */
  assert.equal(isSameModel({ name: 'Harmony One', skin: 54 }, { name: 'Harmony One', skin: 59 }), true);
  assert.equal(isSameModel({ name: 'Harmony 600', skin: 71 }, { name: 'Harmony 600', skin: 73 }), true);
  assert.equal(isSameModel({ name: 'Harmony One', skin: 54 }, { name: 'Harmony 600', skin: 71 }), false);
});

test('two models nobody has drawn still compare, by skin and then by name', () => {
  // Three of the forty retired models are drawn, so this is the ordinary path rather than the fallback.
  // The skin comes first because it is what the hardware states.
  assert.equal(isSameModel({ name: 'Harmony 655', skin: 11 }, { name: 'Harmony 655', skin: 11 }), true);
  assert.equal(isSameModel({ name: 'Harmony 655', skin: 11 }, { name: 'Harmony 675', skin: 16 }), false);
  assert.equal(isSameModel({ name: 'Harmony 655' }, { name: 'Harmony 655' }), true,
               'and a document with no skin still matches by name');
  assert.equal(isSameModel({ name: 'Harmony 655' }, { name: 'Harmony 675' }), false);
});

test('an unknown model matches nothing, including another unknown one', () => {
  // The case that decides whether somebody with two undescribed documents gets asked a question about
  // a remote nothing can name. They do not.
  assert.equal(isSameModel(undefined, { name: 'Harmony One', skin: 54 }), false);
  assert.equal(isSameModel({ name: 'Harmony One', skin: 54 }, undefined), false);
  assert.equal(isSameModel(undefined, undefined), false);
});

test('the 525 and the 520 are not the same model, which is the rule stated as a comparison', () => {
  // Danny's own rule, from the other direction. The two differ by the four teletext keys, so a document
  // of one must never be offered for the other. Skin 18 has no drawing here, so this exercises the skin
  // path rather than the face path, and it still separates them.
  assert.equal(isSameModel({ name: 'Harmony 525', skin: 22 }, { name: 'Harmony 520', skin: 18 }), false);
  assert.equal(drawingFor({ name: 'Harmony 520', skin: 18 }), undefined,
               'and the 520 has no drawing, so nothing could have merged them by face');
});

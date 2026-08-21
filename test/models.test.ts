/**
 * How a skin becomes a name, and the check that keeps the two spellings of one model in step.
 *
 * The reason this file exists is not the function, it is the **second copy**. A drawing next door
 * carries its own label, `Harmony One`, and Logitech's table carries `One`, and this application has
 * to store one string. If those two ever disagreed, a remote picked from the chooser and the same
 * remote read over USB would arrive in somebody's documents under different names, and nothing on
 * screen would say why. A copy that cannot be removed gets a test that compares it, which is the
 * sibling repository's standing answer to exactly this shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MODELS } from '@harmony/silhouettes';
import { MODELS_BY_SKIN, SKINS_WITHOUT_A_MODEL_RECORD } from '@harmony/usb/models';

import { fullName, NOT_CALLED_HARMONY, remoteModelForSkin } from '../src/shared/models.ts';

test('every drawing label is what the rule produces from its own skin, which is the copy check', () => {
  // The assertion this file is for. Three drawings, three skins, three names, and the rule has to
  // reach all three from the table alone. A fourth drawing added next door with a label spelled some
  // other way fails here rather than in somebody's documents.
  const checked = Object.values(MODELS).map((drawing) => {
    const skin = drawing.skins[0];
    assert.notEqual(skin, undefined, `${drawing.id} claims no skin`);
    const derived = remoteModelForSkin(skin);
    assert.equal(derived?.name, drawing.label,
                 `${drawing.id}: the table says ${derived?.name} and the drawing says ${drawing.label}`);
    return drawing.id;
  });
  assert.equal(checked.length, 3, 'three drawings, exactly, so a fourth moves this number in a diff');
});

test('a skin the tables do not name gets no model, because inventing one is the real risk', () => {
  // `undefined` is a real answer and the interface draws it. What must not happen is a nearest guess:
  // a document naming the wrong model is worse than a document naming none, because it looks settled.
  assert.equal(remoteModelForSkin(undefined), undefined, 'a remote whose bcdDevice carries no skin');
  assert.equal(remoteModelForSkin(9999), undefined, 'a skin nobody has recorded');
  assert.equal(remoteModelForSkin(1), undefined, 'a skin below the first the tables hold');
});

test('a skin with a name but no capability record still gets a document', () => {
  // The distinction the two tables draw is deliberately not carried into a document. A Harmony 655 is
  // in `SKINS_WITHOUT_A_MODEL_RECORD`, so nothing here knows what it can do, and that has no bearing
  // on whether somebody may keep one in their documents under its own name.
  assert.equal(SKINS_WITHOUT_A_MODEL_RECORD[11], '655', 'the input, so this test fails if it moves');
  assert.equal(MODELS_BY_SKIN[11], undefined, 'and it genuinely has no capability record');
  assert.deepEqual(remoteModelForSkin(11), { name: 'Harmony 655', skin: 11 });
});

test('somebody else brand keeps its own name, and the count is exact rather than a floor', () => {
  // 76 names across the two tables and 21 of them are not Harmonys: Monster, Harman Kardon, Olive,
  // Telus, the Revue, the Xbox remote and the wireless extender. A name added upstream that belongs on
  // that list fails here instead of appearing on a screen as "Harmony Monster AVL 300".
  //
  // Exact on both sides on purpose. A floor under 21 would absorb a brand quietly dropping out of the
  // list, and a floor under 76 would absorb a whole table failing to load.
  //
  // **The predicate is what the claim is about, and the first version's was not.** It asked whether
  // `fullName` left a name unchanged, which stopped meaning "not a Harmony" the moment the function
  // began folding the regional suffix: `Olive EMEA` keeps its brand and still comes back changed. 20
  // names are unchanged and 21 are not Harmonys, and the one in between is exactly that case.
  const every = [
    ...Object.values(MODELS_BY_SKIN).map((m) => m.name),
    ...Object.values(SKINS_WITHOUT_A_MODEL_RECORD),
  ];
  assert.equal(every.length, 76);

  const theirs = every.filter((name) => !fullName(name).startsWith('Harmony '));
  assert.equal(theirs.length, 21, `theirs: ${[...new Set(theirs)].sort().join(', ')}`);
  assert.equal(every.filter((name) => fullName(name) === name).length, 20,
               'and one of the 21 is folded rather than untouched, which is Olive EMEA');
  for (const name of every) {
    if (theirs.includes(name)) continue;
    assert.match(fullName(name), /^Harmony /, `${name} came out as ${fullName(name)}`);
  }
});

test('a regional twin is one name, because one face cannot have two', () => {
  /**
   * The defect this fixed, as an assertion, and it was live for a day.
   *
   * A European Harmony One reports skin 59 and the chooser records skin 54 for the same drawing, so a
   * remote read over USB was stored as `Harmony One EMEA` while the same remote picked from a list was
   * stored as `Harmony One`. One face, two names, in the very function written to stop exactly that.
   *
   * The skin is kept on both, so nothing is lost: which variant it is is still recorded, only the name
   * is settled. Nine of the 76 names carry the suffix, and 76 names fold to 67 distinct ones.
   */
  assert.equal(remoteModelForSkin(54)?.name, remoteModelForSkin(59)?.name, 'Harmony One and its twin');
  assert.equal(remoteModelForSkin(71)?.name, remoteModelForSkin(73)?.name, 'Harmony 600 and its twin');
  assert.deepEqual(remoteModelForSkin(59), { name: 'Harmony One', skin: 59 },
                   'the name is folded and the skin is not');

  const every = [
    ...Object.values(MODELS_BY_SKIN).map((m) => m.name),
    ...Object.values(SKINS_WITHOUT_A_MODEL_RECORD),
  ];
  assert.equal(every.filter((name) => / EMEA$/.test(name)).length, 9, 'nine names carry the suffix');
  assert.equal(new Set(every.map(fullName)).size, 67, 'so 76 names fold to 67');
});

test('the brand list is what does the keeping, which is the control on the test above', () => {
  // Without this the test above passes for the wrong reason: if `fullName` prefixed nothing at all,
  // `kept.length` would be 76 and the count would fail, but if the list were merely longer than it
  // needs to be nothing would notice. So every entry has to earn its place by matching a real name.
  for (const brand of NOT_CALLED_HARMONY) {
    const every = [
      ...Object.values(MODELS_BY_SKIN).map((m) => m.name),
      ...Object.values(SKINS_WITHOUT_A_MODEL_RECORD),
    ];
    assert.ok(every.some((name) => name.startsWith(brand)), `nothing in the tables starts with ${brand}`);
  }
});

test('One is the one Harmony name that is a word, which is why the list cannot be a rule', () => {
  // The reason `NOT_CALLED_HARMONY` is written out instead of derived from the string. `Olive` and
  // `One` are both a single capitalised word, so no test on the name itself can separate them, and
  // this is the pair that proves it.
  assert.equal(fullName('One'), 'Harmony One');
  assert.equal(fullName('Olive'), 'Olive');
});

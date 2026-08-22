/**
 * What each key on a drawn remote is doing, and the one state this project has to be honest about.
 *
 * No React and no DOM: the interesting half of a clickable keypad is the four states, and three of them
 * are wrong in ways a screenshot cannot show. A key that another device already owns and a key nobody has
 * bound look identical on a screen unless somebody decided they should not.
 *
 * **The measured counts are asserted exactly and they are the substance of the file.** A key is drawn from
 * measured geometry and its scan code is a separate measurement, mostly not made: none of a Harmony 525's
 * fifty keys has one. So an interface that treats "unbound" and "unknown code" alike is claiming a
 * capability on a Harmony 525 that does not exist at all, and these numbers are what stop that being
 * discovered by a person pressing keys that never respond.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MODELS } from '@harmony/silhouettes';

import type { ButtonBinding } from '../src/shared/content.ts';
import { keypadBindings, keypadFor, measuredKeys, spelledOut }
  from '../src/renderer/src/viewmodels/keypad.model.ts';

const H600 = MODELS.h600!;

/** An activity, because a physical key means nothing without one. Any number will do; this one is 2. */
const IN = 2;

function binding(over: Partial<ButtonBinding> & Pick<ButtonBinding, 'sends'>): ButtonBinding {
  return { surface: 'keypad', inActivity: IN, ...over };
}

/** Any key of a model that has a measured code, so a test can bind one without hard coding a number. */
function measuredScans(model = H600): number[] {
  return model.keys.map((key) => key.scan).filter((scan): scan is number => scan !== undefined);
}

test('how many of each model\'s keys can ever be bound, per model, exactly', () => {
  // Exact and not a floor. A floor would pass with a whole model at zero, which is precisely the case
  // that matters: the counts differ per model because the measurement was made per model, and the honest
  // interface has to be able to say so.
  const counted = Object.fromEntries(Object.entries(MODELS).map(([id, model]) =>
    [id, measuredKeys(keypadFor(model, [], 0, IN))]));

  assert.deepEqual(counted, {
    // Not one of the fifty. Its scan codes have never been measured, so on a Harmony 525 this page can
    // draw the remote and bind nothing at all, which the page says when a key is pressed.
    h525: { measured: 0, total: 50 },
    h600: { measured: 36, total: 54 },
    one: { measured: 34, total: 44 },
  });
});

test('a key with no measured code is a different state from a key nobody has bound', () => {
  const keys = keypadFor(H600, [], 0, IN);
  const free = keys.filter((one) => one.state === 'free');
  const unmeasured = keys.filter((one) => one.state === 'unmeasured');

  assert.equal(free.length, 36, 'every measured key is free on a document with no bindings');
  assert.equal(unmeasured.length, 18);
  // The distinction that makes it worth two states: one of these can be pointed at something today and
  // the other can never be, so an interface that drew them alike would be offering an action it has not
  // got. A candidate set is still no code, which is the arm that is easy to get wrong: the four soft keys
  // are known to be four of a set of four and nothing says which is which.
  assert.deepEqual([...new Set(free.map((one) => one.scan !== undefined))], [true]);
  assert.deepEqual([...new Set(unmeasured.map((one) => one.scan))], [undefined]);
});

test('a bound key says whose it is, and one key belongs to one device', () => {
  const [scan, other] = measuredScans();
  assert.ok(scan !== undefined && other !== undefined);

  const keys = keypadFor(H600, [binding({ scan, sends: [{ device: 1, command: 7 }] })], 1, IN);
  const mine = keys.filter((one) => one.state === 'mine');
  assert.equal(mine.length, 1);
  assert.deepEqual(mine[0]?.sends, [7]);

  // The same document seen from another device's page: the key is spoken for and it is not free.
  const elsewhere = keypadFor(H600, [binding({ scan, sends: [{ device: 1, command: 7 }] })], 0, IN);
  const taken = elsewhere.filter((one) => one.state === 'taken');
  assert.equal(taken.length, 1);
  assert.equal(taken[0]?.ownedBy, 1);
  assert.deepEqual(taken[0]?.sends, [], 'and it does not report another device\'s commands as its own');
});

test('a macro of several codes is one key sending several things, in order', () => {
  // 85 bindings in the corpus next door send more than one code and the order matters, so the model keeps
  // the list rather than the first of it.
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const keys = keypadFor(
    H600, [binding({ scan, sends: [{ device: 0, command: 3 }, { device: 0, command: 9 }] })], 0, IN);
  assert.deepEqual(keys.find((one) => one.state === 'mine')?.sends, [3, 9]);
});

test('another activity\'s key, a screen key and a key with no code are none of this activity\'s', () => {
  // **The same key means different things in different activities**, which is what an activity is for: the
  // volume key sends to the amplifier while you are listening to music and to the television while you are
  // watching it. So a page about one activity has to ignore every other one, and the state of a key here
  // says nothing about the same key over there.
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const bindings = [
    binding({ scan, inActivity: IN + 1, sends: [{ device: 0, command: 1 }] }),
    // A screen key. A separate population that shares no code with the keypad on three of the four
    // architectures, and exactly one code on the fourth, so it is not this page's business.
    { surface: 'screen' as const, scan, inDeviceMode: 1, sends: [{ device: 0, command: 3 }] },
    // And a binding with no scan at all, which the format allows: a key on an architecture whose codes are
    // not known. It cannot be matched to a drawn key and must not be counted as one.
    binding({ sends: [{ device: 0, command: 4 }] }),
  ];

  assert.deepEqual(keypadBindings(bindings, IN), []);
  assert.deepEqual(keypadFor(H600, bindings, 0, IN).filter((one) => one.state !== 'free'
                                                                && one.state !== 'unmeasured'), []);
  // And the one that does belong to the neighbouring activity is found when that one is asked for, so the
  // filter is selecting rather than simply rejecting everything.
  assert.equal(keypadBindings(bindings, IN + 1).length, 1);
});

test('a key\'s own name reads as words on a page and as one word in the drawing', () => {
  // The drawing carries Logitech's own identifiers, which are one word by design so that "which key is
  // mute" is one lookup on every model. A page is not a lookup.
  //
  // **The capitals stay**, which was a decision and not an oversight: each word is a word printed on a
  // real key, so "Volume Up" is what the remote in somebody's hand says. Sentence casing it would also
  // have to know that `OK` is not a word to lowercase.
  assert.equal(spelledOut('VolumeUp'), 'Volume Up');
  assert.equal(spelledOut('OK'), 'OK');
  assert.equal(spelledOut('Mute'), 'Mute');
  assert.equal(spelledOut('DirectionUp'), 'Direction Up');
  assert.equal(spelledOut('Number1'), 'Number 1');
  // And every name a drawing actually carries survives it, which is the half a hand written list cannot
  // check: a name that came back empty or with a double space would still pass the five above.
  for (const model of Object.values(MODELS)) {
    for (const key of model.keys) {
      assert.match(spelledOut(key.name), /^[^ ].*[^ ]$|^\S$/, key.name);
      assert.ok(!spelledOut(key.name).includes('  '), key.name);
    }
  }
});

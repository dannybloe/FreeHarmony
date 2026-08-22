/**
 * What each key of a drawn remote does for one device, and the two states this project has to be honest
 * about.
 *
 * **The subject is the device's own button map, which is what device mode is on a Harmony**: press Devices,
 * pick the television, and every key drives the television. `CLAUDE.md`'s first section is the operating
 * concept, and it is worth reading before this file: an earlier version of the page showed a keypad per
 * activity, which is the wrong question on a page about a device.
 *
 * A configuration stores no device map. It stores one keypad map per activity, and the device's map is what
 * those agree on, 1096 of 1105 pairs across fifteen configurations. So `contested` exists for the nine that
 * do not, because a page that silently picked one of two answers would be inventing the device's map.
 *
 * **The activities can differ two further ways and neither is a conflict**, which is what the middle tests
 * here pin: another device may hold the key in some of them, and some may not bind it at all. Both are
 * ordinary, 27 of the first device's 30 keys on the Harmony One in the lab for the first, and both say
 * where a change reaches rather than what the map says. The derivation is `src/shared/buttonmap.ts`,
 * shared with the writer so that the sentence the page shows and the change itself cannot disagree.
 *
 * And `unmeasured` exists because a key is drawn from measured geometry while its scan code is a separate
 * measurement, mostly not made: 36 of a Harmony 600's 54 keys have one, 34 of a Harmony One's 44, and
 * **none at all** of a Harmony 525's 50. A key with no code can never be pointed at anything by anybody,
 * which is not the same as a key nobody has pointed at yet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MODELS } from '@harmony/silhouettes';

import type { Activity, ButtonBinding } from '../src/shared/content.ts';
import { drivingActivities, keypadBindings, keypadFor, measuredKeys, spelledOut }
  from '../src/renderer/src/viewmodels/keypad.model.ts';

const H600 = MODELS.h600!;

/** Two activities, both driving both devices, which is the least a keypad question needs. */
const ACTIVITIES: readonly Activity[] = [0, 1].map((slot) => ({
  slot, roles: [], onStart: [], onStop: [], wants: [], devices: [0, 1],
}));

function binding(over: Partial<ButtonBinding> & Pick<ButtonBinding, 'sends'>): ButtonBinding {
  return { surface: 'keypad', inActivity: 0, ...over };
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
    [id, measuredKeys(keypadFor(model, [], 0, ACTIVITIES))]));

  assert.deepEqual(counted, {
    // Not one of the fifty. Its scan codes have never been measured, so on a Harmony 525 this page can
    // draw the remote and bind nothing at all, which the page says when a key is pressed.
    h525: { measured: 0, total: 50 },
    h600: { measured: 36, total: 54 },
    one: { measured: 34, total: 44 },
  });
});

test('a key with no measured code is a different state from a key nobody has bound', () => {
  const keys = keypadFor(H600, [], 0, ACTIVITIES);
  const free = keys.filter((one) => one.state === 'free');
  const unmeasured = keys.filter((one) => one.state === 'unmeasured');

  assert.equal(free.length, 36, 'every measured key is free on a document with no bindings');
  assert.equal(unmeasured.length, 18);
  // The distinction that makes it worth two states: one of these can be pointed at something today and
  // the other can never be, so an interface that drew them alike would be offering an action it has not
  // got. A candidate set is still no code, which is the arm that is easy to get wrong: a Harmony 525's
  // four soft keys are known to be four of a set of four and nothing says which is which.
  assert.deepEqual([...new Set(free.map((one) => one.scan !== undefined))], [true]);
  assert.deepEqual([...new Set(unmeasured.map((one) => one.scan))], [undefined]);
});

test('a key the activities agree about is the device\'s own, and it says which activities carry it', () => {
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  // The ordinary case, and it is 1096 of 1105 in the corpus: the same command in every activity.
  const keys = keypadFor(H600, [
    binding({ scan, inActivity: 0, sends: [{ device: 1, command: 7 }] }),
    binding({ scan, inActivity: 1, sends: [{ device: 1, command: 7 }] }),
  ], 1, ACTIVITIES);

  const mine = keys.filter((one) => one.state === 'mine');
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.command, 7);
  assert.deepEqual(mine[0]?.perActivity,
                   [{ activity: 0, command: 7 }, { activity: 1, command: 7 }],
                   'one row per activity that drives the device, whether they agree or not');
  assert.deepEqual(mine[0]?.writable, [0, 1], 'and a change reaches both');
  assert.deepEqual(mine[0]?.held, []);
});

test('a key the activities disagree about is contested, and neither answer is picked', () => {
  // **The nine of 1105**, and the reason a state exists for them: a page that silently showed one of two
  // commands would be inventing the device's map, which is the one thing a derived map must never do. An
  // amplifier whose input selection differs per activity is the real example.
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const keys = keypadFor(H600, [
    binding({ scan, inActivity: 0, sends: [{ device: 1, command: 7 }] }),
    binding({ scan, inActivity: 1, sends: [{ device: 1, command: 40 }] }),
  ], 1, ACTIVITIES);

  const contested = keys.filter((one) => one.state === 'contested');
  assert.equal(contested.length, 1);
  assert.equal(contested[0]?.command, undefined, 'no single answer is offered');
  assert.deepEqual(contested[0]?.perActivity,
                   [{ activity: 0, command: 7 }, { activity: 1, command: 40 }],
                   'the page can name the activity whose key differs, which is what lets somebody decide');
});

test('a key another device holds in one activity is still this device\'s, and the write skips that one',
     () => {
  // **The ordinary case, and the one this got wrong twice.** A key that drives the television in one
  // activity and the amplifier in another is how a Harmony is set up: 27 of the first device's 30 keys on
  // the Harmony One in the lab. It is not a conflict about the device's map, so it is not a colour on the
  // drawing; what it is, is a place a change cannot reach, and that has to be said before a change is made
  // rather than discovered afterwards as an activity that did not move.
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const keys = keypadFor(H600, [
    binding({ scan, inActivity: 0, sends: [{ device: 1, command: 7 }] }),
    binding({ scan, inActivity: 1, sends: [{ device: 0, command: 2 }] }),
  ], 1, ACTIVITIES);

  const found = keys.filter((one) => one.scan === scan);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.state, 'mine', 'the device has one answer for it, so the drawing says so');
  assert.equal(found[0]?.command, 7);
  assert.deepEqual(found[0]?.writable, [0], 'and a change reaches the activity it is already in');
  assert.deepEqual(found[0]?.held, [1], 'and names the one it does not, so the page can too');
  assert.deepEqual(found[0]?.perActivity,
                   [{ activity: 0, command: 7 }, { activity: 1, heldBy: 0 }]);
});

test('a key every driving activity gives to another device is taken, and nothing can be written', () => {
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const keys = keypadFor(H600, [
    binding({ scan, inActivity: 0, sends: [{ device: 0, command: 2 }] }),
    binding({ scan, inActivity: 1, sends: [{ device: 0, command: 2 }] }),
  ], 1, ACTIVITIES);

  const taken = keys.filter((one) => one.state === 'taken');
  assert.equal(taken.length, 1);
  assert.equal(taken[0]?.ownedBy, 0, 'named after whoever has to give it up');
  assert.deepEqual(taken[0]?.writable, [], 'there is nowhere for it to go');
});

test('a key bound in only some activities is still the device\'s own, and a change fills in the rest', () => {
  // 126 of the 1096 agreeing pairs are bound in only some of the activities that drive the device, which
  // is authoring rather than structure: an activity's map holds the keys that make sense in it. So the
  // state is `mine`, the row for the other activity says `nothing`, and a change reaches both, which is
  // the whole point of a page about the device rather than about one activity.
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const keys = keypadFor(
    H600, [binding({ scan, inActivity: 1, sends: [{ device: 0, command: 3 }] })], 0, ACTIVITIES);
  const mine = keys.filter((one) => one.state === 'mine');
  assert.equal(mine.length, 1);
  assert.deepEqual(mine[0]?.perActivity, [{ activity: 0 }, { activity: 1, command: 3 }]);
  assert.deepEqual(mine[0]?.writable, [0, 1]);
});

test('a key held in one activity and free in another is free, and does not report a foreign command', () => {
  // The half a state named after ownership gets wrong: the key is the other device's in activity 0 and
  // nothing's in activity 1, so there **is** room for it and an interface that called it taken would be
  // refusing something it can do. On the Harmony 600 configuration in the lab this is 31 of the first
  // device's 36 placeable keys, so it is the common case rather than an edge.
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const keys = keypadFor(
    H600, [binding({ scan, inActivity: 0, sends: [{ device: 1, command: 7 }] })], 0, ACTIVITIES);
  const found = keys.filter((one) => one.scan === scan);
  assert.equal(found[0]?.state, 'free');
  assert.equal(found[0]?.command, undefined, 'and it does not report another device\'s command as its own');
  assert.deepEqual(found[0]?.writable, [1]);
  assert.deepEqual(found[0]?.held, [0]);
});

test('a screen key and a key with no code are neither of them the keypad\'s', () => {
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const bindings: ButtonBinding[] = [
    // A screen key. A separate population that shares no code with the keypad on three of the four
    // architectures and exactly one on the fourth, so it is not this page's business.
    { surface: 'screen', scan, inDeviceMode: 1, sends: [{ device: 0, command: 3 }] },
    // And a binding with no scan at all, which the format allows: a key on an architecture whose codes
    // are not known. It cannot be matched to a drawn key and must not be counted as one.
    binding({ sends: [{ device: 0, command: 4 }] }),
  ];

  assert.deepEqual(keypadBindings(bindings), []);
  assert.deepEqual(keypadFor(H600, bindings, 0, ACTIVITIES)
    .filter((one) => one.state !== 'free' && one.state !== 'unmeasured'), []);
});

test('which activities drive a device is the activity\'s own declaration, not its bindings', () => {
  // **The two routes answer different questions and the writer needs this one.** An activity that drives
  // the television and has no key for it yet is exactly the case a first assignment is for, so reading the
  // bindings would refuse the very edit the page exists to make.
  const declared: readonly Activity[] = [
    { slot: 0, roles: [], onStart: [], onStop: [], wants: [], devices: [0] },
    { slot: 1, roles: [], onStart: [], onStop: [], wants: [], devices: [0, 1] },
    { slot: 2, roles: [], onStart: [], onStop: [], wants: [], devices: [] },
  ];
  assert.deepEqual(drivingActivities(declared, 0), [0, 1]);
  assert.deepEqual(drivingActivities(declared, 1), [1]);
  assert.deepEqual(drivingActivities(declared, 2), []);

  // And a binding naming an activity the document does not declare contributes nothing, since the rows are
  // built from the declared activities: reachable through a hand edited file, and inventing an activity
  // nothing else knows about is the one answer that must not happen.
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const keys = keypadFor(
    H600, [binding({ scan, inActivity: 9, sends: [{ device: 0, command: 3 }] })], 0, declared);
  const found = keys.filter((one) => one.scan === scan);
  assert.equal(found[0]?.state, 'free');
  assert.deepEqual(found[0]?.perActivity, [{ activity: 0 }, { activity: 1 }]);
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

/**
 * What each key of a drawn remote does for one device, and the two things this has to be honest about.
 *
 * **The subject is device mode, and Danny's picture of it is the one to hold on to**: switching to a device
 * is like reaching for the old remote that came with that appliance. There is nothing else on that remote,
 * so a key sends one of the appliance's commands or it sends nothing.
 *
 * Two earlier versions of this file put activities on the page and both were wrong about the same thing.
 * An activity's map is the mixed map of the same keypad, where any key may carry any appliance's command;
 * a device's map is one appliance. `src/shared/buttonmap.ts` records how that got got wrong twice.
 *
 * So there are three states, and the third exists because a key is drawn from measured geometry while its
 * scan code is a separate measurement, mostly not made: 36 of a Harmony 600's 54 keys have one, 34 of a
 * Harmony One's 44, and **none at all** of a Harmony 525's 50. A key with no code can never be pointed at
 * anything by anybody, which is not the same as a key nobody has pointed at yet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MODELS } from '@harmony/silhouettes';

import type { Activity, ButtonBinding } from '../src/shared/content.ts';
import { seededFromActivities } from '../src/shared/buttonmap.ts';
import { activitiesUsing, boundKeys, keypadBindings, keypadFor, measuredKeys, spelledOut }
  from '../src/renderer/src/viewmodels/keypad.model.ts';

const H600 = MODELS.h600!;

/** Two activities, both using both devices, which is what an activity question needs. */
const ACTIVITIES: readonly Activity[] = [0, 1].map((slot) => ({
  slot, roles: [], onStart: [], onStop: [], wants: [], sequences: [], devices: [0, 1],
}));

/** A device map binding: on the keypad, and with no activity, which is what makes it device mode's. */
function inDeviceMode(over: Partial<ButtonBinding> & Pick<ButtonBinding, 'sends'>): ButtonBinding {
  return { surface: 'keypad', ...over };
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
    [id, measuredKeys(keypadFor(model, [], 0))]));

  assert.deepEqual(counted, {
    // Not one of the fifty. Its scan codes have never been measured, so on a Harmony 525 this page can
    // draw the remote and bind nothing at all, which the page says when a key is pressed.
    h525: { measured: 0, total: 50 },
    h600: { measured: 36, total: 54 },
    one: { measured: 34, total: 44 },
  });
});

test('a key with no measured code is a different state from a key nobody has bound', () => {
  const keys = keypadFor(H600, [], 0);
  const free = keys.filter((one) => one.state === 'free');
  const unmeasured = keys.filter((one) => one.state === 'unmeasured');

  assert.equal(free.length, 36, 'every measured key is free on a device with no map yet');
  assert.equal(unmeasured.length, 18);
  assert.equal(boundKeys(keys), 0);
  // The distinction that makes it worth two states: one of these can be pointed at something today and
  // the other can never be, so an interface that drew them alike would be offering an action it has not
  // got. A candidate set is still no code, which is the arm that is easy to get wrong: a Harmony 525's
  // four soft keys are known to be four of a set of four and nothing says which is which.
  assert.deepEqual([...new Set(free.map((one) => one.scan !== undefined))], [true]);
  assert.deepEqual([...new Set(unmeasured.map((one) => one.scan))], [undefined]);
});

test('a key in the device\'s map sends one of its commands, and says which', () => {
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const keys = keypadFor(H600, [inDeviceMode({ scan, sends: [{ device: 1, command: 7 }] })], 1);

  const mine = keys.filter((one) => one.state === 'mine');
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.command, 7);
  assert.equal(boundKeys(keys), 1);
});

test('the same key in two devices\' maps is two maps, not a conflict', () => {
  // **The case the two earlier versions of this file could not express.** The television's old remote has
  // a Menu key and so does the amplifier's; you reach one by choosing the television and the other by
  // choosing the amplifier. So each map reports its own answer and neither knows about the other.
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const both = [
    inDeviceMode({ scan, sends: [{ device: 0, command: 3 }] }),
    inDeviceMode({ scan, sends: [{ device: 1, command: 7 }] }),
  ];

  assert.equal(keypadFor(H600, both, 0).find((one) => one.scan === scan)?.command, 3);
  assert.equal(keypadFor(H600, both, 1).find((one) => one.scan === scan)?.command, 7);
  // And neither is told that anything else holds it, because in its own map nothing does.
  assert.equal(keypadFor(H600, both, 0).find((one) => one.scan === scan)?.state, 'mine');
  assert.equal(keypadFor(H600, both, 1).find((one) => one.scan === scan)?.state, 'mine');
});

test('an activity\'s binding is a different map and does not appear in a device\'s', () => {
  // The separation, from the reading side. An activity map's bindings carry an activity; a device map's
  // carry none. A page about a device that read the activity bindings would show a key as taken when in
  // device mode it is free, which is what the second version of this file did.
  const [scan] = measuredScans();
  assert.ok(scan !== undefined);
  const keys = keypadFor(
    H600, [{ surface: 'keypad', scan, inActivity: 1, sends: [{ device: 0, command: 3 }] }], 0);

  assert.equal(keys.find((one) => one.scan === scan)?.state, 'free');
  assert.equal(boundKeys(keys), 0);
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
    inDeviceMode({ sends: [{ device: 0, command: 4 }] }),
  ];

  assert.deepEqual(keypadBindings(bindings), []);
  assert.equal(boundKeys(keypadFor(H600, bindings, 0)), 0);
});

test('an imported device map is what the activities agree on, and a disagreement stays unbound', () => {
  // **A configuration holds no device map at all**, measured over fifteen of them next door, so an import
  // reconstructs one: an activity's map is the device map plus that activity's overrides, so where the
  // activities agree, that is the device's own answer. 1096 of 1105 pairs across the corpus agree.
  //
  // The nine that do not are left out. A device map with a guess in it is worse than one with a hole,
  // because a hole can be filled by whoever knows and a guess cannot be spotted.
  const [agreed, split, once] = measuredScans();
  assert.ok(agreed !== undefined && split !== undefined && once !== undefined);
  const bindings: ButtonBinding[] = [
    { surface: 'keypad', scan: agreed, inActivity: 0, sends: [{ device: 0, command: 7 }] },
    { surface: 'keypad', scan: agreed, inActivity: 1, sends: [{ device: 0, command: 7 }] },
    { surface: 'keypad', scan: split, inActivity: 0, sends: [{ device: 0, command: 7 }] },
    { surface: 'keypad', scan: split, inActivity: 1, sends: [{ device: 0, command: 40 }] },
    // Bound in one activity only, which is 126 of the agreeing pairs in the corpus and is authoring
    // rather than a disagreement: one answer, so the device map gets it.
    { surface: 'keypad', scan: once, inActivity: 1, sends: [{ device: 0, command: 3 }] },
    // And another appliance's key, which contributes nothing to this device's map.
    { surface: 'keypad', scan: agreed, inActivity: 0, sends: [{ device: 1, command: 9 }] },
  ];

  const seeded = seededFromActivities(bindings, 0);
  const wanted: [number, number][] = [[agreed, 7], [once, 3]];
  assert.deepEqual([...seeded].sort((a, b) => a[0] - b[0]), wanted.sort((a, b) => a[0] - b[0]));
  assert.equal(seeded.has(split), false, 'the key the activities disagree about is left unbound');
});

test('which activities use a device is about the appliance, and never about a key', () => {
  // The one thing on a device page that names an activity, and it answers "where is this appliance used on
  // this remote". Nothing about a key comes from it, which is the correction of 22 August 2026.
  const declared: readonly Activity[] = [
    { slot: 0, roles: [], onStart: [], onStop: [], wants: [], sequences: [], devices: [0] },
    { slot: 1, roles: [], onStart: [], onStop: [], wants: [], sequences: [], devices: [0, 1] },
    { slot: 2, roles: [], onStart: [], onStop: [], wants: [], sequences: [], devices: [] },
  ];
  assert.deepEqual(activitiesUsing(declared, 0), [0, 1]);
  assert.deepEqual(activitiesUsing(declared, 1), [1]);
  assert.deepEqual(activitiesUsing(declared, 2), [], 'an appliance no activity uses still has a map');
  assert.deepEqual(activitiesUsing(ACTIVITIES, 0), [0, 1]);
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

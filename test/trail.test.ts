/**
 * The breadcrumb trail, walked over every screen there is, with no window.
 *
 * **The claim worth testing is that it describes where you are and not how you got there.** Those were
 * different things here while navigation kept a history: the same device page is reachable from Home and
 * from a remote, and a trail built out of the route would name a remote somebody merely passed through. So
 * the test that matters reaches one screen two ways and demands the same trail, and it is the first below.
 *
 * **Since 22 August 2026 it is also the only way around**, the back arrows having come off both bars, and
 * that puts a second claim in this file that used to live in `navigation.test.ts`: from every screen there
 * is, the trail offers a press that reaches the root. A stack could only ever be tested along a route
 * somebody thought to walk; this is tested on every screen at once, which is why the move is an improvement
 * rather than a shuffle.
 *
 * It walks every screen from the list the compiler already keeps honest, because a trail that returns
 * nothing for a screen nobody thought of is invisible: the bar would simply show a root and look like Home.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NavigationModel, type Screen } from '../src/renderer/src/viewmodels/navigation.model.ts';
import { libraryTrailFor, trailFor } from '../src/renderer/src/viewmodels/trail.model.ts';

/** Every screen there is, one of each, so the sweep below cannot silently miss one. */
const EVERY: Screen[] = [
  { at: 'home' },
  { at: 'add' },
  { at: 'name', model: { name: 'Harmony 600' }, origin: 'chooser' },
  { at: 'existing', model: { name: 'Harmony 600' }, origin: 'chooser' },
  { at: 'connect' },
  { at: 'preferences' },
  { at: 'remote', name: 'Living room' },
  { at: 'devices', name: 'Living room' },
  { at: 'device', name: 'Living room', slot: 2 },
  { at: 'activities', name: 'Living room' },
  { at: 'settings', name: 'Living room' },
];

test('the trail is the same however you got there, which is the whole reason it is not the history', () => {
  const viaHome = new NavigationModel(() => {});
  viaHome.go({ at: 'device', name: 'Living room', slot: 2 });

  const viaRemote = new NavigationModel(() => {});
  viaRemote.go({ at: 'remote', name: 'Living room' });
  viaRemote.go({ at: 'devices', name: 'Living room' });
  viaRemote.go({ at: 'device', name: 'Living room', slot: 2 });

  // Two different histories, one place, one trail. A trail built from the stack would give one crumb in
  // the first case and three in the second, and both would claim to say where you are.
  assert.deepEqual(trailFor(viaHome.screen).map((one) => one.label),
                   trailFor(viaRemote.screen).map((one) => one.label));
  assert.deepEqual(trailFor(viaHome.screen).map((one) => one.label),
                   ['FreeHarmony', 'Living room', 'Devices', 'Position 3']);
});

test('it starts at the root, and standing on the root is the one place it is not a link', () => {
  // A reversal, on the day the arrows went. It used to start **below** the root, because the root was
  // written as a title beside the trail and saying it twice on one screen is waste. Now the trail is the
  // navigation, so the root has to be in it: without it Home would be unreachable from anywhere.
  assert.deepEqual(trailFor({ at: 'home' }), [{ label: 'FreeHarmony' }]);
  assert.deepEqual(libraryTrailFor({ at: 'list' }), [{ label: 'Device library' }]);
});

test('from every screen there is, the root is one press away', () => {
  // The claim that replaced `canGoBack` and `back`, and the reason the trail could take their place. It is
  // asserted over the whole union rather than along a route, so a screen whose trail forgot its root fails
  // here on the day it is added.
  for (const screen of EVERY) {
    const first = trailFor(screen)[0];
    assert.equal(first?.label, 'FreeHarmony', `${screen.at} does not start at the root`);
    if (screen.at === 'home') assert.equal(first?.to, undefined, 'Home does not link to itself');
    else assert.deepEqual(first?.to, { at: 'home' }, `${screen.at} cannot reach Home`);
  }
  for (const screen of [{ at: 'add' } as const, { at: 'device', id: 'a' } as const]) {
    assert.deepEqual(libraryTrailFor(screen)[0]?.to, { at: 'list' },
                     `the panel's ${screen.at} cannot reach the list`);
  }
});

test('every screen has a trail, and every trail ends where you are', () => {
  for (const screen of EVERY) {
    const crumbs = trailFor(screen);
    assert.ok(crumbs.length > 0, `${screen.at} has no trail`);
    // The last crumb is never a link. A crumb you can press to arrive where you already are is a control
    // that does nothing, and pressing it teaches somebody the trail is decoration.
    assert.equal(crumbs[crumbs.length - 1]?.to, undefined, `${screen.at} links to itself`);
    // Every other crumb is a link, or the trail is a sentence rather than a way back.
    for (const crumb of crumbs.slice(0, -1)) {
      assert.notEqual(crumb.to, undefined, `${screen.at} has a dead crumb: ${crumb.label}`);
    }
  }
  // Exact, so a screen added to the union and forgotten here shows up as a count rather than as nothing.
  assert.equal(EVERY.length, 11);
});

test('the whole add flow is one crumb, because it is a sequence and not a tree', () => {
  // Three crumbs for three steps of one wizard would imply you can step back into the middle of it by
  // pressing one, which is not how it works: the steps carry a model between them.
  for (const screen of EVERY.filter((one) =>
    ['add', 'name', 'existing', 'connect'].includes(one.at))) {
    assert.deepEqual(trailFor(screen).map((one) => one.label), ['FreeHarmony', 'Add a remote']);
  }
});

test('a crumb says the name where the name is known, and the position where it is not', () => {
  const screen: Screen = { at: 'device', name: 'Living room', slot: 2 };

  // Loaded: the label somebody typed on that remote.
  assert.deepEqual(
    trailFor(screen, { deviceOn: () => 'Bedroom telly' }).map((one) => one.label),
    ['FreeHarmony', 'Living room', 'Devices', 'Bedroom telly']);
  // Not loaded, or a position with no name: the position, one based, which is what the tile beside it says
  // too. The trail is allowed to say it does not know yet; it is not allowed to say something false.
  assert.deepEqual(trailFor(screen).map((one) => one.label),
                   ['FreeHarmony', 'Living room', 'Devices', 'Position 3']);
});

test('the panel has its own trail, and it names the device rather than its identifier', () => {
  assert.deepEqual(libraryTrailFor({ at: 'add' }).map((one) => one.label),
                   ['Device library', 'Add device']);
  assert.deepEqual(
    libraryTrailFor({ at: 'device', id: 'appliance-a' },
                    { deviceInLibrary: () => 'The big telly' }).map((one) => one.label),
    ['Device library', 'The big telly']);
  // An identifier is a digest and means nothing to anybody, so where the name is not loaded the crumb says
  // the kind of thing it is instead. It must never fall back to the identifier.
  assert.deepEqual(libraryTrailFor({ at: 'device', id: 'appliance-a' }).map((one) => one.label),
                   ['Device library', 'Device']);
  // And the panel's root is its own word rather than the application's, which is what says a person is
  // somewhere else: the two trails are drawn one over the other and must not read as one path.
  assert.notEqual(libraryTrailFor({ at: 'list' })[0]?.label, trailFor({ at: 'home' })[0]?.label);
});

test('a middle crumb goes where it says, which is what makes the trail a way back', () => {
  const crumbs = trailFor({ at: 'device', name: 'Living room', slot: 2 });
  assert.deepEqual(crumbs[0]?.to, { at: 'home' });
  assert.deepEqual(crumbs[1]?.to, { at: 'remote', name: 'Living room' });
  assert.deepEqual(crumbs[2]?.to, { at: 'devices', name: 'Living room' });
});

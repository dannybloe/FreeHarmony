/**
 * Where the window is, and what happens to that when a document underneath it changes.
 *
 * Navigation is the state most likely to grow a quiet bug, because the wrong screen is obvious to a
 * person and invisible to every other test in this repository. So it is a plain module and this file
 * walks it with no browser, no React and no window at all.
 *
 * The two cases worth having are the last two: renaming a remote while looking at it, and removing it.
 * Both are the reason a screen holds a **name** rather than a document, and both would pass unnoticed
 * in a reader test while leaving somebody staring at a page about a folder that no longer exists.
 *
 * **Half of this file was about a history stack and there is none any more.** The back arrows came off both
 * bars on 22 August 2026 and the trail became the only way up, so `back`, `canGoBack` and the rewriting of
 * screens behind this one went with them. Those claims are not gone, they moved: "you can always get out of
 * here" is now a property of the trail and is asserted in `trail.test.ts`, where it is stronger, because a
 * trail can be checked on every screen at once and a stack could only be checked on the route somebody
 * thought to walk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { RemoteDocument } from '../src/shared/remote.ts';
import {
  NavigationModel, REMOTE_SCREENS, START, afterChoosingModel, remoteOn,
  type RemoteScreen, type Screen,
} from '../src/renderer/src/viewmodels/navigation.model.ts';

/** A model plus the screens it announced, in order. */
function record() {
  const seen: Screen[] = [];
  return { nav: new NavigationModel((screen) => seen.push(screen)), seen };
}

function remote(name: string): RemoteDocument {
  return {
    name, provenance: 'created-empty',
    createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z',
  };
}

/** The model the naming screen carries. A name and a skin, which is all a document ever stores. */
const A_HARMONY_ONE = { name: 'Harmony One', skin: 54 } as const;

test('it starts on Home', () => {
  const { nav } = record();
  assert.deepEqual(nav.screen, START);
});

test('the whole flow Danny sketched, forwards', () => {
  // Forwards only, and the way out is `trail.test.ts`: every screen's trail begins at a root that is a
  // press away from Home, which is the claim that replaced this test's second half.
  const { nav } = record();
  nav.go({ at: 'add' });
  nav.go({ at: 'name', model: A_HARMONY_ONE, origin: 'chooser' });
  assert.deepEqual(nav.screen, { at: 'name', model: A_HARMONY_ONE, origin: 'chooser' });
});

test('both routes into naming end on the same screen, which nothing afterwards can tell apart', () => {
  // This test used to be the argument for keeping a history: naming is reached from the chooser and from
  // the connect page, so "back" had to remember which. With the trail as the only way up that difference
  // is deliberately invisible, and the honest way to test it is to assert the two screens are equal
  // except for the one field that says where the model came from, since one page words itself differently.
  const model = { name: 'Harmony 600', skin: 71 } as const;
  const viaChooser = record();
  viaChooser.nav.go({ at: 'add' });
  viaChooser.nav.go({ at: 'name', model, origin: 'chooser' });

  const viaConnect = record();
  viaConnect.nav.go({ at: 'add' });
  viaConnect.nav.go({ at: 'connect' });
  viaConnect.nav.go({ at: 'name', model, origin: 'device' });

  assert.deepEqual({ ...viaChooser.nav.screen, origin: 'x' }, { ...viaConnect.nav.screen, origin: 'x' },
                   'the route is not part of where you are');
  assert.notDeepEqual(viaChooser.nav.screen, viaConnect.nav.screen, 'and the origin is the one exception');
});

test('going home is going home, from however deep in a flow', () => {
  const { nav } = record();
  nav.go({ at: 'add' });
  nav.go({ at: 'name', model: A_HARMONY_ONE, origin: 'chooser' });
  nav.home();

  assert.deepEqual(nav.screen, START);
});

test('every step is announced, because a screen redraws from what it is told', () => {
  const { nav, seen } = record();
  nav.go({ at: 'add' });
  nav.go({ at: 'remote', name: 'Woonkamer' });
  nav.home();

  assert.deepEqual(seen, [{ at: 'add' }, { at: 'remote', name: 'Woonkamer' }, START]);
});

test('renaming a remote you are looking at follows the new name', () => {
  // Held by name and not as a document, so this is the moment that arrangement earns itself.
  const { nav } = record();
  nav.go({ at: 'remote', name: 'Woonkamer' });
  nav.renamed('Woonkamer', 'Zolder');

  assert.deepEqual(nav.screen, { at: 'remote', name: 'Zolder' });
});

test('removing the remote you are looking at goes Home', () => {
  // Home and not "wherever you were before", which is what this asserted while there was a history. It is
  // the better answer as well as the only one left: the folder is gone, so the nearest place that is
  // certainly still there is the one the trail puts above it.
  const { nav } = record();
  nav.go({ at: 'remote', name: 'Woonkamer' });
  nav.removed('Woonkamer');

  assert.deepEqual(nav.screen, START);
});

test('removing a remote you are not looking at leaves you where you are', () => {
  // The control for the test above, and it is doing the same job the old "dropped from the way back"
  // test did: without it, a `removed` that simply went Home whatever was on screen would pass.
  const { nav } = record();
  nav.go({ at: 'remote', name: 'Zolder' });
  nav.removed('Woonkamer');

  assert.deepEqual(nav.screen, { at: 'remote', name: 'Zolder' });
});

test('a screen resolves its remote out of the list, and says nothing when it cannot', () => {
  // The folder somebody deleted in Finder while the window was open. A half drawn page is the failure
  // to avoid, so the honest answer is undefined and the view says so.
  const { nav } = record();
  assert.equal(nav.resolve([remote('Woonkamer')]), undefined, 'Home is not about a remote');

  nav.go({ at: 'remote', name: 'Woonkamer' });
  assert.equal(nav.resolve([remote('Woonkamer')])?.name, 'Woonkamer');
  assert.equal(nav.resolve([remote('Zolder')]), undefined);
  assert.equal(nav.resolve([]), undefined);
});

test('a model you already have a document of asks first, and one you do not goes straight on', () => {
  /**
   * Danny's question, on 21 August 2026, and the honest version of it.
   *
   * He asked whether the application can tell that a remote being added is one it already has a
   * document for. It can tell that a document of the same **model** exists, and it can never tell that
   * it is the same **unit**: a Harmony declares `iSerialNumber 0` in its USB descriptor, so enumeration
   * has no serial, and the per unit identifiers sit in the remote's internal flash behind an opened
   * device. So this rule matches models, and the screen it leads to says so in words.
   */
  const one = { name: 'Harmony One', skin: 54 } as const;
  const six = { name: 'Harmony 600', skin: 71 } as const;
  const woonkamer = { ...remote('Woonkamer'), model: one };

  assert.deepEqual(afterChoosingModel([], one, 'chooser'), { at: 'name', model: one, origin: 'chooser' },
                   'an empty store asks nothing');
  assert.deepEqual(afterChoosingModel([woonkamer], six, 'device'), { at: 'name', model: six, origin: 'device' },
                   'and neither does a different model');
  assert.deepEqual(afterChoosingModel([woonkamer], one, 'device'),
                   { at: 'existing', model: one, origin: 'device' },
                   'the same model asks, and carries how it got here');
});

test('a regional twin counts as the same model, which is the case a skin comparison gets wrong', () => {
  // The reason the rule goes through `isSameModel` and not through skin equality. A European Harmony
  // One reports skin 59 and the chooser records 54 for the same drawing, so somebody plugging in their
  // own remote after adding it by hand must be asked rather than quietly given a second document.
  const fromTheChooser = { ...remote('Woonkamer'), model: { name: 'Harmony One', skin: 54 } };
  const european = { name: 'Harmony One', skin: 59 } as const;

  assert.equal(afterChoosingModel([fromTheChooser], european, 'device').at, 'existing');
});

test('a document with no model recorded matches nothing, so it never blocks adding one', () => {
  // Documents written before the model field existed, and any whose model nobody knows. Treating an
  // unknown model as a match would ask a question about a remote it cannot name.
  const nameless = remote('Zolder');
  assert.equal(nameless.model, undefined, 'the input');
  assert.equal(afterChoosingModel([nameless], { name: 'Harmony One', skin: 54 }, 'chooser').at, 'name');
});

test('every screen about a remote follows a rename, not just the remote page itself', () => {
  // The bug this arrangement was restructured to make impossible. `renamed` used to test `at === 'remote'`
  // outright, which was right while that was the only screen about a remote and would have gone wrong the
  // moment there were five: renaming from the devices page would leave that page naming a folder that is
  // no longer there.
  //
  // The list is walked rather than three cases being picked, so a screen added later is covered here on
  // the day it is added, and `REMOTE_SCREENS_ARE_EXHAUSTIVE` is what stops the list itself drifting.
  for (const at of REMOTE_SCREENS) {
    const { nav } = record();
    const screen = { at, name: 'Woonkamer', ...(at === 'device' ? { slot: 3 } : {}) } as RemoteScreen;
    nav.go(screen);
    nav.renamed('Woonkamer', 'Zolder');

    assert.equal(remoteOn(nav.screen), 'Zolder', `${at} did not follow the rename`);
    // And nothing else about the screen was lost, which is the failure a rebuild would have introduced:
    // a device page rebuilt as `{ at, name }` lands somebody on a page about device zero.
    assert.deepEqual(nav.screen, { ...screen, name: 'Zolder' });
  }
});

test('every screen about a remote is dropped when it is removed', () => {
  for (const at of REMOTE_SCREENS) {
    const { nav } = record();
    nav.go({ at, name: 'Woonkamer', ...(at === 'device' ? { slot: 3 } : {}) } as RemoteScreen);
    nav.removed('Woonkamer');

    assert.deepEqual(nav.screen, START, `${at} stayed on a remote that is gone`);
  }
});

test('a screen about no remote is left alone by both of them', () => {
  // The control. Without it the two tests above would pass against a `renamed` that rewrote every screen
  // it could find, which would put a remote's name on the preferences page.
  for (const screen of [{ at: 'home' } as const, { at: 'add' } as const,
                        { at: 'connect' } as const, { at: 'preferences' } as const]) {
    assert.equal(remoteOn(screen), undefined, `${screen.at} claims to be about a remote`);
    const { nav } = record();
    nav.go(screen);
    nav.renamed('Woonkamer', 'Zolder');
    assert.deepEqual(nav.screen, screen);
  }
});

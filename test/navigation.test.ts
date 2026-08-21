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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { RemoteDocument } from '../src/shared/remote.ts';
import { NavigationModel, START, type Screen } from '../src/renderer/src/viewmodels/navigation.model.ts';

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

test('it starts on Home, where there is nowhere to go back to', () => {
  const { nav } = record();
  assert.deepEqual(nav.screen, START);
  assert.equal(nav.canGoBack, false);
});

test('the whole flow Danny sketched, forwards and then all the way back', () => {
  const { nav } = record();
  nav.go({ at: 'add' });
  nav.go({ at: 'name', model: A_HARMONY_ONE, origin: 'chooser' });
  assert.deepEqual(nav.screen, { at: 'name', model: A_HARMONY_ONE, origin: 'chooser' });
  assert.equal(nav.canGoBack, true);

  nav.back();
  assert.deepEqual(nav.screen, { at: 'add' }, 'naming came from the chooser');
  nav.back();
  assert.deepEqual(nav.screen, START, 'and the chooser came from Home');
  assert.equal(nav.canGoBack, false);
});

test('the other route in: connect, and back from it lands where you came from', () => {
  // The case a rule of "every screen has one parent" gets wrong. Naming is reached from the chooser and
  // from the connect page, so back has to remember which, and that is why there is a stack.
  const { nav } = record();
  nav.go({ at: 'add' });
  nav.go({ at: 'connect' });
  nav.go({ at: 'name', model: { name: 'Harmony 600', skin: 71 }, origin: 'device' });

  nav.back();
  assert.deepEqual(nav.screen, { at: 'connect' }, 'not the chooser, which is where a rule would go');
  nav.back();
  assert.deepEqual(nav.screen, { at: 'add' });
});

test('going home clears the way back, so a fresh start is a fresh start', () => {
  const { nav } = record();
  nav.go({ at: 'add' });
  nav.go({ at: 'name', model: A_HARMONY_ONE, origin: 'chooser' });
  nav.home();

  assert.deepEqual(nav.screen, START);
  assert.equal(nav.canGoBack, false);
  nav.back();
  assert.deepEqual(nav.screen, START, 'and back from Home stays on Home rather than reopening a page');
});

test('every step is announced, because a screen redraws from what it is told', () => {
  const { nav, seen } = record();
  nav.go({ at: 'add' });
  nav.go({ at: 'remote', name: 'Woonkamer' });
  nav.back();

  assert.deepEqual(seen, [{ at: 'add' }, { at: 'remote', name: 'Woonkamer' }, { at: 'add' }]);
});

test('renaming a remote you are looking at follows the new name, here and behind', () => {
  // Held by name and not as a document, so this is the moment that arrangement earns itself. The stack
  // is rewritten too: going back to a page naming the old folder is the same bug arriving later.
  const { nav } = record();
  nav.go({ at: 'remote', name: 'Woonkamer' });
  nav.go({ at: 'add' });
  nav.renamed('Woonkamer', 'Zolder');

  assert.deepEqual(nav.screen, { at: 'add' }, 'the current screen was not about it');
  nav.back();
  assert.deepEqual(nav.screen, { at: 'remote', name: 'Zolder' }, 'but the one behind was');
});

test('removing the remote you are looking at leaves the page', () => {
  const { nav } = record();
  nav.go({ at: 'add' });
  nav.go({ at: 'remote', name: 'Woonkamer' });
  nav.removed('Woonkamer');

  assert.deepEqual(nav.screen, { at: 'add' }, 'back to where it was opened from');
  nav.back();
  assert.deepEqual(nav.screen, START, 'and nothing on the stack still names it');
});

test('a removed remote is dropped from the way back as well', () => {
  const { nav } = record();
  nav.go({ at: 'remote', name: 'Woonkamer' });
  nav.go({ at: 'add' });
  nav.removed('Woonkamer');

  nav.back();
  assert.deepEqual(nav.screen, START, 'the page about it is gone from the stack, not shown again');
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

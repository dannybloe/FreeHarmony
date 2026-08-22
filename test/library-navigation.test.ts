/**
 * Where the device library panel is, with no window.
 *
 * **These five tests moved here rather than being written.** Their subject was the library as two screens
 * in the application's own navigation, which is where it lived on 22 August 2026 until Danny asked for a
 * panel over the application instead. The claims are the same and the model under them is a second place,
 * so the tests followed their subject. What they gained is the property the old shape could not have: that
 * the application does not move while the panel is open.
 *
 * That property is the reason the panel has its own model at all, so it is the first test in the file.
 *
 * **Four of them were about a history and are rewritten**, on the day the back arrows came off both bars.
 * Two are the same claim stated against what is left, one became a control that says what `removed` may not
 * do, and one, `replace`, tested a method whose whole purpose was to stop `go` pushing onto a stack there
 * is no longer any of. That last one is gone, which is the only ground this project removes a test on: the
 * code it exercised has left the repository.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LIBRARY_START, LibraryNavigationModel, idOn,
} from '../src/renderer/src/viewmodels/library-navigation.model.ts';
import { NavigationModel } from '../src/renderer/src/viewmodels/navigation.model.ts';
import { libraryTrailFor } from '../src/renderer/src/viewmodels/trail.model.ts';

test('the application does not move while the panel is over it', () => {
  const app = new NavigationModel(() => {});
  app.go({ at: 'devices', name: 'Living room' });
  const before = app.screen;

  const panel = new LibraryNavigationModel(() => {});
  panel.openFrom('Living room');
  panel.go({ at: 'device', id: 'appliance-a' });
  panel.go(LIBRARY_START);
  panel.close();

  // Byte for byte the same object, not merely an equal one: the two models share nothing, which is what
  // makes the application's own trail safe to leave exactly where it was.
  assert.equal(app.screen, before);
  assert.deepEqual(app.screen, { at: 'devices', name: 'Living room' });
});

test('the panel remembers which remote it was opened from, and forgets on the next open', () => {
  const panel = new LibraryNavigationModel(() => {});
  assert.equal(panel.from, undefined);

  panel.openFrom('Living room');
  assert.equal(panel.from, 'Living room');
  // That is what lets a device offer to join the remote you came from. Opened from Home there is nothing
  // to join, and the offer has to be absent rather than pointing at whichever remote was last open.
  panel.close();
  panel.openFrom(undefined);
  assert.equal(panel.from, undefined);
});

test('it always opens on the list, whatever it was showing last time', () => {
  const panel = new LibraryNavigationModel(() => {});
  panel.openFrom(undefined);
  panel.go({ at: 'device', id: 'appliance-a' });
  panel.close();

  panel.openFrom(undefined);
  // A panel that reopened on the device somebody was looking at an hour ago answers a question nobody
  // asked, and the list is one press from anything.
  assert.deepEqual(panel.screen, LIBRARY_START);
});

test('a device is held by identifier, which is the opposite rule from a remote', () => {
  // A remote is held by name because its name **is** its folder, so a rename has to follow. A device's
  // name is a correctable field, so holding one would put the screen on the wrong device the moment
  // somebody fixed a spelling.
  assert.equal(idOn({ at: 'device', id: 'appliance-a' }), 'appliance-a');
  // The commands page is about one appliance too, so deleting that appliance has to take you off it. A
  // screen this did not answer for would leave the panel on a page about a file that is gone.
  assert.equal(idOn({ at: 'commands', id: 'appliance-a' }), 'appliance-a');
  assert.equal(idOn({ at: 'list' }), undefined);
  assert.equal(idOn({ at: 'add' }), undefined);
});

test('throwing a device away leaves its commands page too', () => {
  const panel = new LibraryNavigationModel(() => {});
  panel.openFrom(undefined);
  panel.go({ at: 'commands', id: 'appliance-a' });

  panel.removed('appliance-b');
  assert.deepEqual(panel.screen, { at: 'commands', id: 'appliance-a' }, 'somebody else going changes nothing');
  panel.removed('appliance-a');
  assert.deepEqual(panel.screen, LIBRARY_START);
});

test('throwing a device away leaves its page and lands on the list', () => {
  const panel = new LibraryNavigationModel(() => {});
  panel.openFrom(undefined);
  panel.go({ at: 'device', id: 'appliance-a' });

  panel.removed('appliance-a');

  assert.deepEqual(panel.screen, LIBRARY_START);
});

test('a device seen twice is still only left once, from wherever you are standing', () => {
  // This was "a deleted device is taken out of the history too", which was a claim about a stack. Two
  // device pages in a row is the ordinary case rather than a contrived one, since copying lands on the
  // copy's page, and what is left to check is that deleting is about the screen and not about the route:
  // standing on B when A goes leaves you on B, and standing on A when A goes puts you on the list.
  const panel = new LibraryNavigationModel(() => {});
  panel.openFrom(undefined);
  panel.go({ at: 'device', id: 'appliance-a' });
  panel.go({ at: 'device', id: 'appliance-b' });

  panel.removed('appliance-a');
  assert.deepEqual(panel.screen, { at: 'device', id: 'appliance-b' });

  panel.go({ at: 'device', id: 'appliance-b' });
  panel.removed('appliance-b');
  assert.deepEqual(panel.screen, LIBRARY_START);
});

test('another device being deleted leaves this page where it is', () => {
  const panel = new LibraryNavigationModel(() => {});
  panel.openFrom(undefined);
  panel.go({ at: 'device', id: 'appliance-a' });
  // The control. Without it the two tests above pass for a model that leaves on any delete at all.
  panel.removed('appliance-b');
  assert.deepEqual(panel.screen, { at: 'device', id: 'appliance-a' });
});

test('the panel reports every change, since a window redraws from them', () => {
  let told = 0;
  const panel = new LibraryNavigationModel(() => { told += 1; });
  panel.openFrom('Living room');
  panel.go({ at: 'add' });
  panel.go(LIBRARY_START);
  panel.removed('appliance-a');
  panel.close();

  // Five, exactly: a model that stayed quiet on one of them is a panel that does not redraw, and the one
  // most likely to be forgotten is `removed` on a screen that was not about that device.
  assert.equal(told, 5);
});

test('a finished form lands on the new device, and the way out of it is the list', () => {
  // What the two `replace` tests were about, stated against a model with no history in it. The bug they
  // pinned was that back from a new device's page was the form you had just submitted, still holding the
  // words of the device you had just made, offering to make it again. It cannot happen now for a
  // structural reason rather than a careful one: the trail out of a device is the list, whatever route
  // reached it, so there is no longer a call that could get this wrong.
  const panel = new LibraryNavigationModel(() => {});
  panel.openFrom(undefined);
  panel.go({ at: 'add' });
  panel.go({ at: 'device', id: 'appliance-typed-new' });

  assert.deepEqual(panel.screen, { at: 'device', id: 'appliance-typed-new' });
  assert.deepEqual(libraryTrailFor(panel.screen).map((crumb) => crumb.to),
                   [LIBRARY_START, undefined],
                   'one step above a device, and it is the list rather than the form');
});

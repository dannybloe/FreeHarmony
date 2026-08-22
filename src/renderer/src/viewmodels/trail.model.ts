/**
 * The breadcrumb trail, derived from where you are and never from how you got there.
 *
 * **That distinction is the whole design, and it is what let the history go.** You can reach a device from
 * Home or from a remote, so a trail built out of where you have been would name a remote you merely passed
 * through, or name the same thing twice. A trail built out of the screen says where you **are**, which is
 * what a trail is for. Once that is the only way around, nothing needs to remember how you got here, and
 * `navigation.model.ts` keeps no stack: a tree has a parent per node and the trail is that parent chain.
 *
 * **It starts at the root and it is the only way around**, which is Danny's decision of 22 August 2026 and
 * a reversal of what this file said for a day. The trail used to begin below the root, because the root was
 * already written as a title beside it and saying it twice on one screen is waste. Then the back arrow went
 * away: navigation is the trail now, so the root has to be in it or Home is unreachable from anywhere. So
 * "FreeHarmony > Woonkamer > Activities", with every step but the last a way there.
 *
 * The root is a crumb like any other and carries no `to` when you are standing on it, which is what stops
 * Home offering a press that goes to Home.
 *
 * No React and no DOM, so `node:test` walks every screen.
 */
import type { LibraryScreen } from './library-navigation.model.ts';
import type { Screen } from './navigation.model.ts';

export interface Crumb {
  readonly label: string;
  /**
   * Where pressing it goes, or absent because it is where you already are.
   *
   * The last crumb is deliberately not a link. A crumb you can press to arrive where you already are is a
   * control that does nothing, and a person who presses it learns that the trail is decoration.
   */
  readonly to?: Screen;
}

export interface LibraryCrumb {
  readonly label: string;
  readonly to?: LibraryScreen;
}

/**
 * What the names of things are, asked rather than held.
 *
 * A trail needs words the screen does not carry: a device position has a label in the document's contents,
 * and a library device has a name in the library. Passing them in keeps this a pure function, and it means
 * a crumb can honestly say it does not know yet: a name that has not loaded gives `undefined` and the
 * fallback says the position, which is what the tile beside it says too.
 */
export interface TrailNames {
  readonly deviceOn?: (remote: string, slot: number) => string | undefined;
  readonly deviceInLibrary?: (id: string) => string | undefined;
}

/** The first crumb, and the only one that is on every trail. */
const ROOT = 'FreeHarmony';

export function trailFor(screen: Screen, names: TrailNames = {}): Crumb[] {
  return [screen.at === 'home' ? { label: ROOT } : { label: ROOT, to: { at: 'home' } },
          ...below(screen, names)];
}

function below(screen: Screen, names: TrailNames): Crumb[] {
  switch (screen.at) {
    case 'home':
      return [];
    // The add flow is a sequence and not a tree, so it gets one crumb saying what you are doing and goes
    // no deeper. Three crumbs for three steps of one wizard would imply you can step back into the middle
    // of it by pressing one, which is not how it works.
    case 'add':
    case 'name':
    case 'existing':
    case 'connect':
      return [{ label: 'Add a remote' }];
    case 'preferences':
      return [{ label: 'Preferences' }];
    case 'remote':
      return [{ label: screen.name }];
    case 'devices':
      return [remote(screen.name), { label: 'Devices' }];
    case 'device':
      return [
        remote(screen.name),
        { label: 'Devices', to: { at: 'devices', name: screen.name } },
        { label: names.deviceOn?.(screen.name, screen.slot) ?? `Position ${screen.slot + 1}` },
      ];
    case 'activities':
      return [remote(screen.name), { label: 'Activities' }];
    case 'settings':
      return [remote(screen.name), { label: 'Settings' }];
  }
}

/** The panel's own root. Its own word, because the panel is a place and not a screen of the application. */
const LIBRARY_ROOT = 'Device library';

export function libraryTrailFor(screen: LibraryScreen, names: TrailNames = {}): LibraryCrumb[] {
  return [screen.at === 'list' ? { label: LIBRARY_ROOT } : { label: LIBRARY_ROOT, to: { at: 'list' } },
          ...libraryBelow(screen, names)];
}

function libraryBelow(screen: LibraryScreen, names: TrailNames): LibraryCrumb[] {
  switch (screen.at) {
    case 'list':
      return [];
    case 'add':
      return [{ label: 'Add device' }];
    case 'device':
      return [{ label: names.deviceInLibrary?.(screen.id) ?? 'Device' }];
  }
}

function remote(name: string): Crumb {
  return { label: name, to: { at: 'remote', name } };
}

/**
 * Where the device library panel is, as a place of its own.
 *
 * **A second place of its own rather than more screens in the first**, decided with Danny on 22 August
 * 2026. The panel lies over the application, which does not change while it is open, so where you are in
 * the panel and where you are in the application are two different questions with two different trails.
 * The panel keeps its own, headed "Device library", and the application's stays exactly as it was and is
 * unreachable because there is a panel over it.
 *
 * The alternative was one set of screens with a flag saying which draw as an overlay, and it fails on
 * closing: one trail would have to mean two things depending on what was open, which is the class of
 * thing that works until somebody navigates in an order nobody tried.
 *
 * **Neither side keeps a history**, since the day the back arrows went: the trail is the way up, and it is
 * derived from the screen. `back`, `canGoBack` and `replace` went with them, `replace` having existed only
 * to stop `go` pushing.
 *
 * No React and no DOM, like `navigation.model.ts` next door, so every path is walkable by `node:test`.
 */

/** The screens inside the panel. `inputs` and `settings` exist as places; their pages are a later round. */
export type LibraryScreen =
  | { readonly at: 'list' }
  | { readonly at: 'add' }
  | { readonly at: 'device'; readonly id: string }
  /**
   * One appliance's commands, which is where a code read off a remote gets a word put on it.
   *
   * A screen of its own under the device rather than a block on its page, because there are 81 of them on
   * an ordinary television and because it is the one page somebody sits at for ten minutes typing.
   */
  | { readonly at: 'commands'; readonly id: string };

export const LIBRARY_START: LibraryScreen = { at: 'list' };

/**
 * Which remote the panel was opened from, so a device can offer to join it.
 *
 * Captured when the panel opens and **never** read live from the application, which is the point: the
 * application does not move while the panel is over it, so a live reading would be the same answer with a
 * longer route. Absent when the panel was opened from Home or from anywhere else not about one remote.
 */
export type LibraryContext = string | undefined;

export class LibraryNavigationModel {
  #screen: LibraryScreen = LIBRARY_START;
  #open = false;
  #from: LibraryContext = undefined;
  readonly #changed: () => void;

  constructor(changed: () => void) {
    this.#changed = changed;
  }

  get open(): boolean {
    return this.#open;
  }

  get screen(): LibraryScreen {
    return this.#screen;
  }

  /** The remote the panel was opened from, or `undefined`. */
  get from(): LibraryContext {
    return this.#from;
  }

  /**
   * Open it, remembering where from.
   *
   * **Always on the list**, however it was left last time. A panel that reopened on the device somebody
   * happened to be looking at an hour ago would be a panel that answers a question nobody asked; the list
   * is one click from anything.
   */
  openFrom(remote: LibraryContext): void {
    this.#open = true;
    this.#from = remote;
    this.#screen = LIBRARY_START;
    this.#changed();
  }

  close(): void {
    this.#open = false;
    this.#changed();
  }

  go(to: LibraryScreen): void {
    this.#screen = to;
    this.#changed();
  }

  /**
   * A device was thrown away, so nothing in here may still be pointing at it.
   *
   * The same shape as the application's own, and the same answer: back to the list, which is the place
   * above a device and the only place that is certainly still there.
   */
  removed(id: string): void {
    if (idOn(this.#screen) === id) this.#screen = LIBRARY_START;
    this.#changed();
  }
}

/** Which device a panel screen is about, if any. */
export function idOn(screen: LibraryScreen): string | undefined {
  return screen.at === 'device' || screen.at === 'commands' ? screen.id : undefined;
}

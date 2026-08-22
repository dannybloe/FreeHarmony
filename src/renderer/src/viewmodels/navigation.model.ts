/**
 * Which screen the window is on, as a plain module.
 *
 * **No React, no DOM.** Navigation is the state most likely to grow a quiet bug, because the wrong
 * screen is obvious to a person and invisible to a reader test, so it lives here where `node:test` can
 * walk every path with no browser at all. `useNavigation.ts` next door connects it to React.
 *
 * There is no router. There are no URLs in a desktop window and nothing links into it, so a router
 * would be a dependency plus a second place that says which screens exist. What a router does buy is
 * the history stack, and that is nine lines below.
 *
 * **A remote is held by name and never as an object.** The truth is on disk, so a screen that kept a
 * copy would be showing a remote that had since been renamed or deleted. Renaming follows the new
 * name; deleting drops the screen and anything behind it that pointed at the same remote.
 *
 * **Which screens those are is one list, and the compiler checks it against the type.** Renaming and
 * removing used to test `at === 'remote'` outright, which was correct while that was the only screen
 * about a remote and became a bug the moment there were five: renaming from the devices page would have
 * left every screen behind it naming a folder that no longer exists. So `REMOTE_SCREENS` is the list,
 * `RemoteScreen` is the type, and `REMOTE_SCREENS_ARE_EXHAUSTIVE` fails the typecheck if they disagree
 * in either direction. Adding a screen about a remote and forgetting this is not possible.
 */
import { isSameModel } from '../catalogue.ts';
import type { RemoteDocument, RemoteModel } from '../../../shared/remote.ts';

/** Where the model on the naming screen came from, which is the one thing that screen words differently. */
export type ModelOrigin = 'chooser' | 'device';

export type Screen =
  | { readonly at: 'home' }
  | { readonly at: 'add' }
  /**
   * Naming a new remote, carrying the model it is going to be.
   *
   * The model itself rather than a drawing's id, and that is a correction: an id could only name a
   * model this application has drawn, and a remote read off the USB bus is usually not one. Three of
   * the forty retired models are drawn, so the screen has to work with a name and a skin and no
   * picture, and `RemoteModel` is exactly that. It is also plain data, which is the rule this module
   * holds to, and it is exactly what the document will be created with.
   */
  | {
      readonly at: 'name';
      readonly model: RemoteModel;
      readonly origin: ModelOrigin;
      /**
       * Which attached remote this came from, on the device route only.
       *
       * Carried because the naming page offers to ask that remote what it is, and asking means opening
       * it, so the page has to know which one. A product id names a **model**, so this is not an
       * identity and cannot be used as one; it is a selector, and it is only ever set when exactly one
       * remote of that model was attached, which is what `theRecognisedOne` establishes.
       */
      readonly productId?: number;
    }
  /**
   * You already have one of these. Open it, or add another?
   *
   * It carries the model and not the documents that match it, for the same reason the remote screen
   * carries a name: the list is on disk and the matches are derived from it every time it is drawn, so
   * a document renamed or deleted while this page is open cannot leave a stale entry on it.
   */
  | {
      readonly at: 'existing';
      readonly model: RemoteModel;
      readonly origin: ModelOrigin;
      readonly productId?: number;
    }
  | { readonly at: 'connect' }
  /** The application's own settings, which are about no remote in particular. */
  | { readonly at: 'preferences' }
  | RemoteScreen;

/**
 * The screens about one particular remote, every one of them carrying its name.
 *
 * They are a type of their own because renaming and removing have to treat them alike, and because that
 * is the property a reader has to be able to check at a glance rather than by reading two methods.
 */
export type RemoteScreen =
  /** The remote itself: what it is, what is on it, and the way in to the three below. */
  | { readonly at: 'remote'; readonly name: string }
  | { readonly at: 'devices'; readonly name: string }
  /** One device position on that remote. The position and not the appliance, which may be unknown. */
  | { readonly at: 'device'; readonly name: string; readonly slot: number }
  | { readonly at: 'activities'; readonly name: string }
  | { readonly at: 'settings'; readonly name: string };

/** Which screens are about a remote, as data, so `renamed` and `removed` need no list of their own. */
export const REMOTE_SCREENS = ['remote', 'devices', 'device', 'activities', 'settings'] as const;

type Exhaustive<Listed extends string, Union extends string> = [Listed] extends [Union]
  ? [Union] extends [Listed]
    ? true
    : never
  : never;

/** Fails the typecheck if the list and the type stop naming the same screens, in either direction. */
export const REMOTE_SCREENS_ARE_EXHAUSTIVE:
  Exhaustive<(typeof REMOTE_SCREENS)[number], RemoteScreen['at']> = true;

/** Whether a screen is about one remote, and if so which. `undefined` for the rest. */
export function remoteOn(screen: Screen): string | undefined {
  return (REMOTE_SCREENS as readonly string[]).includes(screen.at)
    ? (screen as RemoteScreen).name
    : undefined;
}

export const START: Screen = { at: 'home' };

/**
 * Where a chosen or detected model goes next: straight to naming, or past the question first.
 *
 * Danny's, on 21 August 2026, and the honest version of it is narrower than the ask. He asked whether
 * the application can tell that a remote being added is one it already has a document for. It cannot, per
 * unit: a Harmony declares `iSerialNumber 0` in its USB descriptor so enumeration has no serial to
 * report, and the per unit identifiers sit in the remote's internal flash behind an opened device. What
 * it can tell is that a document of the same **model** exists, which is what this asks, and the screen it
 * leads to says "a Harmony One" and never "this remote".
 *
 * It is a function rather than a branch in the shell because it is the decision, and because both routes
 * in need it: picking a model from the chooser and plugging one in are the same question.
 *
 * `isSameModel` is imported rather than passed in, which is worth a line because the first version took it
 * as a parameter to keep this module free of the drawing library. That was the wrong instinct: there is
 * one answer to "is this the same remote" and injecting it would let a caller supply a second. The
 * catalogue is claimed by the Node typecheck for exactly this reason, so a test walks it here unchanged.
 */
export function afterChoosingModel(
  remotes: readonly RemoteDocument[],
  model: RemoteModel,
  origin: ModelOrigin,
  productId?: number,
): Screen {
  const already = remotes.some((remote) => isSameModel(remote.model, model));
  if (already) return { at: 'existing', model, origin, ...(productId === undefined ? {} : { productId }) };
  return { at: 'name', model, origin, ...(productId === undefined ? {} : { productId }) };
}

export class NavigationModel {
  #screen: Screen = START;
  /** Where `back` goes, oldest first. Home is never on it: it is where an empty stack lands. */
  #behind: Screen[] = [];
  readonly #changed: (screen: Screen) => void;

  constructor(changed: (screen: Screen) => void) {
    this.#changed = changed;
  }

  get screen(): Screen {
    return this.#screen;
  }

  /** Whether there is anywhere to go back to, which is what draws the arrow in the bar. */
  get canGoBack(): boolean {
    return this.#screen.at !== 'home';
  }

  go(to: Screen): void {
    if (this.#screen.at !== 'home') this.#behind.push(this.#screen);
    this.#emit(to);
  }

  back(): void {
    this.#emit(this.#behind.pop() ?? START);
  }

  home(): void {
    this.#behind = [];
    this.#emit(START);
  }

  /**
   * A remote was renamed, so every screen naming it names the new one.
   *
   * Both the current screen and the ones behind it, because going back to a page that names a folder
   * that no longer exists is the same bug arriving a moment later.
   *
   * The name is replaced and **nothing else about the screen is**, which is why this spreads rather than
   * rebuilding: the device page carries a slot as well, and rebuilding it as `{ at, name }` would drop
   * that and land somebody on a page about device zero.
   */
  renamed(from: string, to: string): void {
    this.#behind = this.#behind.map((screen) => withName(screen, from, to));
    const here = withName(this.#screen, from, to);
    if (here !== this.#screen) this.#emit(here);
  }

  /** A remote was removed, so nothing may still be pointing at it. */
  removed(name: string): void {
    this.#behind = this.#behind.filter((screen) => remoteOn(screen) !== name);
    if (remoteOn(this.#screen) === name) this.back();
  }

  /**
   * The remote this screen is about, resolved against the list the main process gave us.
   *
   * `undefined` where the screen is not about one, and **also** where it names one the list does not
   * hold: a folder somebody deleted in Finder while the window was open is a real case, and the honest
   * answer there is that there is nothing to show rather than a half drawn page.
   */
  resolve(remotes: readonly RemoteDocument[]): RemoteDocument | undefined {
    const wanted = remoteOn(this.#screen);
    return wanted === undefined ? undefined : remotes.find((r) => r.name === wanted);
  }

  #emit(screen: Screen): void {
    this.#screen = screen;
    this.#changed(screen);
  }
}

/** The same screen under a new name, or the very same object when it was not about that remote. */
function withName(screen: Screen, from: string, to: string): Screen {
  return remoteOn(screen) === from ? { ...(screen as RemoteScreen), name: to } : screen;
}

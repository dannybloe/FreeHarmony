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
  | { readonly at: 'name'; readonly model: RemoteModel; readonly origin: ModelOrigin }
  /**
   * You already have one of these. Open it, or add another?
   *
   * It carries the model and not the documents that match it, for the same reason the remote screen
   * carries a name: the list is on disk and the matches are derived from it every time it is drawn, so
   * a document renamed or deleted while this page is open cannot leave a stale entry on it.
   */
  | { readonly at: 'existing'; readonly model: RemoteModel; readonly origin: ModelOrigin }
  | { readonly at: 'connect' }
  | { readonly at: 'remote'; readonly name: string };

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
): Screen {
  const already = remotes.some((remote) => isSameModel(remote.model, model));
  return already ? { at: 'existing', model, origin } : { at: 'name', model, origin };
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
   */
  renamed(from: string, to: string): void {
    this.#behind = this.#behind.map((s) => (s.at === 'remote' && s.name === from ? { at: 'remote', name: to } : s));
    if (this.#screen.at === 'remote' && this.#screen.name === from) this.#emit({ at: 'remote', name: to });
  }

  /** A remote was removed, so nothing may still be pointing at it. */
  removed(name: string): void {
    this.#behind = this.#behind.filter((s) => !(s.at === 'remote' && s.name === name));
    if (this.#screen.at === 'remote' && this.#screen.name === name) this.back();
  }

  /**
   * The remote this screen is about, resolved against the list the main process gave us.
   *
   * `undefined` where the screen is not about one, and **also** where it names one the list does not
   * hold: a folder somebody deleted in Finder while the window was open is a real case, and the honest
   * answer there is that there is nothing to show rather than a half drawn page.
   */
  resolve(remotes: readonly RemoteDocument[]): RemoteDocument | undefined {
    if (this.#screen.at !== 'remote') return undefined;
    const wanted = this.#screen.name;
    return remotes.find((r) => r.name === wanted);
  }

  #emit(screen: Screen): void {
    this.#screen = screen;
    this.#changed(screen);
  }
}

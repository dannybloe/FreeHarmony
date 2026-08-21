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
import type { RemoteDocument } from '../../../shared/remote.ts';

export type Screen =
  | { readonly at: 'home' }
  | { readonly at: 'add' }
  /** Choosing a model by hand. The id, not the model, so this state stays plain data. */
  | { readonly at: 'name'; readonly modelId: string }
  | { readonly at: 'connect' }
  | { readonly at: 'remote'; readonly name: string };

export const START: Screen = { at: 'home' };

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

/**
 * The view model for the list of remotes, as a plain module.
 *
 * **No React, no JSX, no DOM, and no import of a component.** That is the rule the architecture is
 * built on and this file is where it is first demonstrated: everything below can be constructed with
 * a fake API and driven to any state by the test runner, with no browser and no rendering library.
 * `useRemotes.ts` next door is the seven lines that connect it to React.
 *
 * What it holds is what a screen needs and what the data model does not have: whether a request is
 * in flight, what went wrong last, and which entry is being edited. Those are properties of looking
 * at remotes, not properties of remotes, which is why they are here and not in `RemoteDocument`.
 */
import type { RemotesApi } from '../../../shared/api.ts';
import type { RemoteDocument } from '../../../shared/remote.ts';

export interface RemotesState {
  /** `loading` only before the first answer. A later reload keeps the list and sets `busy`. */
  readonly status: 'loading' | 'ready' | 'failed';
  readonly remotes: readonly RemoteDocument[];
  /** Something is in flight. Separate from `status` so a reload does not blank the screen. */
  readonly busy: boolean;
  /** What went wrong, kept until the next successful operation rather than flashed and lost. */
  readonly error?: string;
}

export const EMPTY: RemotesState = { status: 'loading', remotes: [], busy: false };

export class RemotesModel {
  #state: RemotesState = EMPTY;
  readonly #api: RemotesApi;
  readonly #changed: (state: RemotesState) => void;

  constructor(api: RemotesApi, changed: (state: RemotesState) => void) {
    this.#api = api;
    this.#changed = changed;
  }

  get state(): RemotesState {
    return this.#state;
  }

  load(): Promise<void> {
    return this.#run(async () => ({ remotes: await this.#api.list() }));
  }

  create(name: string): Promise<void> {
    return this.#run(async () => {
      await this.#api.create(name);
      return { remotes: await this.#api.list() };
    });
  }

  rename(id: string, name: string): Promise<void> {
    return this.#run(async () => {
      await this.#api.rename(id, name);
      return { remotes: await this.#api.list() };
    });
  }

  duplicate(id: string): Promise<void> {
    return this.#run(async () => {
      await this.#api.duplicate(id);
      return { remotes: await this.#api.list() };
    });
  }

  remove(id: string): Promise<void> {
    return this.#run(async () => {
      await this.#api.remove(id);
      return { remotes: await this.#api.list() };
    });
  }

  /**
   * Every operation has the same shape: mark it busy, do it, take the fresh list, or record why not.
   *
   * The list always comes back from the main process rather than being patched here. That is the
   * decision the architecture rests on, made concrete in six lines: the truth is on the other side,
   * so a change is a request and the answer is what is displayed. Patching the array locally would
   * work until the day two things change at once and the window and the disk disagree.
   */
  async #run(operation: () => Promise<{ remotes: readonly RemoteDocument[] }>): Promise<void> {
    this.#emit({ ...this.#state, busy: true });
    try {
      const { remotes } = await operation();
      this.#emit({ status: 'ready', remotes, busy: false });
    } catch (error) {
      this.#emit({
        ...this.#state,
        status: this.#state.status === 'loading' ? 'failed' : this.#state.status,
        busy: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  #emit(state: RemotesState): void {
    this.#state = state;
    this.#changed(state);
  }
}

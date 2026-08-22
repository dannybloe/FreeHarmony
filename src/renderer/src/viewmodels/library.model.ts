/**
 * The appliances this machine has descriptions of, as a screen's state.
 *
 * **The first thing in the window that reads the library at all.** It has had storage, an API and tests
 * since 21 August 2026 and no screen, which is a shape worth noticing: a collection nobody can see is a
 * collection nobody can tell is wrong.
 *
 * It is a list and a lookup, because both are wanted and only the list is a request. A device page names
 * the appliance a position points at, so it asks by identifier against what it already has rather than
 * going back over the bridge per tile.
 */
import type { LibraryApi } from '../../../shared/api.ts';
import type { DeviceDefinition, DeviceUsage } from '../../../shared/library.ts';

export type LibraryState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  /** Empty is `ready` with nothing in it, which is a real and ordinary answer on a fresh machine. */
  | {
      readonly status: 'ready';
      readonly definitions: readonly DeviceDefinition[];
      /**
       * Which remotes use which of them, and what each calls it.
       *
       * Loaded with the list rather than separately, because a screen showing appliances with no names on
       * them is a screen showing four rows that read "81 commands" and cannot be told apart. So the two
       * arrive together or the list is not ready.
       */
      readonly usage: readonly DeviceUsage[];
    }
  | { readonly status: 'failed'; readonly error: string };

export const NOTHING_LOADED: LibraryState = { status: 'idle' };

export class LibraryModel {
  #state: LibraryState = NOTHING_LOADED;
  readonly #api: LibraryApi;
  readonly #changed: (state: LibraryState) => void;

  constructor(api: LibraryApi, changed: (state: LibraryState) => void) {
    this.#api = api;
    this.#changed = changed;
  }

  get state(): LibraryState {
    return this.#state;
  }

  /** Cheap and repeatable: it reads files this application wrote, so a page may ask whenever it likes. */
  async load(): Promise<void> {
    this.#emit({ status: 'loading' });
    try {
      // Both at once, so a page never draws a nameless list while the names are still on their way.
      const [definitions, usage] = await Promise.all([this.#api.list(), this.#api.usage()]);
      this.#emit({ status: 'ready', definitions, usage });
    } catch (error) {
      this.#emit({ status: 'failed', error: error instanceof Error ? error.message : String(error) });
    }
  }

  #emit(state: LibraryState): void {
    this.#state = state;
    this.#changed(state);
  }
}

/**
 * One appliance out of a loaded list, or `undefined`.
 *
 * `undefined` covers two cases a screen has to tell apart and this function deliberately does not: the
 * list is not loaded yet, and the appliance is genuinely not on this machine. The second is what
 * `DocumentContents.missing` answers, which is why it exists rather than being inferred here.
 */
export function definitionIn(state: LibraryState, id: string | undefined): DeviceDefinition | undefined {
  if (id === undefined || state.status !== 'ready') return undefined;
  return state.definitions.find((one) => one.id === id);
}

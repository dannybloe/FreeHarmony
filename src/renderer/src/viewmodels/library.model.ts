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
import type { DeviceDefinition, DeviceDraft, DeviceUsage } from '../../../shared/library.ts';
import { KIND_NAMES, describeDefinition, namesUsedFor } from '../../../shared/library.ts';

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

  /**
   * Write down an appliance by hand, and hand back what the library made of it.
   *
   * The definition is returned as well as reloaded, because the caller wants to open it: writing one down
   * and then having to find it in a list is the wrong end of the interaction, and the identifier is minted
   * on the other side of the bridge so this is the only place it can come from.
   */
  async create(draft: DeviceDraft): Promise<DeviceDefinition> {
    const made = await this.#api.create(draft);
    await this.load();
    return made;
  }

  /** A second description of the same appliance. Returns it for the same reason `create` does. */
  async clone(id: string, name?: string): Promise<DeviceDefinition> {
    const made = await this.#api.clone(id, name);
    await this.load();
    return made;
  }

  /**
   * Correct one: a name, a manufacturer, a kind. Never an identifier.
   *
   * It takes the whole definition rather than a patch, because the caller has it and a patch would need a
   * merge rule here, in a class that has no business owning one. `put` refuses a changed identifier on the
   * far side, so the identity cannot be edited by this route however it is called.
   */
  async put(definition: DeviceDefinition): Promise<void> {
    await this.#api.put(definition);
    await this.load();
  }

  /**
   * Throw one away.
   *
   * **This can leave a document pointing at nothing**, and it is allowed to, which is a decision rather
   * than an oversight. The alternative is refusing to delete an appliance some remote still names, and
   * that turns a library into something you cannot tidy without editing every document first. The
   * consequence is visible instead of silent: `missingFor` is what a document's page asks, so a position
   * whose description is gone says so on the screen. The library page shows which remotes use one before
   * you delete it.
   */
  async remove(id: string): Promise<void> {
    await this.#api.remove(id);
    await this.load();
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

/** Which remotes use one appliance, by document name, in the order the library reported them. */
export function usedBy(state: LibraryState, id: string): readonly string[] {
  if (state.status !== 'ready') return [];
  return state.usage.filter((one) => one.definition === id).map((one) => one.remote);
}

/**
 * What to call an appliance on a tile, best answer first.
 *
 * Here rather than in the view because it is a rule with four arms and no React in it, and because the
 * fourth arm is the one worth checking: **an imported appliance genuinely has no name**. A configuration
 * states codes and positions and no words at all, so most of a fresh library is nameless, and this is the
 * order of how much anybody actually knows about one.
 *
 * The last arm says what it can do instead of what it is. Writing "Unknown" there would be a label that
 * looks like a name and tells nobody anything, where "81 commands" is true and is the only true thing
 * left to say.
 */
export function nameFor(definition: DeviceDefinition, state: LibraryState): string {
  const described = describeDefinition(definition);
  if (described !== undefined) return described;
  // The documents' own words, because their owner typed those. Several remotes may disagree about what to
  // call one appliance, and all of them are right, so they are all shown.
  const used = state.status === 'ready' ? namesUsedFor(state.usage, definition.id) : [];
  if (used.length > 0) return used.join(', ');
  const codes = definition.commands.length;
  if (codes === 0) return 'Nothing known yet';
  return codes === 1 ? '1 command' : `${codes} commands`;
}

/**
 * The kind, and how many remotes use it, which is the fact that decides whether deleting it is safe.
 *
 * Counted over **distinct** documents rather than over uses: one remote can hold the same appliance in two
 * positions, which is a real arrangement and not a mistake, and saying "on 2 remotes" for it would be
 * false in the one sentence somebody reads before pressing delete.
 */
export function captionFor(definition: DeviceDefinition, state: LibraryState): string {
  const kind = KIND_NAMES[definition.kind];
  const on = new Set(usedBy(state, definition.id)).size;
  if (on === 0) return `${kind}, on no remote`;
  return `${kind}, on ${on === 1 ? '1 remote' : `${on} remotes`}`;
}

/**
 * The appliances in the order a person should see them: by the name they are shown under.
 *
 * **Not the order the library hands them over**, which is by identifier, and that is a defect this found
 * by being looked at rather than by failing: an identifier is a digest of what an appliance sends, or a
 * random string for one written down by hand, so sorting by it puts a list in an order with no meaning at
 * all. The store is right to sort by identifier, since a store has nothing else to sort by; the screen
 * knows what each one is called.
 *
 * Sorted by what is **displayed**, so the order matches what somebody reads. Sorting by the stored name
 * would leave everything without one in identifier order at one end, which is most of a fresh library.
 */
export function listed(state: LibraryState): readonly DeviceDefinition[] {
  if (state.status !== 'ready') return [];
  return [...state.definitions]
    .sort((a, b) => nameFor(a, state).localeCompare(nameFor(b, state)));
}

/**
 * What a document holds, as a screen's state: looking, ready, empty, or a failure with a reason.
 *
 * No React and no DOM, which is the reason it is a class in this directory rather than logic inside a
 * component: every path below can be walked by the test runner, including the one that is awkward to
 * reach by clicking, asking for the contents of a document somebody deleted from Finder while the page
 * was open.
 *
 * **It does not read remotes.** It did, and reading moved to `import.model.ts` on 22 August 2026 when
 * reading became an import with a decision in the middle of it. What is left here is one question about
 * one file, which is why it needs no guard against being called twice.
 *
 * **`empty` is a state and not a variant of `ready`.** A document made by picking a model from a list
 * genuinely holds nothing, and a screen has something different to say about that than about a document
 * whose four appliances it can name. Collapsing the two is how an interface ends up drawing a remote
 * with no devices, which is a statement about somebody's equipment rather than about this application.
 */
import type { RemotesApi } from '../../../shared/api.ts';
import type { DocumentContents } from '../../../shared/content.ts';

export type ContentsState =
  /** Nothing asked for yet, which is where every page starts. */
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  /** There is a configuration and this is what it says. */
  | { readonly status: 'ready'; readonly contents: DocumentContents }
  /** There is no configuration behind this document, so there is nothing to show. */
  | { readonly status: 'empty' }
  | { readonly status: 'failed'; readonly error: string };

export const NOTHING_ASKED: ContentsState = { status: 'idle' };

export class ContentsModel {
  #contents: ContentsState = NOTHING_ASKED;
  readonly #api: RemotesApi;
  readonly #changed: (contents: ContentsState) => void;

  constructor(api: RemotesApi, changed: (contents: ContentsState) => void) {
    this.#api = api;
    this.#changed = changed;
  }

  get contents(): ContentsState {
    return this.#contents;
  }

  /**
   * Ask what a document holds.
   *
   * Cheap and repeatable: it opens a file this application wrote, not a device. So there is no guard
   * against being called twice, unlike `ImportModel.inspect`, and a page may call it whenever the
   * document it is showing changes, and again after an import has landed.
   */
  async load(name: string): Promise<void> {
    this.#emit({ status: 'loading' });
    try {
      const found = await this.#api.contents(name);
      this.#emit(found === undefined ? { status: 'empty' } : { status: 'ready', contents: found });
    } catch (error) {
      this.#emit({ status: 'failed', error: message(error) });
    }
  }

  #emit(contents: ContentsState): void {
    this.#contents = contents;
    this.#changed(contents);
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

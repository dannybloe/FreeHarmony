/**
 * What a document holds, as a screen's state: looking, ready, empty, or a failure with a reason.
 *
 * No React and no DOM, which is the reason it is a class in this directory rather than logic inside a
 * component: every path below can be walked by the test runner, including the two that are awkward to
 * reach by clicking. One is a read of an irreplaceable device failing halfway; the other is asking for
 * the contents of a document somebody deleted from Finder while the page was open.
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

/** Reading a configuration off a remote, which is a different act with a different set of outcomes. */
export type ReadState =
  | { readonly status: 'idle' }
  | { readonly status: 'reading' }
  | { readonly status: 'failed'; readonly error: string };

export const NOTHING_ASKED: ContentsState = { status: 'idle' };
export const NOT_READING: ReadState = { status: 'idle' };

export class ContentsModel {
  #contents: ContentsState = NOTHING_ASKED;
  #read: ReadState = NOT_READING;
  readonly #api: RemotesApi;
  readonly #changed: (contents: ContentsState, read: ReadState) => void;

  constructor(api: RemotesApi, changed: (contents: ContentsState, read: ReadState) => void) {
    this.#api = api;
    this.#changed = changed;
  }

  get contents(): ContentsState {
    return this.#contents;
  }

  get read(): ReadState {
    return this.#read;
  }

  /**
   * Ask what a document holds.
   *
   * Cheap and repeatable: it opens a file this application wrote, not a device. So there is no guard
   * against being called twice, unlike `readFrom` below, and a page may call it whenever the document
   * it is showing changes.
   */
  async load(name: string): Promise<void> {
    this.#emit({ status: 'loading' }, this.#read);
    try {
      const found = await this.#api.contents(name);
      this.#emit(found === undefined ? { status: 'empty' } : { status: 'ready', contents: found },
                 this.#read);
    } catch (error) {
      this.#emit({ status: 'failed', error: message(error) }, this.#read);
    }
  }

  /**
   * Read the whole configuration off an attached remote and then show it.
   *
   * **It refuses to run while it is already running**, and that is not tidiness: two of these at once
   * are two attempts to claim one irreplaceable device, and a button that can be pressed twice is the
   * ordinary way that happens. The same guard, for the same reason, as `HardwareModel.read`.
   *
   * A failure leaves the contents alone rather than clearing them. Nothing was attached, so whatever
   * the document held before is still what it holds, and a page that blanked itself would be saying
   * otherwise.
   */
  async readFrom(name: string, productId: number): Promise<void> {
    if (this.#read.status === 'reading') return;
    this.#emit(this.#contents, { status: 'reading' });
    try {
      await this.#api.readConfiguration(name, productId);
      this.#emit(this.#contents, NOT_READING);
      await this.load(name);
    } catch (error) {
      this.#emit(this.#contents, { status: 'failed', error: message(error) });
    }
  }

  #emit(contents: ContentsState, read: ReadState): void {
    this.#contents = contents;
    this.#read = read;
    this.#changed(contents, read);
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

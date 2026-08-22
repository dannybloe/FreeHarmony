/**
 * Importing, as view state: looking at what is on a remote, then deciding.
 *
 * Its own model rather than a third state on `ContentsModel`, because it is reached from two places and
 * only one of them has a document. From a remote's own page it imports into that document; straight after
 * a remote has been recognised on the chooser it is offered as a question, and the document was created a
 * moment ago. One model, two callers, one flow underneath.
 *
 * **The two halves are two states on purpose.** `inspect` opens somebody's remote and reads it and writes
 * nothing; `commit` writes. Between them sits a person looking at a summary. Collapsing that into one call
 * would put the decision after the act, and the decision is the point.
 *
 * No React and no DOM, like every model here, so the whole flow can be walked by the test runner.
 */
import type { RemotesApi } from '../../../shared/api.ts';
import type { AttachedSummary, ImportOutcome } from '../../../shared/import.ts';

export type InspectionState =
  | { readonly status: 'idle' }
  /** A remote is being read. Up to 1.6 MB over USB, so this is seconds and not milliseconds. */
  | { readonly status: 'inspecting' }
  | { readonly status: 'ready'; readonly summary: AttachedSummary }
  | { readonly status: 'failed'; readonly error: string };

export type CommitState =
  | { readonly status: 'idle' }
  | { readonly status: 'importing' }
  | { readonly status: 'done'; readonly outcome: ImportOutcome }
  | { readonly status: 'failed'; readonly error: string };

export const NOT_INSPECTING: InspectionState = { status: 'idle' };
export const NOT_IMPORTING: CommitState = { status: 'idle' };

export class ImportModel {
  readonly #api: RemotesApi;
  readonly #changed: (inspection: InspectionState, commit: CommitState) => void;
  #inspection: InspectionState = NOT_INSPECTING;
  #commit: CommitState = NOT_IMPORTING;

  constructor(api: RemotesApi, changed: (inspection: InspectionState, commit: CommitState) => void) {
    this.#api = api;
    this.#changed = changed;
  }

  get inspection(): InspectionState {
    return this.#inspection;
  }

  get commit(): CommitState {
    return this.#commit;
  }

  /**
   * Read the attached remote and hold the answer.
   *
   * Guarded against a second call while one is running, which is not paranoia about double clicks: the
   * second would claim a device the first is holding, and `openHarmony` refuses that. So the guard is what
   * turns a stray press into nothing instead of into an error message about hardware.
   */
  async inspect(productId: number, into?: string): Promise<void> {
    if (this.#inspection.status === 'inspecting') return;
    this.#emit({ status: 'inspecting' }, NOT_IMPORTING);
    try {
      const summary = await this.#api.inspectAttached(productId, into);
      this.#emit({ status: 'ready', summary }, NOT_IMPORTING);
    } catch (error) {
      this.#emit({ status: 'failed', error: message(error) }, NOT_IMPORTING);
    }
  }

  /**
   * Commit what is held into a document, which replaces everything in it.
   *
   * It refuses without a held reading rather than reading one itself. An import that could start without
   * a summary having been shown is an import with no confirmation in front of it, and the confirmation is
   * the whole reason there are two halves.
   */
  async confirm(name: string): Promise<void> {
    const held = this.#inspection;
    if (held.status !== 'ready' || this.#commit.status === 'importing') return;
    this.#emit(held, { status: 'importing' });
    try {
      const outcome = await this.#api.importFrom(name, held.summary.token);
      this.#emit(held, { status: 'done', outcome });
    } catch (error) {
      this.#emit(held, { status: 'failed', error: message(error) });
    }
  }

  /**
   * Put the whole thing away, whether it was declined, finished or failed.
   *
   * This is what walking away means, and on the main process side it is what lets the bytes go. Nothing
   * is lost by it: the remote can be read again for the price of a minute.
   */
  dismiss(): void {
    this.#emit(NOT_INSPECTING, NOT_IMPORTING);
  }

  #emit(inspection: InspectionState, commit: CommitState): void {
    this.#inspection = inspection;
    this.#commit = commit;
    this.#changed(inspection, commit);
  }
}

/** What went wrong, in the words the main process used, because they are the ones with the reason in. */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * `ImportModel` with a React face.
 *
 * **Not keyed on anything, and no effect at all**, which is the difference between this and
 * `useContents`. Asking a file what it says can happen because a page rendered; opening somebody's remote
 * cannot. So there is nothing here that runs on its own: both halves run because a person pressed
 * something.
 */
import { useState } from 'react';

import { api } from '../api.ts';
import {
  ImportModel, NOT_IMPORTING, NOT_INSPECTING,
  type CommitState, type InspectionState,
} from './import.model.ts';

export interface Importing {
  readonly inspection: InspectionState;
  readonly commit: CommitState;
  /** Read the attached remote. Writes nothing, whatever happens next. */
  readonly inspect: (productId: number, into?: string) => Promise<void>;
  /** Commit what was read into a document, replacing everything in it. */
  readonly confirm: (name: string) => Promise<void>;
  readonly dismiss: () => void;
}

export function useImport(): Importing {
  const [state, setState] = useState<{ inspection: InspectionState; commit: CommitState }>(
    { inspection: NOT_INSPECTING, commit: NOT_IMPORTING });
  const [model] = useState(() =>
    new ImportModel(api().remotes, (inspection, commit) => setState({ inspection, commit })));

  return {
    inspection: state.inspection,
    commit: state.commit,
    inspect: (productId, into) => model.inspect(productId, into),
    confirm: (name) => model.confirm(name),
    dismiss: () => model.dismiss(),
  };
}

/**
 * The seven lines that connect the view model to React, and deliberately nothing more.
 *
 * A hook is allowed to be a view model's face here, on one condition: the logic it exposes has to be
 * a plain module that could be called without React at all. `RemotesModel` is that module and this
 * file adds no behaviour to it, which is what keeps the condition checkable rather than aspirational.
 */
import { useEffect, useState } from 'react';

import { api } from '../api.ts';
import { EMPTY, RemotesModel, type RemotesState } from './remotes.model.ts';

export interface Remotes extends RemotesState {
  readonly create: (name: string) => Promise<void>;
  readonly rename: (id: string, name: string) => Promise<void>;
  readonly duplicate: (id: string) => Promise<void>;
  readonly remove: (id: string) => Promise<void>;
}

export function useRemotes(): Remotes {
  const [state, setState] = useState<RemotesState>(EMPTY);
  const [model] = useState(() => new RemotesModel(api().remotes, setState));

  useEffect(() => {
    void model.load();
  }, [model]);

  return {
    ...state,
    create: (name) => model.create(name),
    rename: (id, name) => model.rename(id, name),
    duplicate: (id) => model.duplicate(id),
    remove: (id) => model.remove(id),
  };
}

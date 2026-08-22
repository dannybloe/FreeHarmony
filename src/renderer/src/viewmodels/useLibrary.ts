/**
 * `LibraryModel` with a React face.
 *
 * Loaded when a page asks for it and reloaded when `enabled` turns on, so opening the devices page shows
 * an appliance that an import put there a moment ago. Nothing here touches hardware, so unlike
 * `useImport` an effect is exactly the right place for it.
 */
import { useEffect, useState } from 'react';

import { api } from '../api.ts';
import { LibraryModel, NOTHING_LOADED, type LibraryState } from './library.model.ts';

export interface Library {
  readonly state: LibraryState;
  readonly reload: () => Promise<void>;
  /**
   * The four ways the library changes, passed straight through to the model.
   *
   * Passed through rather than reimplemented, and the model reloads after each of them, so a screen never
   * has to remember to. That is the shape the remotes side already has and the reason is the same: the
   * files are the truth, and a screen holding its own copy of a list it just changed is a screen that can
   * disagree with the disk.
   */
  readonly create: LibraryModel['create'];
  readonly clone: LibraryModel['clone'];
  readonly put: LibraryModel['put'];
  readonly remove: LibraryModel['remove'];
}

export function useLibrary(enabled: boolean): Library {
  const [state, setState] = useState<LibraryState>(NOTHING_LOADED);
  const [model] = useState(() => new LibraryModel(api().library, setState));

  useEffect(() => {
    if (enabled) void model.load();
  }, [model, enabled]);

  return {
    state,
    reload: () => model.load(),
    create: (draft) => model.create(draft),
    clone: (id, name) => model.clone(id, name),
    put: (definition) => model.put(definition),
    remove: (id) => model.remove(id),
  };
}

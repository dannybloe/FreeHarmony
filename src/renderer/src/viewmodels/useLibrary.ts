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
}

export function useLibrary(enabled: boolean): Library {
  const [state, setState] = useState<LibraryState>(NOTHING_LOADED);
  const [model] = useState(() => new LibraryModel(api().library, setState));

  useEffect(() => {
    if (enabled) void model.load();
  }, [model, enabled]);

  return { state, reload: () => model.load() };
}

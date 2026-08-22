/**
 * `LibraryModel` with a React face.
 *
 * Loaded when a page asks for it and reloaded when `enabled` turns on, so opening the devices page shows
 * an appliance that an import put there a moment ago. Nothing here touches hardware, so unlike
 * `useImport` an effect is exactly the right place for it.
 */
import { useEffect, useState } from 'react';

import { api } from '../api.ts';
import type { CommandInUse } from '../../../shared/api.ts';
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
  readonly nameCommands: LibraryModel['nameCommands'];
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
    nameCommands: (id, names) => model.nameCommands(id, names),
  };
}

/**
 * Where one appliance's commands are already used on somebody's remote, loaded when the page needs it.
 *
 * **A hook of its own and not part of `LibraryState`**, which is the decision worth stating: it walks every
 * document on the machine, and exactly one page in the application wants it. Putting it in the state
 * everybody loads would read every remote's contents to draw a grid of tiles.
 *
 * `undefined` while it is on its way, which the page draws as rows with fields and no suggestions rather
 * than as nothing at all: the fields are what somebody came for and they are already here.
 *
 * A failure is an empty answer and not a broken page. There is nothing to retry and nothing a person could
 * do about it: the names simply have to be typed.
 */
export function useCommandUses(id: string | undefined): readonly CommandInUse[] | undefined {
  const [uses, setUses] = useState<readonly CommandInUse[] | undefined>(undefined);

  useEffect(() => {
    if (id === undefined) {
      setUses(undefined);
      return;
    }
    // Cleared first, so moving from one appliance to another never shows the previous one's words beside
    // this one's commands. That would be wrong rather than merely stale: the positions line up.
    setUses(undefined);
    let live = true;
    void api().library.inUseOn(id)
      .then((found) => { if (live) setUses(found); })
      .catch(() => { if (live) setUses([]); });
    return () => { live = false; };
  }, [id]);

  return uses;
}

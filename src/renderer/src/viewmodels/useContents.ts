/**
 * `ContentsModel` with a React face, following the document the page is showing.
 *
 * The effect is keyed on the name, so opening a different remote asks about that one and nothing has to
 * remember to. **Nothing here touches a device.** Importing is `useImport`, it runs when somebody presses
 * a button, and an effect that opened a remote because a page rendered would be exactly the thing this
 * application does not do.
 */
import { useEffect, useState } from 'react';

import { api } from '../api.ts';
import { ContentsModel, NOTHING_ASKED, type ContentsState } from './contents.model.ts';

export interface Contents {
  readonly contents: ContentsState;
  readonly reload: () => Promise<void>;
}

export function useContents(name: string | undefined): Contents {
  const [contents, setContents] = useState<ContentsState>(NOTHING_ASKED);
  const [model] = useState(() => new ContentsModel(api().remotes, setContents));

  useEffect(() => {
    if (name !== undefined) void model.load(name);
  }, [model, name]);

  return {
    contents,
    reload: () => (name === undefined ? Promise.resolve() : model.load(name)),
  };
}

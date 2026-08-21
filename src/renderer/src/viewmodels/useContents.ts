/**
 * `ContentsModel` with a React face, following the document the page is showing.
 *
 * The effect is keyed on the name, so opening a different remote asks about that one and nothing has to
 * remember to. **Reading a device is not in the effect and must never be**: that runs when somebody
 * presses a button, once, and an effect that opened a remote because a page rendered would be exactly
 * the thing this application does not do.
 */
import { useEffect, useState } from 'react';

import { api } from '../api.ts';
import {
  ContentsModel, NOTHING_ASKED, NOT_READING, type ContentsState, type ReadState,
} from './contents.model.ts';

export interface Contents {
  readonly contents: ContentsState;
  readonly read: ReadState;
  readonly readFrom: (productId: number) => Promise<void>;
  readonly reload: () => Promise<void>;
}

export function useContents(name: string | undefined): Contents {
  const [state, setState] = useState<{ contents: ContentsState; read: ReadState }>(
    { contents: NOTHING_ASKED, read: NOT_READING });
  const [model] = useState(() =>
    new ContentsModel(api().remotes, (contents, read) => setState({ contents, read })));

  useEffect(() => {
    if (name !== undefined) void model.load(name);
  }, [model, name]);

  return {
    contents: state.contents,
    read: state.read,
    readFrom: (productId) => (name === undefined ? Promise.resolve() : model.readFrom(name, productId)),
    reload: () => (name === undefined ? Promise.resolve() : model.load(name)),
  };
}

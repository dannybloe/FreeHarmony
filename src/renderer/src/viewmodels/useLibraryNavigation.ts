/**
 * `LibraryNavigationModel` with a React face.
 *
 * The same shape as `useNavigation.ts`: the model is the truth and this is the subscription. It keeps a
 * counter rather than a copy of the state, because the model holds four things a screen reads and mirroring
 * all four here would be four chances for the copy to disagree with the original.
 */
import { useState } from 'react';

import { LibraryNavigationModel } from './library-navigation.model.ts';

export function useLibraryNavigation(): LibraryNavigationModel {
  const [, redraw] = useState(0);
  const [model] = useState(() => new LibraryNavigationModel(() => redraw((n) => n + 1)));
  return model;
}

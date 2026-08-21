/**
 * The lines that connect `NavigationModel` to React, and deliberately nothing more.
 *
 * Same arrangement as `useRemotes`: the logic is a plain module that could be driven without React at
 * all, and this file adds no behaviour to it.
 */
import { useState } from 'react';

import { NavigationModel, START, type Screen } from './navigation.model.ts';

export interface Navigation {
  readonly screen: Screen;
  readonly model: NavigationModel;
}

export function useNavigation(): Navigation {
  const [screen, setScreen] = useState<Screen>(START);
  const [model] = useState(() => new NavigationModel(setScreen));
  return { screen, model };
}

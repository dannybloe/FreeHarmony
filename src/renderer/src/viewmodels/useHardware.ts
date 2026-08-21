/**
 * `HardwareModel` with a React face, and deliberately without a clock.
 *
 * `useDevices` next door owns an interval, because enumeration is polled. This one owns nothing of the
 * sort and must not grow one: it opens a remote, so it runs when somebody asks and never on a timer.
 */
import { useState } from 'react';

import { api } from '../api.ts';
import { HardwareModel, UNREAD, type HardwareState } from './devices.model.ts';

export interface Hardware extends HardwareState {
  readonly read: (productId: number) => Promise<void>;
}

export function useHardware(): Hardware {
  const [state, setState] = useState<HardwareState>(UNREAD);
  const [model] = useState(() => new HardwareModel(api().devices, setState));
  return { ...state, read: (productId) => model.read(productId) };
}

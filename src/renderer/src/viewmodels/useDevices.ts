/**
 * The lines that connect `DevicesModel` to React, plus the clock the model deliberately does not own.
 *
 * The interval lives here because it is the one thing that cannot be tested without waiting, so the
 * rule is that it is all that lives here: no decision about what an answer means, no filtering, no
 * navigation. `poll()` is called on a timer and everything else is the model's.
 *
 * Polling rather than an event, and that is a choice worth recording. `node-hid` can report devices
 * arriving, but the notification comes from a native binding in the main process and would have to be
 * pushed over the bridge as a second kind of traffic, where enumeration is cheap and this screen is
 * the only place in the application that asks. A second of latency on a page that says "waiting" costs
 * nothing.
 */
import { useEffect, useState } from 'react';

import { api } from '../api.ts';
import { DevicesModel, NOTHING_YET, type DevicesState } from './devices.model.ts';

/** How often to ask while the Connect screen is open. */
const EVERY = 1000;

export function useDevices(active: boolean): DevicesState {
  const [state, setState] = useState<DevicesState>(NOTHING_YET);
  const [model] = useState(() => new DevicesModel(api().devices, setState));

  useEffect(() => {
    if (!active) return;
    void model.poll();
    const timer = setInterval(() => void model.poll(), EVERY);
    return () => clearInterval(timer);
  }, [active, model]);

  return state;
}

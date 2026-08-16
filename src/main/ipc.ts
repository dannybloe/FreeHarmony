/**
 * The main process half of the bridge: one handler per method of `RemotesApi`.
 *
 * The registration walks `REMOTE_METHODS` rather than listing channels by hand, so a method added
 * to the interface and forgotten here is a typecheck failure rather than a channel that answers
 * nothing. The type level check in `shared/api.ts` is what keeps that list honest in both
 * directions.
 *
 * Errors are turned into a plain message on purpose. An `Error` does not survive the channel's
 * structured clone with anything useful attached, and a stack trace from the main process is not
 * something a window should be showing anybody.
 */
import { ipcMain } from 'electron';

import { channelFor, REMOTE_METHODS, type RemotesApi } from '../shared/api.ts';
import { RemoteStore } from './store/remotes.ts';

export function registerRemoteHandlers(store: RemoteStore): void {
  const api: RemotesApi = {
    list: () => store.list(),
    create: (name) => store.create(name),
    rename: (name, to) => store.rename(name, to),
    duplicate: (name) => store.duplicate(name),
    remove: (name) => store.remove(name),
  };

  for (const method of REMOTE_METHODS) {
    ipcMain.handle(channelFor(method), async (_event, ...args: unknown[]) => {
      try {
        // The cast is the one place types are asserted rather than checked, because an IPC argument
        // arrives as `unknown` however carefully the caller was typed. It is contained to this line
        // on purpose: everything either side of the bridge is checked against the shared interface.
        const call = api[method] as (...rest: unknown[]) => Promise<unknown>;
        return { ok: true, value: await call(...args) };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    });
  }
}

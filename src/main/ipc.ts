/**
 * The main process half of the bridge: one handler per method of the shared API.
 *
 * The registration walks the method lists rather than listing channels by hand, so a method added to
 * an interface and forgotten here is a typecheck failure rather than a channel that answers nothing.
 * The type level checks in `shared/api.ts` are what keep those lists honest in both directions.
 *
 * Errors are turned into a plain message on purpose. An `Error` does not survive the channel's
 * structured clone with anything useful attached, and a stack trace from the main process is not
 * something a window should be showing anybody.
 */
import { ipcMain } from 'electron';

import { channelFor, METHODS, type FreeHarmonyApi, type Namespace } from '../shared/api.ts';
import { contentsOf, fileDefinitionsOf, readConfigurationFrom } from './configuration.ts';
import { attachedRemotes, readHardware } from './devices.ts';
import { DeviceLibrary } from './store/library.ts';
import { RemoteStore } from './store/remotes.ts';

export function registerHandlers(store: RemoteStore, library: DeviceLibrary): void {
  // One clock, the main process's. A timestamp on somebody's document should be the machine's own and
  // never something a page could be wrong about.
  const now = () => new Date().toISOString();

  register('remotes', {
    list: () => store.list(),
    create: (name, model, hardware) => store.create(name, model, hardware),
    rename: (name, to) => store.rename(name, to),
    duplicate: (name) => store.duplicate(name),
    remove: (name) => store.remove(name),
    readConfiguration: (name, productId) =>
      readConfigurationFrom(store, library, name, productId, now),
    contents: (name) => contentsOf(store, library, name),
    fileDefinitions: (name) => fileDefinitionsOf(store, library, name, now),
  });

  register('devices', {
    attached: () => attachedRemotes(),
    readHardware: (productId) => readHardware(productId, now),
  });

  register('library', {
    list: () => library.list(),
    get: (id) => library.get(id),
    put: (definition) => library.put(definition),
    remove: (id) => library.remove(id),
    missingFor: (content) => library.missingFor(content),
    likelyDuplicates: () => library.likelyDuplicates(),
  });
}

/**
 * One namespace's methods, on the channels `channelFor` names.
 *
 * Written once and called twice rather than a loop per namespace, because the wrapping is the part
 * worth having in one place: every answer is `{ ok, value }` or `{ ok: false, message }`, so the
 * window cannot receive a rejection whose shape it has to guess.
 *
 * The implementation is typed as `FreeHarmonyApi[N]` rather than against a mapping written out here.
 * A second table saying which namespace has which interface would be a second copy of what the shared
 * interface already states, and the two would disagree the first time a namespace was added.
 */
function register<N extends Namespace>(namespace: N, api: FreeHarmonyApi[N]): void {
  for (const method of METHODS[namespace]) {
    ipcMain.handle(channelFor(namespace, method), async (_event, ...args: unknown[]) => {
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

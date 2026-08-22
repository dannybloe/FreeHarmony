/**
 * The window's half of the bridge, and the only code that runs in both worlds.
 *
 * It publishes exactly the methods the shared API declares and nothing else. In particular it does not
 * expose `ipcRenderer`, which would hand the page every channel in the application including any
 * added later: the point of a bridge is that it is narrower than the thing it bridges.
 *
 * Built as CommonJS rather than as a module, which is not a preference. A sandboxed preload script
 * cannot be an ES module, and the sandbox is on because the renderer must never be able to reach a
 * file or a device except through what is published here.
 */
import { contextBridge, ipcRenderer } from 'electron';

import {
  API_NAMESPACE,
  channelFor,
  type FreeHarmonyApi,
  type Namespace,
} from '../shared/api.ts';

/** Unwraps the main process's answer, so that a refusal on that side becomes a thrown error here. */
async function call<N extends Namespace>(
  namespace: N,
  method: keyof FreeHarmonyApi[N] & string,
  ...args: unknown[]
): Promise<unknown> {
  const answer = (await ipcRenderer.invoke(channelFor(namespace, method), ...args)) as
    | { ok: true; value: unknown }
    | { ok: false; message: string };
  if (!answer.ok) throw new Error(answer.message);
  return answer.value;
}

const api: FreeHarmonyApi = {
  remotes: {
    list: () => call('remotes', 'list') as ReturnType<FreeHarmonyApi['remotes']['list']>,
    create: (name, model, hardware) =>
      call('remotes', 'create', name, model, hardware) as ReturnType<FreeHarmonyApi['remotes']['create']>,
    rename: (name, to) =>
      call('remotes', 'rename', name, to) as ReturnType<FreeHarmonyApi['remotes']['rename']>,
    duplicate: (name) =>
      call('remotes', 'duplicate', name) as ReturnType<FreeHarmonyApi['remotes']['duplicate']>,
    remove: (name) => call('remotes', 'remove', name) as ReturnType<FreeHarmonyApi['remotes']['remove']>,
    inspectAttached: (productId, into) =>
      call('remotes', 'inspectAttached', productId, into) as
        ReturnType<FreeHarmonyApi['remotes']['inspectAttached']>,
    importFrom: (name, token) =>
      call('remotes', 'importFrom', name, token) as
        ReturnType<FreeHarmonyApi['remotes']['importFrom']>,
    contents: (name) =>
      call('remotes', 'contents', name) as ReturnType<FreeHarmonyApi['remotes']['contents']>,
    fileDefinitions: (name) =>
      call('remotes', 'fileDefinitions', name) as
        ReturnType<FreeHarmonyApi['remotes']['fileDefinitions']>,
    addDevice: (name, definition, label) =>
      call('remotes', 'addDevice', name, definition, label) as
        ReturnType<FreeHarmonyApi['remotes']['addDevice']>,
  },
  devices: {
    attached: () => call('devices', 'attached') as ReturnType<FreeHarmonyApi['devices']['attached']>,
    readHardware: (productId) =>
      call('devices', 'readHardware', productId) as
        ReturnType<FreeHarmonyApi['devices']['readHardware']>,
  },
  library: {
    list: () => call('library', 'list') as ReturnType<FreeHarmonyApi['library']['list']>,
    get: (id) => call('library', 'get', id) as ReturnType<FreeHarmonyApi['library']['get']>,
    put: (definition) =>
      call('library', 'put', definition) as ReturnType<FreeHarmonyApi['library']['put']>,
    remove: (id) => call('library', 'remove', id) as ReturnType<FreeHarmonyApi['library']['remove']>,
    missingFor: (content) =>
      call('library', 'missingFor', content) as ReturnType<FreeHarmonyApi['library']['missingFor']>,
    likelyDuplicates: () =>
      call('library', 'likelyDuplicates') as ReturnType<FreeHarmonyApi['library']['likelyDuplicates']>,
    usage: () => call('library', 'usage') as ReturnType<FreeHarmonyApi['library']['usage']>,
  },
};

contextBridge.exposeInMainWorld(API_NAMESPACE, api);

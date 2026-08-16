/**
 * The window's half of the bridge, and the only code that runs in both worlds.
 *
 * It publishes exactly the methods `RemotesApi` declares and nothing else. In particular it does not
 * expose `ipcRenderer`, which would hand the page every channel in the application including any
 * added later: the point of a bridge is that it is narrower than the thing it bridges.
 *
 * Built as CommonJS rather than as a module, which is not a preference. A sandboxed preload script
 * cannot be an ES module, and the sandbox is on because the renderer must never be able to reach a
 * file or a device except through what is published here.
 */
import { contextBridge, ipcRenderer } from 'electron';

import { API_NAMESPACE, channelFor, REMOTE_METHODS, type FreeHarmonyApi } from '../shared/api.ts';

/** Unwraps the main process's answer, so that a refusal on that side becomes a thrown error here. */
async function call(method: (typeof REMOTE_METHODS)[number], ...args: unknown[]): Promise<unknown> {
  const answer = (await ipcRenderer.invoke(channelFor(method), ...args)) as
    | { ok: true; value: unknown }
    | { ok: false; message: string };
  if (!answer.ok) throw new Error(answer.message);
  return answer.value;
}

const api: FreeHarmonyApi = {
  remotes: {
    list: () => call('list') as ReturnType<FreeHarmonyApi['remotes']['list']>,
    create: (name) => call('create', name) as ReturnType<FreeHarmonyApi['remotes']['create']>,
    rename: (id, name) => call('rename', id, name) as ReturnType<FreeHarmonyApi['remotes']['rename']>,
    duplicate: (id) => call('duplicate', id) as ReturnType<FreeHarmonyApi['remotes']['duplicate']>,
    remove: (id) => call('remove', id) as ReturnType<FreeHarmonyApi['remotes']['remove']>,
  },
};

contextBridge.exposeInMainWorld(API_NAMESPACE, api);

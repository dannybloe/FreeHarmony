/**
 * How the window reaches the main process, and the declaration that makes it typed.
 *
 * The preload script publishes the API on `window` under one name. Without the declaration below
 * that would be `any`, which would quietly undo the point of sharing the interface at all, so the
 * global is declared once, here, from the shared type.
 */
import { API_NAMESPACE, type FreeHarmonyApi } from '../../shared/api.ts';

declare global {
  interface Window {
    readonly [API_NAMESPACE]?: FreeHarmonyApi;
  }
}

/**
 * The API, or a failure that says what actually went wrong.
 *
 * It can genuinely be absent: a page opened without the preload script, which is what a test harness
 * or a mistaken window configuration produces. Saying so here beats `undefined is not an object`
 * somewhere deep in a component.
 */
export function api(): FreeHarmonyApi {
  const published = window[API_NAMESPACE];
  if (published === undefined) {
    throw new Error('the bridge to the main process is not published on this page');
  }
  return published;
}

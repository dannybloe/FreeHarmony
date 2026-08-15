/**
 * The build for both halves of an Electron application: the main process, which owns the window and
 * will later own the codec and the remote, and the renderer, which draws.
 *
 * `electron-vite` is one dependency that knows how to build those two against each other, rather
 * than two Vite configurations and a script to start them in the right order. Its development mode
 * serves the renderer over HTTP with reload and hands the main process the address through
 * `ELECTRON_RENDERER_URL`; its build writes both into `out/`, from where the renderer is loaded off
 * disk.
 *
 * The interesting part of this file is the content security policy, which is chosen here rather
 * than written in the page because it has to differ between development and production. The two
 * policies themselves live in `build/csp.ts`, where a test can read them.
 */
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import postcssPresetMantine from 'postcss-preset-mantine';
import type { Plugin } from 'vite';

import { DEVELOPMENT_POLICY, PRODUCTION_POLICY } from './build/csp.ts';

/**
 * Substitutes the policy into the page, picking by whether a development server is doing the
 * serving. `ctx.server` is present only then.
 *
 * The page carries `%CSP%` rather than a real policy so that neither version can be edited by
 * accident: there is one place the strict one is written, and a test can read the built HTML and
 * assert it came out strict.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'freeharmony:content-security-policy',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        return html.replace('%CSP%', context.server === undefined ? PRODUCTION_POLICY : DEVELOPMENT_POLICY);
      },
    },
  };
}

export default defineConfig({
  main: {
    // Node's own modules and anything from `node_modules` stay external rather than being bundled
    // into the main process. That matters more here than in a normal application: `@harmony/usb`
    // will bring a native module, and a native module cannot be bundled.
    //
    // The entry points are `electron-vite`'s own defaults, `src/main/index.ts` and
    // `src/renderer/index.html`, and stating them here again is what broke the first build: an
    // explicit `rollupOptions.input` replaced the defaults wholesale, `electron` itself was bundled
    // into the main process, and the application started and immediately died looking for its own
    // runtime inside `out/`. The convention is load bearing, so it is followed rather than restated.
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), contentSecurityPolicy()],
    css: {
      // Mantine's own PostCSS preset, named here rather than in a `postcss.config.js` beside the
      // page. Vite looks for that file relative to the renderer's root, which `electron-vite` sets
      // for us, so a config file at the repository root would be found by nothing and silently do
      // nothing. Stated here it is typechecked and it is where somebody looking at the build looks.
      //
      // The preset is what makes `light-dark()` work in a stylesheet. Everything Sass could do
      // instead, the mixins and `rem()`, lives in `src/renderer/src/_mantine.scss`, because Sass
      // compiles first and would try to interpret an `@include` meant for PostCSS.
      postcss: { plugins: [postcssPresetMantine()] },
    },
  },
});

/**
 * The main process: it owns the window, and later it will own everything that touches a file or a
 * remote. Nothing in this file reads a config or opens a device yet.
 *
 * Three security settings are the point of this file rather than a detail of it, and they are
 * written out even where they are already the default, because a default that changes silently in
 * an Electron upgrade is not a decision anybody made:
 *
 *   - `contextIsolation` keeps the page's JavaScript and the bridge in separate worlds, so the page
 *     cannot reach into the bridge and rewrite it.
 *   - `nodeIntegration` off means the page has no `require` and no file system, whatever it runs.
 *   - `sandbox` puts the renderer in the operating system's own sandbox as well.
 *
 * The reason these are not negotiable here is the hardware. The rails that stop a write from
 * reaching an irreplaceable remote live in `@harmony/usb`, in the main process, and a rail that the
 * page can reach around is not a rail. So the page gets no route to a device except the one that is
 * deliberately opened for it, which arrives with the typed bridge.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, shell } from 'electron';

import { registerHandlers } from './ipc.ts';
import { storeRoot } from './store/location.ts';
import { RemoteStore } from './store/remotes.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Where the renderer comes from in development. `electron-vite` sets it; in a build it is absent. */
const DEVELOPMENT_RENDERER = process.env['ELECTRON_RENDERER_URL'];

/**
 * Load the page and never put a window on the screen. Set by the end to end test in `test/app`.
 *
 * There is no headless Electron to ask for. A browser can be told to run without a display; Electron
 * cannot, because the window is the application. What it can do is what this does, which is the same
 * thing for a test's purposes: the window is created hidden already, so the only change is not
 * showing it, and on macOS not putting an icon in the dock either.
 *
 * So a test run does not steal focus four times, and the page still loads, still runs its scripts and
 * still answers the developer tools protocol. What it does not do is paint, which is why this is a
 * seam for a bridge test rather than a way to test anything about how the application looks.
 */
const STAY_HIDDEN = process.env['FREEHARMONY_HIDDEN'] === '1';

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    // Created hidden and shown on `ready-to-show`, so the first thing anybody sees is the finished
    // page rather than a white rectangle that then fills in.
    show: false,
    webPreferences: {
      // Built as CommonJS with a `.cjs` extension, which is not a style choice: a sandboxed preload
      // script cannot be an ES module, and the sandbox is what stops the page reaching the file
      // system at all. `electron.vite.config.ts` says the same thing from the build's side.
      preload: join(HERE, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!STAY_HIDDEN) window.once('ready-to-show', () => window.show());

  // F12 opens the developer tools, next to the `Cmd + Option + I` that the standard menu already
  // offers. It is a keystroke rather than a menu entry because the platform's own way of binding a
  // key, on macOS at least, matches menu items by title in an installed application, and this is not
  // one yet.
  //
  // `before-input-event` sees the key before the page does and fires only while this window has
  // focus, which is what separates it from a global shortcut: a global one would steal F12 from
  // every other program on the machine for as long as FreeHarmony is running.
  //
  // Left in for a release rather than limited to development. There is no remote content here, so
  // an open inspector gives away nothing, and somebody reporting a problem with their own remote is
  // far easier to help if they can be asked what the console says.
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      window.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (DEVELOPMENT_RENDERER !== undefined) {
    void window.loadURL(DEVELOPMENT_RENDERER);
  } else {
    void window.loadFile(join(HERE, '../renderer/index.html'));
  }

  return window;
}

/**
 * This application has exactly one place its window may point, and it is its own page. Both handlers
 * below refuse everything else: a link opens in the real browser rather than turning the application
 * window into one, and an attempt to navigate the window away from the page is cancelled.
 *
 * This is belt and braces next to the content security policy, and it is worth having both because
 * they fail differently. The policy governs what the page may load; these govern where the window
 * itself may go, which the policy has nothing to say about.
 */
function refuseNavigationAwayFromTheApplication(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    const isTheDevelopmentServer =
      DEVELOPMENT_RENDERER !== undefined && url.startsWith(DEVELOPMENT_RENDERER);
    if (!isTheDevelopmentServer) event.preventDefault();
  });
}

void app.whenReady().then(() => {
  // The store is constructed once and handed to the handlers, rather than each handler reaching for
  // a location. That is what keeps `store/remotes.ts` free of Electron and therefore testable.
  if (STAY_HIDDEN) app.dock?.hide();
  registerHandlers(new RemoteStore({ root: storeRoot() }));
  refuseNavigationAwayFromTheApplication(createWindow());
});

/**
 * Closing the window closes the application, on every platform including macOS.
 *
 * That is a deliberate departure from the macOS convention, where an application keeps running with
 * no windows and reopens one from the dock. The convention exists for programs that open a document
 * into a window of its own, because there the running application is what you open the next one into.
 * FreeHarmony keeps its remotes on disk and shows them in one window, so there is nothing to come back
 * to, and an entry left in the dock that does nothing is a puzzle rather than a courtesy.
 *
 * Revisit this if the application ever grows a second window worth keeping open on its own, a menu
 * bar item, or work that continues after a window is closed. Reading a remote is the obvious
 * candidate for that last one, and it would be a reason to change this rather than a detail.
 */
app.on('window-all-closed', () => app.quit());

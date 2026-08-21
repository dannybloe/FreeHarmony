/**
 * Draws the application's window to a PNG, so a change to the interface can be looked at.
 *
 * Written on 18 August 2026 while building the welcome page, for a reason worth stating: an interface
 * cannot be reviewed by reading its source, and the other repository learned the same lesson the
 * expensive way when a drawing passed every test it had and was still wrong. So this exists to put a
 * picture in front of somebody, and to let whoever is building the page see what they actually made.
 *
 * It reuses the test driver rather than starting Electron itself, which is why that file's docstring
 * names this one. The window is shown for real, because a window that is never shown is never
 * composited and there would be nothing to photograph.
 *
 * Usage:
 *
 *   pnpm screenshot                                          the empty state, into var/screenshot.png
 *   pnpm screenshot --out var/home.png
 *   pnpm screenshot --remotes "Woonkamer:one,Zolder"         seeded through the application's own API
 *   pnpm screenshot --click "Add..." --click "Harmony 600"    to reach a screen that is not the first
 *   pnpm screenshot --width 1280 --height 900
 *
 * A remote is seeded as `Name` or `Name:model`, where the model is a drawing's id, so a picture can be
 * in the picture. `--click` presses whatever carries that text and may be repeated, which is how a
 * screen three steps in gets photographed without a person driving it.
 *
 * The store is a temporary directory that goes away afterwards, so nothing here touches the remotes
 * anybody actually has.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { asRemoteModel, SUPPORTED } from '../src/renderer/src/catalogue.ts';
import { launch } from '../test/app/electron.ts';

interface Options {
  out: string;
  remotes: { name: string; model: string | undefined }[];
  clicks: string[];
  width: number;
  height: number;
}

function options(argv: string[]): Options {
  const named = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };
  const every = (flag: string): string[] =>
    argv.flatMap((arg, at) => (arg === flag && argv[at + 1] !== undefined ? [argv[at + 1] as string] : []));
  const listed = named('--remotes');
  return {
    out: resolve(named('--out') ?? 'var/screenshot.png'),
    remotes: listed === undefined || listed === ''
      ? []
      : listed.split(',').map((entry) => {
          const [name, model] = entry.split(':');
          return { name: (name ?? '').trim(), model: model?.trim() };
        }),
    clicks: every('--click'),
    width: Number(named('--width') ?? 1100),
    height: Number(named('--height') ?? 760),
  };
}

async function main(): Promise<number> {
  const wanted = options(process.argv.slice(2));
  const app = await launch({ visible: true });
  try {
    // Seeded through the bridge rather than by writing folders, so the picture is of the application
    // reading its own store rather than of a state assembled behind its back.
    for (const { name, model } of wanted.remotes) {
      // The model is resolved **here** rather than inside the page. The catalogue is a plain module, so
      // this process can read it, and asking the page to import a source path would only work while
      // developing: a built bundle has no such file.
      const picked = model === undefined ? undefined : SUPPORTED.find((m) => m.id === model);
      if (model !== undefined && picked === undefined) {
        throw new Error(`no drawing called ${model}; try ${SUPPORTED.map((m) => m.id).join(', ')}`);
      }
      const asModel = picked === undefined ? 'undefined' : JSON.stringify(asRemoteModel(picked));
      await app.evaluate(
        `window.freeharmony.remotes.create(${JSON.stringify(name)}, ${asModel})`);
    }
    if (wanted.remotes.length > 0) await app.reload();

    // Presses whatever carries the given text, so a screen several steps in can be photographed. A
    // pause after each, because a click here is a real click and React redraws on its own schedule.
    for (const text of wanted.clicks) {
      const found = await app.evaluate<boolean>(`(() => {
        const wanted = ${JSON.stringify(text)};
        for (const it of document.querySelectorAll('button')) {
          if ((it.textContent ?? '').trim().includes(wanted) && !it.disabled) { it.click(); return true; }
        }
        return false;
      })()`);
      if (!found) throw new Error(`nothing on the page to press that says ${JSON.stringify(text)}`);
      await new Promise((wake) => setTimeout(wake, 350));
    }

    // The size is stated rather than taken from the window, so two screenshots can be compared. The
    // device scale is 2 because this is a retina machine and half resolution looks like a mistake.
    await app.send('Emulation.setDeviceMetricsOverride',
                   { width: wanted.width, height: wanted.height, deviceScaleFactor: 2, mobile: false });
    const shot = await app.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const data = (shot as { data: string }).data;

    await mkdir(dirname(wanted.out), { recursive: true });
    await writeFile(wanted.out, Buffer.from(data, 'base64'));
    console.log(`${wanted.out} (${wanted.width} by ${wanted.height}, ${wanted.remotes.length} remotes,`
                + ` ${wanted.clicks.length} clicks)`);
    return 0;
  } finally {
    await app.close();
  }
}

process.exitCode = await main();

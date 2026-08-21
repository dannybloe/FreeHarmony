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
 *   pnpm screenshot                                        the empty state, into var/screenshot.png
 *   pnpm screenshot --out /tmp/welcome.png
 *   pnpm screenshot --remotes "Woonkamer,Studeerkamer"      seeded through the application's own API
 *   pnpm screenshot --width 1280 --height 900
 *
 * The store is a temporary directory that goes away afterwards, so nothing here touches the remotes
 * anybody actually has.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { launch } from '../test/app/electron.ts';

interface Options {
  out: string;
  remotes: string[];
  width: number;
  height: number;
}

function options(argv: string[]): Options {
  const named = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };
  const listed = named('--remotes');
  return {
    out: resolve(named('--out') ?? 'var/screenshot.png'),
    remotes: listed === undefined || listed === '' ? [] : listed.split(',').map((n) => n.trim()),
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
    for (const name of wanted.remotes) {
      await app.evaluate(`window.freeharmony.remotes.create(${JSON.stringify(name)})`);
    }
    if (wanted.remotes.length > 0) await app.reload();

    // The size is stated rather than taken from the window, so two screenshots can be compared. The
    // device scale is 2 because this is a retina machine and half resolution looks like a mistake.
    await app.send('Emulation.setDeviceMetricsOverride',
                   { width: wanted.width, height: wanted.height, deviceScaleFactor: 2, mobile: false });
    const shot = await app.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const data = (shot as { data: string }).data;

    await mkdir(dirname(wanted.out), { recursive: true });
    await writeFile(wanted.out, Buffer.from(data, 'base64'));
    console.log(`${wanted.out} (${wanted.width} by ${wanted.height}, ${wanted.remotes.length} remotes)`);
    return 0;
  } finally {
    await app.close();
  }
}

process.exitCode = await main();

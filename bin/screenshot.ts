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
 *   pnpm screenshot --configuration h600_config              give the first remote a real configuration
 *   pnpm screenshot --click "Add..." --click "Harmony 600"    to reach a screen that is not the first
 *   pnpm screenshot --appliances "TV:television,Amp:receiver" --click "Device library"   the panel
 *   pnpm screenshot --pretend-attached h600 --configuration h600_config    the import dialogue
 *   pnpm screenshot --width 1280 --height 900
 *
 * A remote is seeded as `Name` or `Name:model`, where the model is a drawing's id, so a picture can be
 * in the picture. `--click` presses whatever carries that text and may be repeated, which is how a
 * screen three steps in gets photographed without a person driving it.
 *
 * The store is a temporary directory that goes away afterwards, so nothing here touches the remotes
 * anybody actually has.
 *
 * `--configuration` needs a lab, since this repository holds no configuration of anybody's, and it
 * attaches one through `RemoteStore`'s own method rather than by writing a manifest by hand. That
 * matters for the same reason the seeding above goes through the bridge: a picture of a state nobody
 * can reach is a picture of nothing. The store is a plain class that takes its root as an argument, so
 * this process can use the very code the main process uses, pointed at the same temporary folder.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { imagePath, require_ } from '@harmony/lab';

import { importReading } from '../src/main/configuration.ts';
import { DeviceLibrary } from '../src/main/store/library.ts';
import { RemoteStore } from '../src/main/store/remotes.ts';
import { KINDS } from '../src/shared/library.ts';
import { asRemoteModel, SUPPORTED } from '../src/renderer/src/catalogue.ts';
import { launch } from '../test/app/electron.ts';

interface Options {
  out: string;
  remotes: { name: string; model: string | undefined }[];
  /** A lab sample to attach to the first seeded remote, so a page can show real contents. */
  configuration: string | undefined;
  clicks: string[];
  /** Hand written appliances, so the library has something in it that is not from a configuration. */
  appliances: { name: string; kind: string }[];
  /** A model whose configuration stands in for a remote on the bus, per `src/main/pretend.ts`. */
  pretendAttached?: string;
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
    configuration: named('--configuration'),
    clicks: every('--click'),
    appliances: (named('--appliances') ?? '').split(',').filter((one) => one !== '').map((entry) => {
      const [name, kind] = entry.split(':');
      return { name: (name ?? '').trim(), kind: (kind ?? 'other').trim() };
    }),
    ...(named('--pretend-attached') === undefined
      ? {} : { pretendAttached: named('--pretend-attached')! }),
    width: Number(named('--width') ?? 1100),
    height: Number(named('--height') ?? 760),
  };
}

async function main(): Promise<number> {
  const wanted = options(process.argv.slice(2));

  // A remote on the bus, and a reading off it, without either existing.
  //
  // Set **before the application starts**, because the seam is in the main process and there is no way
  // to reach it afterwards: `contextBridge` freezes the API deeply and `window.freeharmony` is neither
  // writable nor configurable, so a page side stub silently does nothing. Measured on 22 August 2026,
  // which is how this ended up here instead of in an `evaluate`.
  //
  // What it buys is a dialogue full of what a real configuration actually holds. What it cannot do is
  // import: `importInto` refuses a pretended reading, per `src/main/pretend.ts`.
  if (wanted.pretendAttached !== undefined) {
    const model = SUPPORTED.find((m) => m.id === wanted.pretendAttached);
    if (model === undefined) {
      throw new Error(`no drawing called ${wanted.pretendAttached}; `
                      + `try ${SUPPORTED.map((m) => m.id).join(', ')}`);
    }
    if (wanted.configuration === undefined) {
      throw new Error('--pretend-attached needs a --configuration for it to be reading');
    }
    const file = imagePath(wanted.configuration);
    if (file === undefined) throw new Error(`no configuration called ${wanted.configuration} in the lab`);
    process.env['FREEHARMONY_PRETEND_REMOTE'] = JSON.stringify({ skin: model.skin, file });
  }

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
    // A real configuration behind the first remote, **through the import** rather than by attaching bytes.
    //
    // It used to attach them with the store's own method, and the difference showed up the moment there
    // was a devices page to photograph: every tile said "not on this machine", because attaching bytes
    // does not put the appliances in the library and an import does. The picture was correct about the
    // state it had been given and wrong about any state the application produces, which is the worst
    // kind of screenshot to look at.
    //
    // The reload below is what makes the window notice, since nothing polls the disk.
    const first = wanted.remotes[0];
    if (wanted.configuration !== undefined && first !== undefined) {
      // The skin of the model the first remote was seeded with. **The import refuses without one**, which
      // is the rail doing its job even to a script: a reading always comes out of `inspectAttached`, which
      // has already established what the remote said it was, so a reading with no skin is one somebody
      // invented. Hence the requirement rather than a default.
      const picked = first.model === undefined
        ? undefined : SUPPORTED.find((m) => m.id === first.model);
      if (picked === undefined) {
        throw new Error('--configuration needs the first remote to name a model, as "Name:h600"');
      }
      const store = new RemoteStore({ root: app.remotes });
      const library = new DeviceLibrary({ root: app.devices });
      await importReading(store, library, first.name,
                          { bytes: require_(wanted.configuration), skin: picked.skin,
                            model: asRemoteModel(picked) },
                          () => new Date().toISOString());
    }
    // Appliances written down by hand, through the same bridge method the form calls. A library seeded
    // only from a configuration is all one kind, `other`, because a configuration says nothing about what
    // a device is, so a picture of it would show the same drawing nine times and say nothing about the
    // drawings.
    for (const { name, kind } of wanted.appliances) {
      if (!(KINDS as readonly string[]).includes(kind)) {
        throw new Error(`no such kind as ${kind}; try ${KINDS.join(', ')}`);
      }
      await app.evaluate(`window.freeharmony.library.create(`
        + `{ kind: ${JSON.stringify(kind)}, name: ${JSON.stringify(name)} })`);
    }
    if (wanted.remotes.length > 0 || wanted.appliances.length > 0) await app.reload();

    // Presses whatever carries the given text, so a screen several steps in can be photographed. A
    // pause after each, because a click here is a real click and React redraws on its own schedule.
    for (const text of wanted.clicks) {
      const found = await app.evaluate<boolean>(`(() => {
        const wanted = ${JSON.stringify(text)};
        // Inside the panel where one is open, for the reason test/app/library.test.ts records at length:
        // a scripted click reaches straight through a sheet lying over the application, so a search across
        // the page can press something a person could not. And by label as well as by text, because the
        // way into the library is a drawing with no words in it. No backticks in here: this comment is
        // inside a template literal, and one would end the string.
        const within = document.querySelector('.mantine-Modal-content') ?? document;
        for (const it of within.querySelectorAll('button')) {
          const says = (it.textContent ?? '').trim().includes(wanted)
            || it.getAttribute('aria-label') === wanted;
          if (says && !it.disabled) { it.click(); return true; }
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

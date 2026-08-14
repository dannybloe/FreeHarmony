/**
 * The first thing in this repository, and it is deliberately not the interface.
 *
 * `CLAUDE.md` says why: the boundary between this product and the libraries next door has to be proven
 * before there is an Electron shell to hide a problem in. So this script does one thing. It takes the
 * path of a config, hands the bytes to `@harmony/codec`, and prints what the config says about itself:
 * when it was built, which devices it drives, which activities it offers and which devices each of those
 * uses.
 *
 * Every fact it prints is read out of the bytes by the library. Nothing here parses anything, which is
 * the property to keep: a second reading of the format in this repository is the one thing that must not
 * happen, because no test can see two copies across a repository boundary.
 *
 * Two things it deliberately does not do. It does not open a remote, because that is a separate step
 * with its own rails and this one only has to answer whether the dependency resolves and the readers
 * run. And it does not name the model, because that lives in `@harmony/usb`, which depends on `node-hid`
 * and therefore on approving a native build: a decision that belongs in its own commit rather than
 * riding along in the first one. So it prints the architecture the config states and leaves it there.
 *
 * Usage, with a config from your own remote, which never comes into this repository:
 *
 *   node bin/inventory.ts ../lab/dumps/<person>/<remote>/<config file>
 */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { inventory, parse } from '@harmony/codec';

async function main(): Promise<number> {
  const path = process.argv[2];
  if (path === undefined) {
    process.stderr.write('usage: node bin/inventory.ts <config file>\n');
    return 2;
  }

  const bytes = new Uint8Array(await readFile(path));
  const container = parse(bytes);
  const view = inventory(container);

  // Devices are identified by their infrared group, and an activity names the groups it drives, so this
  // is the one place the script joins two of the library's answers together. Section 126 and 120.
  const nameOfGroup = new Map<number, string>();
  for (const device of view.devices) {
    if (device.name !== undefined) nameOfGroup.set(device.group, device.name);
  }

  const lines: string[] = [];
  lines.push(`${basename(path)}: architecture ${view.architecture ?? 'not stated'}`);
  lines.push(`built ${view.builtAt ?? 'not stated'}`);
  lines.push('');

  lines.push(`${view.devices.length} device(s)`);
  for (const device of view.devices) {
    // `source` is shown rather than hidden, because the three routes are not equally strong: a label
    // read out of the config's own state variable names is a different kind of answer from one
    // recovered by elimination or from a mode's drawn title. Section 126.
    const source = device.source === undefined ? 'unnamed' : device.source;
    lines.push(`  ${device.name ?? '(no name)'}  [${source}, ${device.codes} code(s)]`);
  }
  lines.push('');

  lines.push(`${view.activities.length} activity/activities`);
  for (const activity of view.activities) {
    const drives = activity.devices.map((group) => nameOfGroup.get(group) ?? `group ${group}`);
    const what = drives.length === 0 ? 'drives nothing this reader can see' : `drives ${drives.join(', ')}`;
    lines.push(`  ${activity.name ?? '(no name)'}  ${what}`);
  }
  if (view.idle !== undefined) {
    lines.push('');
    lines.push(`the value that means no activity is running: ${view.idle}`);
  }

  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

process.exitCode = await main();

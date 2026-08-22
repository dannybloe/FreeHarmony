/**
 * The boundary between this product and the libraries next door, as a test rather than a paragraph.
 *
 * `harmony-explorations`' own brief asked for exactly this: "whatever it becomes, it should be exercised
 * by a probe that installs and imports rather than by a paragraph like this one". This is that probe, and
 * writing it immediately refuted the paragraph.
 *
 * **What both briefs claimed**, on one measurement taken on 12 August 2026: that a path dependency
 * spelled `"@harmony/codec": "file:../harmony-explorations/packages/codec"` works, because the install is
 * a symlink and Node resolves the real path, which is outside `node_modules`. **The mechanism is right and
 * the spelling is wrong for the package manager this project uses.** Measured on 14 August 2026, all four
 * combinations:
 *
 * | tool | spelling | result |
 * |---|---|---|
 * | npm | `file:` | works, a direct symlink to the sibling |
 * | npm | `link:` | installs nothing at all |
 * | pnpm | `file:` | fails: the package is copied into `node_modules/.pnpm`, so the real path is inside `node_modules` and Node refuses to strip its types |
 * | pnpm | `link:` | works, a direct symlink to the sibling |
 *
 * So there is no single spelling that works under both, the earlier measurement was taken with npm, and
 * the failure under pnpm reports `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, which names types and
 * `node_modules` and says nothing about the real cause. That is what these tests are for.
 *
 * They need no fixture, which is deliberate: no config may ever come into this repository, so the
 * boundary has to be provable without one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, sep } from 'node:path';

import * as codec from '@harmony/codec';
import * as corpusRead from '@harmony/corpus/read';
import * as lab from '@harmony/lab';
import * as silhouettes from '@harmony/silhouettes';
import * as usb from '@harmony/usb';
import * as usbModels from '@harmony/usb/models';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/**
 * Every TypeScript source under a directory, relative to the repository root, found by walking
 * rather than by being told. Used by the last test in this file, which has to see files that did not
 * exist when it was written.
 */
function sourcesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sourcesUnder(relative));
    else if (/\.tsx?$/.test(entry.name)) found.push(relative);
  }
  return found;
}

/**
 * The libraries this product consumes, and what each has to answer.
 *
 * A table rather than a test each, because there are five entries now across four packages and
 * everything below is the same claim about all of them: the sibling's oldest rule is that a derivation
 * must not exist twice, and a boundary check copied per library is exactly that. Adding another means
 * adding a row.
 *
 * Four entries and three packages, because `@harmony/usb` appears twice: once as the package the main
 * process imports and once as the `models` subpath the window imports. Both are boundaries this product
 * depends on and they have different consequences, so both get a row.
 *
 * The export counts are exact, never a floor, per the sibling's own rule about bounds. They move when a
 * library gains or loses an export, and then they move in a diff somebody reads.
 */
const LIBRARIES: readonly {
  /** What the import says. For a subpath this is not the package name, which is why `pkg` exists. */
  name: string;
  /** The package as `package.json` declares it. Only stated where it differs from the import. */
  pkg?: string;
  module: Record<string, unknown>;
  exports: number;
  entry: readonly string[];
  functions: readonly string[];
}[] = [
  {
    // 361 until 21 August 2026, then 374 for a reader of what a length change would move, then 377 for
    // the language reader this product asked for, then 378 for `framesOfPulses`, which is the frame
    // decoder given an entry point that takes durations instead of a container so that this repository
    // could reuse it rather than copy it. The number moving is this row doing its job: a boundary whose
    // surface drifts unwatched is the one that surprises somebody later.
    name: '@harmony/codec',
    module: codec as unknown as Record<string, unknown>,
    exports: 378,
    entry: ['packages', 'codec', 'src', 'index.ts'],
    // `framesOfPulses` is named here rather than left to the count, because it is the one export this
    // repository reaches for from its own model's shape: a count moving says the surface changed and
    // a name says the thing we depend on is still there.
    functions: ['parse', 'inventory', 'devices', 'activities', 'trailerChecksum', 'framesOfPulses'],
  },
  {
    name: '@harmony/silhouettes',
    module: silhouettes as unknown as Record<string, unknown>,
    exports: 30,
    entry: ['packages', 'silhouettes', 'src', 'index.ts'],
    functions: ['toSvg', 'keyOf', 'keyOfScan'],
  },
  {
    // The package proper, imported by the **main process** and by nothing in the window. It is the row
    // that carries a native binding: `node-hid` is loaded dynamically inside `listHarmony`, so this
    // import on its own pulls nothing native in, which is exactly why a static import here is safe and
    // why an Electron main process that never touches USB pays nothing for the dependency.
    //
    // That the binding does load under Electron's own ABI is not checkable from here, because this test
    // runs under Node. `test/app/devices.test.ts` is where that is measured, in a real window.
    name: '@harmony/usb',
    module: usb as unknown as Record<string, unknown>,
    exports: 93,
    entry: ['packages', 'usb', 'src', 'index.ts'],
    functions: ['listHarmony', 'skinId', 'openHarmony'],
  },
  {
    // The only row that is a **development** dependency, and the only one this product does not ship.
    // It locates the private lab directory so that a test can run against somebody's own configuration,
    // which is the only way anything here can be tested at all: no configuration may ever come into
    // this repository. Reusing the sibling's locator rather than writing a second one is the same rule
    // as everything else in this file.
    name: '@harmony/lab',
    module: lab as unknown as Record<string, unknown>,
    exports: 10,
    entry: ['packages', 'lab', 'src', 'index.ts'],
    functions: ['load', 'require_', 'skipUnless'],
  },
  {
    // The second **subpath** row, and it is here because of what it deliberately leaves out. The package
    // is called `@harmony/corpus` and its other half files reads into the private lab directory; this
    // entry is the read itself, which imports `@harmony/codec` and nothing else. So the product gets the
    // transfer, with its end marker check and its trailer checksum, and not a route into anybody's lab.
    //
    // Those two checks are the reason a read is not reimplemented here. A transfer can insert bytes
    // without losing any, so a configuration that parses is not a configuration that arrived, and the
    // pair of checks that catch that were learned next door at some expense.
    name: '@harmony/corpus/read',
    pkg: '@harmony/corpus',
    module: corpusRead as unknown as Record<string, unknown>,
    exports: 8,
    entry: ['packages', 'corpus', 'src', 'read.ts'],
    functions: ['readConfig', 'profileFor', 'parseHeader'],
  },
  {
    // A **subpath** rather than the package, and that is the point of the row. `@harmony/usb` proper
    // pulls in the HID transport and its native binding; this entry is a table that imports nothing,
    // so a window can hold Logitech's own model figures without holding a device driver.
    name: '@harmony/usb/models',
    pkg: '@harmony/usb',
    module: usbModels as unknown as Record<string, unknown>,
    exports: 6,
    entry: ['packages', 'usb', 'src', 'models.ts'],
    functions: ['modelForSkin', 'architectureHasTouch'],
  },
];

test('every library imports at all, which is the whole point of the boundary', () => {
  for (const library of LIBRARIES) {
    assert.equal(Object.keys(library.module).length, library.exports, `${library.name} export surface`);
    for (const name of library.functions) {
      assert.equal(typeof library.module[name], 'function', `${library.name}: ${name} is missing`);
    }
  }
});

test('the drawing library answers for the three remotes this product supports', () => {
  /**
   * The one claim that is about what the second library is **for** rather than about the boundary.
   *
   * The interface has to be able to draw the chosen remote and colour a key in it, so what has to hold
   * is that a model is reachable by name, that its buttons are addressable individually, and that no
   * colour is baked into the file. That last one is the requirement the drawings were rebuilt for, and
   * it is checkable here without a config, which nothing in this repository may hold.
   */
  const models = silhouettes.MODELS as Record<string, { label: string; keys: readonly unknown[] }>;
  assert.deepEqual(Object.keys(models).sort(), ['h525', 'h600', 'one']);
  const BUTTONS: Readonly<Record<string, number>> = { h525: 50, h600: 54, one: 44 };
  for (const [id, model] of Object.entries(models)) {
    assert.equal(model.keys.length, BUTTONS[id], `${id}: button count`);
    const svg = silhouettes.toSvg(model as Parameters<typeof silhouettes.toSvg>[0]);
    // Addressable per key, which is what lets this product highlight one.
    assert.ok(svg.includes('data-name="VolumeUp"'), `${id}: no key is addressable by name`);
    // And colourable from outside: every fill reads a custom property, so a device group is a stylesheet
    // rule here and not a second drawing.
    assert.ok(svg.includes('var(--key-fill'), `${id}: a fill is not replaceable`);
  }
});

test('the dependency resolves to a real path outside node_modules, which is why it works', () => {
  // The mechanism, not the symptom. Node refuses to strip types for any file whose **real** path is
  // inside `node_modules`, whatever the flag, so a source only package can only be consumed through a
  // link that leaves the tree. Asserting the resolved path is what would have caught the wrong spelling
  // before it cost an afternoon.
  const require_ = createRequire(import.meta.url);
  for (const library of LIBRARIES) {
    const resolved = realpathSync(require_.resolve(library.name));
    assert.ok(
      !resolved.split(sep).includes('node_modules'),
      `${library.name} resolved inside node_modules, so Node will refuse to strip its types: ${resolved}`,
    );
    assert.ok(resolved.endsWith(join(...library.entry)), resolved);
  }
});

test('the dependency is spelled the way this project\'s package manager needs', () => {
  // pnpm's `file:` copies the package into its virtual store and breaks type stripping; npm's `link:`
  // installs nothing. So the spelling is per tool and both are stated here, together, because a
  // contributor who reaches for the other tool gets an error message that explains nothing.
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    packageManager?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert.ok(manifest.packageManager?.startsWith('pnpm@'), 'the package manager has to be stated');
  for (const library of LIBRARIES) {
    // The declared package, which is what a manifest holds. A subpath import is not a dependency of
    // its own, and asking for one is how this check first failed when the third row arrived.
    const declared = library.pkg ?? library.name;
    // **Either section**, which is how it failed when the fifth row arrived: the lab locator is a
    // development dependency, and it crosses exactly the same boundary and needs exactly the same
    // spelling. Which section a sibling is declared in is a question about shipping, not about
    // resolution.
    const spec = manifest.dependencies?.[declared] ?? manifest.devDependencies?.[declared];
    assert.ok(spec?.startsWith('link:'), `${declared}: pnpm needs link:, not ${spec}`);
    assert.ok(spec?.includes('harmony-explorations'), 'the sibling checkout is load bearing');
  }
});

test('nothing here re-implements the format, which is the one rule that protects the split', () => {
  // A cheap static check standing in for a habit: this repository may read the format only through the
  // library. It looks for the shapes a hand written parser needs, since that is what a second reading
  // would arrive at first. The scan is over this repository's own sources, including this file, so it
  // stays honest as they grow.
  //
  // **The alternatives are assembled rather than written out**, and the first version of this test was
  // its own first offender. That is the third time in one day that a check spelled the pattern it scans
  // for: the sibling's em-dash rule must not contain an em-dash, its Python floor scan reported itself,
  // and now this. Treat it as a standing hazard of any check that reads source, not as three slips.
  const parts = ['getUint' + '16', 'readUInt' + '16', 'Data' + 'View', '0x' + 'feed', '0x' + '1600',
    'GS' + 'PM'];
  const suspicious = new RegExp(parts.join('|'), 'i');
  // **Walked rather than listed**, and that is a correction: this was a literal naming two files
  // under a comment claiming the scan "stays honest as they grow". It did not. The window, the
  // build configuration and the page arrived in `src/`, and the check would have gone on passing
  // while looking at neither. A hand written population that nobody compares to the real one is the
  // sibling repository's most repeated failure, and the version of it that hides inside a test is
  // the worst kind, because the test reports a pass either way.
  //
  // The guard on the walk is per directory rather than a count of files, deliberately. A floor like
  // "at least eight sources" reads as a check and is one the moment somebody deletes a directory,
  // because seven other files still clear it. What can actually go wrong here is the walk looking in
  // the wrong place, so that is what is asserted, once per place.
  const directories = ['bin', 'build', 'src', 'test'];
  const files = directories.flatMap((directory) => {
    const found = sourcesUnder(directory);
    assert.ok(found.length > 0, `${directory}/ contributed no sources, so the walk is broken`);
    return found;
  });
  for (const relative of files) {
    const source = readFileSync(join(ROOT, relative), 'utf8');
    const code = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    assert.ok(!suspicious.test(code), `${relative} looks like it parses bytes itself`);
  }
});

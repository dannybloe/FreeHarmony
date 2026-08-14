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
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, sep } from 'node:path';

import * as codec from '@harmony/codec';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

test('the library imports at all, which is the whole point of this first commit', () => {
  // A count rather than a floor, per the sibling's own rule about bounds: 361 exports on 14 August 2026.
  // It moves when the library gains or loses one, and then it moves in a diff somebody reads.
  assert.equal(Object.keys(codec).length, 361, 'the codec export surface');
  for (const name of ['parse', 'inventory', 'devices', 'activities', 'trailerChecksum']) {
    assert.equal(typeof (codec as Record<string, unknown>)[name], 'function', `${name} is missing`);
  }
});

test('the dependency resolves to a real path outside node_modules, which is why it works', () => {
  // The mechanism, not the symptom. Node refuses to strip types for any file whose **real** path is
  // inside `node_modules`, whatever the flag, so a source only package can only be consumed through a
  // link that leaves the tree. Asserting the resolved path is what would have caught the wrong spelling
  // before it cost an afternoon.
  const require_ = createRequire(import.meta.url);
  const resolved = realpathSync(require_.resolve('@harmony/codec'));
  assert.ok(
    !resolved.split(sep).includes('node_modules'),
    `resolved inside node_modules, so Node will refuse to strip its types: ${resolved}`,
  );
  assert.ok(resolved.endsWith(join('packages', 'codec', 'src', 'index.ts')), resolved);
});

test('the dependency is spelled the way this project\'s package manager needs', () => {
  // pnpm's `file:` copies the package into its virtual store and breaks type stripping; npm's `link:`
  // installs nothing. So the spelling is per tool and both are stated here, together, because a
  // contributor who reaches for the other tool gets an error message that explains nothing.
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    packageManager?: string;
    dependencies?: Record<string, string>;
  };
  assert.ok(manifest.packageManager?.startsWith('pnpm@'), 'the package manager has to be stated');
  const spec = manifest.dependencies?.['@harmony/codec'];
  assert.ok(spec?.startsWith('link:'), `pnpm needs link:, not ${spec}`);
  assert.ok(spec?.includes('harmony-explorations'), 'the sibling checkout is load bearing');
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
  const files = ['bin/inventory.ts', 'test/boundary.test.ts'];
  for (const relative of files) {
    const source = readFileSync(join(ROOT, relative), 'utf8');
    const code = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    assert.ok(!suspicious.test(code), `${relative} looks like it parses bytes itself`);
  }
});

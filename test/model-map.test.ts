/**
 * The diagram in `docs/data-model.md` still describes the model.
 *
 * **This is what makes a picture in a document worth having.** A diagram drawn by hand is a copy of a
 * fact with no test, and the sibling repository audited eleven of those: the code never drifted, the
 * documents summarising it did, because a summary is a copy nothing checks. So the picture is generated
 * and this compares the committed one with what the interfaces say today. Add a field to the model and
 * `pnpm model-map --write` runs in the same commit, or this fails.
 *
 * The second test is the one that would otherwise rot silently. The notes saying whether a field can
 * reach a remote are joined on from `writeback.ts`, through the type argument each of its tables
 * declares. If that reading broke, every note would simply be absent, the diagram would still render,
 * and it would look complete while stating nothing. So the count is asserted exactly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { block } from '../bin/model-map.ts';

const DOCUMENT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'data-model.md');

/** Just the generated part, markers included, which is what `block()` returns. */
function committed(): string {
  const text = readFileSync(DOCUMENT, 'utf8');
  const at = text.indexOf('<!-- model-map:start -->');
  const to = text.indexOf('<!-- model-map:end -->');
  assert.ok(at !== -1 && to !== -1, 'docs/data-model.md has lost its model-map markers');
  return text.slice(at, to + '<!-- model-map:end -->'.length);
}

test('the diagram in the document is the one the interfaces describe', () => {
  assert.equal(committed(), block(),
               'the model moved and the diagram did not. Run `pnpm model-map --write`');
});

test('every structure in the model is drawn, on one side or the other', () => {
  const drawn = committed();
  // 22 boxes and 28 captions: the six extra rows are structures whose fields are all plain values, so
  // they are captioned and have nothing to point at. Exact, because a structure that stopped being
  // drawn would leave a document describing less of the model than it used to and say nothing.
  assert.equal((drawn.match(/^ {2}\w+ \{$/gm) ?? []).length, 22);
  assert.equal((drawn.match(/^\| `\w+` \|/gm) ?? []).length, 28);
  // Both halves, named rather than counted, since the split between them is the load bearing decision
  // this diagram exists to show.
  assert.match(drawn, /### What a remote document holds/);
  assert.match(drawn, /### What the device library holds/);
  // And the one crossing, which is written by hand in the generator because a reference carried as a
  // string cannot be read off a type. Without it the two halves are drawn as unrelated.
  assert.match(drawn, /DeviceUse \}o--\|\| DeviceDefinition/);
});

test('the writeback notes reached the diagram, all 65 of them', () => {
  const drawn = committed();
  const noted = drawn.match(/"[^"]*(reaches a remote|ours, never|unread)[^"]*"/g) ?? [];
  // Exact rather than a floor. A floor here would be the worst kind: the join could break for one table
  // of thirteen, thirteen fields would quietly lose their answer, and any bound under the total would
  // still pass. The number moves when somebody adds a field to the model, and then it moves in the diff.
  assert.equal(noted.length, 65);
  // All four verdicts appear, so the vocabulary itself is exercised rather than one arm of it. The
  // unread one matters most: it is the only one that says a person cannot change this yet.
  for (const wording of ['reaches a remote', 'reaches a remote, same length only',
                         'ours, never in a config', 'a config states it somewhere, unread']) {
    assert.ok(drawn.includes(`"${wording}"`) || drawn.includes(`, ${wording}"`),
              `no field is marked ${wording}`);
  }
});

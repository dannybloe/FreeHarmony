/**
 * Importing, in a running window, and the rail that makes the pretence safe.
 *
 * **The only place either can be tested.** `inspectAttached` opens a remote, so nothing under `test/`
 * can reach it; `src/main/pretend.ts` exists so that the import dialogue can be looked at without
 * hardware, and it makes exactly one thing reachable that was not: the whole flow, against a real
 * configuration read out of a file.
 *
 * The rail is the reason that seam is acceptable at all, so it is asserted rather than trusted: a reading
 * that came out of a file **may be looked at and may never be imported**, because a document recording
 * that it was read off a device has to have been. A rail with no test is a comment.
 *
 * It also happens to be the only end to end exercise of the two halves: the summary crosses the bridge
 * with everything structured cloning can drop, which no fake will ever tell you.
 *
 * Needs a lab and skips without one, since no configuration lives in this repository.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { imagePath, skipUnless } from '@harmony/lab';

import { API_NAMESPACE } from '../../src/shared/api.ts';
import type { AttachedSummary } from '../../src/shared/import.ts';
import { launch } from './electron.ts';

const SAMPLE = 'h600_config';
/** A Harmony 600, so the document and the pretended remote are the same model and nothing is refused. */
const A_HARMONY_600 = 71;

/** What that configuration holds, from `test/import.test.ts`. Exact, so a seam that drops one shows. */
const DEVICES = 4;
const ACTIVITIES = 3;

function pretence(): string {
  const file = imagePath(SAMPLE);
  assert.ok(file !== undefined, `${SAMPLE} is in the lab`);
  return JSON.stringify({ skin: A_HARMONY_600, file });
}

test('a reading crosses the bridge whole, with everything it says about the remote',
     skipUnless(SAMPLE), async (t) => {
  const app = await launch({ pretendRemote: pretence() });
  t.after(() => app.close());

  await app.evaluate(
    `window.${API_NAMESPACE}.remotes.create('living room', { name: 'Harmony 600', skin: ${A_HARMONY_600} })`);
  const summary = await app.evaluate<AttachedSummary>(
    `window.${API_NAMESPACE}.remotes.inspectAttached(0xc121, 'living room')`);

  assert.equal(summary.appliances.length, DEVICES);
  assert.equal(summary.activities.length, ACTIVITIES);
  assert.ok(summary.buttonCount > 0, 'and what every button sends came along');
  assert.equal(typeof summary.token, 'string');
  // Every appliance is new, because the library is empty in a fresh store. Counted rather than named:
  // the words in that configuration are somebody's own equipment and this repository is public.
  assert.deepEqual(summary.appliances.map((one) => one.disposition),
                   Array.from({ length: DEVICES }, () => 'new'));
  // The document already showed nothing, so there is nothing to replace, and the confirmation says so by
  // omitting the block rather than by claiming zero of everything.
  assert.equal(summary.replacing, undefined);
});

test('a reading out of a file may be looked at and may never be imported',
     skipUnless(SAMPLE), async (t) => {
  // The rail behind `src/main/pretend.ts`. Without it that seam would be a way to file a document as
  // having been read off a remote that was never plugged in, which is a lie about provenance in the one
  // place this application cannot afford one.
  const app = await launch({ pretendRemote: pretence() });
  t.after(() => app.close());

  await app.evaluate(
    `window.${API_NAMESPACE}.remotes.create('living room', { name: 'Harmony 600', skin: ${A_HARMONY_600} })`);
  const summary = await app.evaluate<AttachedSummary>(
    `window.${API_NAMESPACE}.remotes.inspectAttached(0xc121, 'living room')`);

  const refused = await app.evaluate<string>(`
    window.${API_NAMESPACE}.remotes.importFrom('living room', ${JSON.stringify(summary.token)})
      .then(() => 'it imported, which it must not')
      .catch((error) => String(error.message ?? error))`);

  assert.match(refused, /out of a file/);
  // And nothing landed: no contents, and the library is still empty.
  const contents = await app.evaluate<unknown>(
    `window.${API_NAMESPACE}.remotes.contents('living room')`);
  assert.equal(contents, undefined);
  const library = await app.evaluate<unknown[]>(`window.${API_NAMESPACE}.library.list()`);
  assert.deepEqual(library, []);
});

test('an incompatible remote is refused before anything is read', skipUnless(SAMPLE), async (t) => {
  // The order matters more than the refusal: settled by enumeration, so an incompatible remote is never
  // claimed and never held for a minute in order to be told no.
  const app = await launch({ pretendRemote: pretence() });
  t.after(() => app.close());

  await app.evaluate(
    `window.${API_NAMESPACE}.remotes.create('the one', { name: 'Harmony One', skin: 54 })`);
  const refused = await app.evaluate<string>(`
    window.${API_NAMESPACE}.remotes.inspectAttached(0xc121, 'the one')
      .then(() => 'it read it anyway')
      .catch((error) => String(error.message ?? error))`);

  assert.match(refused, /Harmony 600 is attached and this document is about a Harmony One/);
});

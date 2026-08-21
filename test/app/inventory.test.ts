/**
 * A document's contents, in a running window, from bytes on disk to words on a page.
 *
 * **The only test that can catch what this one catches**, which is why it exists alongside the unit
 * tests that already cover both halves. `test/configuration.test.ts` proves the projection reads a real
 * configuration; `test/contents.test.ts` proves the view model's states. Neither can see that the model
 * survives the bridge: everything crossing it is structured cloned, so a field the main process builds
 * that cannot be cloned arrives as nothing at all, and no fake will ever tell you.
 *
 * Assertions are **counts and headings, never a name**. The words on that page are somebody's own
 * equipment, and this repository is public. What is being checked is that four devices arrive as four
 * rows, which is the seam; what they are called is the projection's business and is asserted next door
 * against numbers rather than strings.
 *
 * Needs a lab and skips without one, since no configuration lives in this repository.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { require_, skipUnless } from '@harmony/lab';

import { RemoteStore } from '../../src/main/store/remotes.ts';
import { API_NAMESPACE } from '../../src/shared/api.ts';
import type { DocumentContents } from '../../src/shared/content.ts';
import { launch } from './electron.ts';

const SAMPLE = 'h600_config';

/** What that configuration holds, from `test/import.test.ts`. Exact, so a seam that drops one shows. */
const DEVICES = 4;
const ACTIVITIES = 3;

test('a document with a configuration behind it reaches the page as devices and activities',
     skipUnless(SAMPLE), async (t) => {
  const app = await launch();
  t.after(() => app.close());

  // Created through the bridge, so the document is one the application made. The configuration is
  // attached with the store's own method, pointed at the same folder the application is using: there is
  // no route over the bridge for bytes from a file, deliberately, since the only thing that puts a
  // configuration on a document in the product is a read off a remote.
  await app.evaluate(`window['${API_NAMESPACE}'].remotes.create('living room')`);
  const store = new RemoteStore({ root: app.remotes });
  await store.attachConfiguration('living room', 'configuration.bin', require_(SAMPLE),
                                  'read-from-device', new Date().toISOString());

  const contents = await app.evaluate<DocumentContents | undefined>(
    `window['${API_NAMESPACE}'].remotes.contents('living room')`);

  assert.ok(contents !== undefined, 'a document with a configuration has contents');
  assert.equal(contents.content.devices.length, DEVICES);
  assert.equal(contents.content.activities.length, ACTIVITIES);
  // The bindings are where a structured clone failure would show first, because they are the deep part:
  // a list of bindings each holding a list of steps. A count that arrives means the whole tree did.
  assert.ok(contents.content.buttons.length > 0, 'and its buttons crossed');
  assert.equal(contents.content.buttons.every((one) => Array.isArray(one.sends)), true,
               'each with the steps it sends, nested and intact');
  // Nothing has been filed yet, so every appliance is one this machine has no description of. Asserted
  // because the answer is the reason the method exists, not because a page shows it.
  assert.equal(contents.missing.length, DEVICES);
});

test('an appliance is described once and a second read of the same document adds nothing',
     skipUnless(SAMPLE), async (t) => {
  // The point of the library sitting outside the document, over the real bridge. The identifiers are
  // named after what an appliance sends, so filing twice is a no-op rather than a second television.
  const app = await launch();
  t.after(() => app.close());

  await app.evaluate(`window['${API_NAMESPACE}'].remotes.create('living room')`);
  const store = new RemoteStore({ root: app.remotes });
  await store.attachConfiguration('living room', 'configuration.bin', require_(SAMPLE),
                                  'read-from-device', new Date().toISOString());

  const first = await app.evaluate<{ added: string[]; kept: string[] }>(
    `window['${API_NAMESPACE}'].remotes.fileDefinitions('living room')`);
  assert.equal(first.added.length, DEVICES);
  assert.deepEqual(first.kept, []);

  const second = await app.evaluate<{ added: string[]; kept: string[] }>(
    `window['${API_NAMESPACE}'].remotes.fileDefinitions('living room')`);
  assert.deepEqual(second.added, [], 'nothing is new the second time');
  assert.equal(second.kept.length, DEVICES);

  const after = await app.evaluate<DocumentContents | undefined>(
    `window['${API_NAMESPACE}'].remotes.contents('living room')`);
  assert.deepEqual(after?.missing, [], 'and the document knows nothing is missing any more');
});

test('the page shows a row per device and per activity', skipUnless(SAMPLE), async (t) => {
  // Through the interface rather than through the bridge, because a model that crosses and is never
  // drawn is a model nobody sees. Rows are counted; the words in them are not read.
  const app = await launch();
  t.after(() => app.close());

  await app.evaluate(`window['${API_NAMESPACE}'].remotes.create('living room')`);
  const store = new RemoteStore({ root: app.remotes });
  await store.attachConfiguration('living room', 'configuration.bin', require_(SAMPLE),
                                  'read-from-device', new Date().toISOString());
  await app.reload();

  // Into the document's own page, the same way a person gets there.
  const opened = await app.evaluate<boolean>(`(() => {
    for (const it of document.querySelectorAll('button')) {
      if ((it.textContent ?? '').includes('living room')) { it.click(); return true; }
    }
    return false;
  })()`);
  assert.equal(opened, true, 'the remote is on Home to be opened');

  // React draws when it is ready, and the contents are fetched after the page mounts.
  const rows = await app.evaluate<number[]>(`(async () => {
    for (let tries = 0; tries < 40; tries += 1) {
      const lists = [...document.querySelectorAll('section ul')];
      const counted = lists.map((list) => list.children.length);
      if (counted.length >= 2) return counted;
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return [];
  })()`);

  assert.deepEqual(rows, [DEVICES, ACTIVITIES],
                   'one list of devices and one of activities, each with a row per item');
});

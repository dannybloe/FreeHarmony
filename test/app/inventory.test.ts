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

test('the devices page shows a tile per device, and the activities page one per activity',
     skipUnless(SAMPLE), async (t) => {
  // **This test moved rather than being written.** Its subject was a list of devices and a list of
  // activities on the remote's own front page; on 22 August 2026 that page became a way in to three
  // others, and showing both lists on the way in to pages about them was the same content twice. So the
  // claim is the same and the route to it is two clicks longer.
  //
  // Through the interface rather than through the bridge, because a model that crosses and is never drawn
  // is a model nobody sees. Tiles are counted; the words in them are not read, since they are somebody's
  // own equipment and this repository is public.
  const app = await launch();
  t.after(() => app.close());

  await app.evaluate(`window['${API_NAMESPACE}'].remotes.create('living room')`);
  const store = new RemoteStore({ root: app.remotes });
  await store.attachConfiguration('living room', 'configuration.bin', require_(SAMPLE),
                                  'read-from-device', new Date().toISOString());
  await app.reload();

  /**
   * Presses whatever says this, waiting for it to appear first.
   *
   * The wait is not politeness: React draws when it is ready and a document's contents are fetched after
   * its page mounts, so a click issued straight after the previous one lands on a page that has not been
   * replaced yet. Matched on the label as well as the text, which is how the bar's back arrow is reached.
   */
  const press = async (what: string): Promise<boolean> => {
    const wanted = JSON.stringify(what);
    return app.evaluate<boolean>(`(async () => {
      for (let tries = 0; tries < 40; tries += 1) {
        for (const it of document.querySelectorAll('button')) {
          const says = (it.textContent ?? '').includes(${wanted});
          if (says || it.getAttribute('aria-label') === ${wanted}) { it.click(); return true; }
        }
        await new Promise((wake) => setTimeout(wake, 100));
      }
      return false;
    })()`);
  };

  /**
   * How many tiles a section holds, once it has drawn.
   *
   * Found by heading and by `data-tile`, and both halves were arrived at the hard way. Class names are
   * hashed by the bundler so a test cannot ask by class, per `test/styles.test.ts`; and counting by shape
   * instead **nearly passed for the wrong reason**, because the grid holding the tiles is itself a `div`
   * whose text starts with the first tile's number. It counted four activities where there are three, and
   * it counted the devices correctly only because that grid also holds the add tile and was filtered out
   * by its label. So the attribute exists, and the add tile carries a different value.
   */
  const tiles = async (heading: string): Promise<number> => {
    const wanted = JSON.stringify(heading);
    return app.evaluate<number>(`(async () => {
      for (let tries = 0; tries < 40; tries += 1) {
        const section = [...document.querySelectorAll('section')]
          .find((one) => (one.querySelector('h2')?.textContent ?? '') === ${wanted});
        if (section) {
          const drawn = section.querySelectorAll('[data-tile=""]');
          if (drawn.length > 0) return drawn.length;
        }
        await new Promise((wake) => setTimeout(wake, 100));
      }
      return -1;
    })()`);
  };

  assert.equal(await press('living room'), true, 'the remote is on Home to be opened');
  assert.equal(await press('Devices'), true, 'and its page offers a way in to the devices');
  assert.equal(await tiles('Devices'), DEVICES, 'one tile per device, the add tile aside');

  // Back to the remote, the way a person goes back since 22 August 2026: the remote's own crumb in the
  // trail. There is no arrow any more, and this is the one test that exercises the trail as a control
  // rather than as a computation, which is why it presses the name rather than calling `go`.
  assert.equal(await press('living room'), true);
  assert.equal(await press('Activities'), true);
  assert.equal(await tiles('Activities'), ACTIVITIES, 'one tile per activity');
});

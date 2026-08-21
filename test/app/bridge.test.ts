/**
 * The bridge, in a running window, which is the only place it can be checked.
 *
 * Everything here goes through the page: an expression is evaluated in the window, it calls
 * `window.freeharmony`, and the assertions are about what came back and about what appeared on disk.
 * Nothing in this file imports the main process, so a test can only pass if the whole path works,
 * preload script, channel names, handlers, store and all.
 *
 * The expectations are imported from `src/shared` rather than written out. That is the point of a
 * shared contract, and it makes two claims checkable that a hand written list could not: that the
 * surface the page is given is exactly the surface the interface declares, and that the words a
 * refusal reaches the page with are the store's own rather than a second copy of the rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { API_NAMESPACE, METHODS } from '../../src/shared/api.ts';
import { whyNameIsRefused } from '../../src/shared/remote.ts';
import { launch } from './electron.ts';

test('the page is given exactly the surface the shared contract declares', async (t) => {
  // Walked from `METHODS` rather than from a list written out here, which is what made this test catch
  // the `devices` namespace arriving: it asserted `['remotes']` and had to be told about the second
  // half. A hand written expectation is the thing that would have needed telling twice.
  const app = await launch();
  t.after(() => app.close());

  assert.deepEqual(
    (await app.evaluate<string[]>(`Object.keys(window['${API_NAMESPACE}']).sort()`)),
    Object.keys(METHODS).sort(),
    'the namespaces, and nothing beside them',
  );

  for (const [namespace, methods] of Object.entries(METHODS)) {
    assert.deepEqual(
      (await app.evaluate<string[]>(
        `Object.keys(window['${API_NAMESPACE}'].${namespace}).sort()`)),
      [...methods].sort(),
      `${namespace}: the methods its interface declares and no others`,
    );
    assert.deepEqual(
      await app.evaluate<string[]>(
        `Object.values(window['${API_NAMESPACE}'].${namespace}).map((m) => typeof m)`),
      methods.map(() => 'function'),
      `${namespace}: every one of them is callable`,
    );
  }
});

test('the page has no route to the machine except the bridge', async (t) => {
  // The three security settings in `src/main/index.ts` are only worth writing down if something
  // checks them, and this is that check.
  //
  // The control was run rather than assumed: with `contextIsolation` off, `nodeIntegration` on and
  // `sandbox` off, six of these nine appear in the page, `require`, `module`, `process`, `global`,
  // `Buffer` and `__dirname`. So the list is not decoration and the settings are what empties it.
  const app = await launch();
  t.after(() => app.close());

  const reachable = await app.evaluate<Record<string, string>>(`(() => {
    const names = ['require', 'module', 'exports', 'process', 'global', 'Buffer',
                   'ipcRenderer', 'electron', '__dirname'];
    const seen = {};
    for (const name of names) {
      try { seen[name] = typeof eval(name); } catch { seen[name] = 'undefined'; }
    }
    return seen;
  })()`);

  assert.deepEqual(Object.values(reachable), Object.keys(reachable).map(() => 'undefined'),
                   `none of these may exist in the page, and these did: ${JSON.stringify(reachable)}`);
});

test('a request from the page reaches the store on disk, and every method does', async (t) => {
  // The assertion the unit tests cannot make. The store tests prove the store, the view model tests
  // prove the model against a fake, and only this one proves that what the window asks for is what
  // happens in a folder.
  const app = await launch();
  t.after(() => app.close());
  const api = `window['${API_NAMESPACE}'].remotes`;

  const made = await app.evaluate<{ name: string; provenance: string }>(
    `${api}.create('Woonkamer')`);
  assert.equal(made.name, 'Woonkamer');
  assert.equal(made.provenance, 'created-empty');
  assert.deepEqual(await readdir(app.store), ['Woonkamer'], 'the folder is named after the remote');

  const manifest = JSON.parse(
    await readFile(join(app.store, 'Woonkamer', 'remote.json'), 'utf8')) as Record<string, unknown>;
  assert.deepEqual(Object.keys(manifest).sort(), ['createdAt', 'provenance', 'updatedAt'],
                   'and the name is not in it as well');

  await app.evaluate(`${api}.rename('Woonkamer', 'Studeerkamer')`);
  assert.deepEqual(await readdir(app.store), ['Studeerkamer'], 'a rename moved the folder');

  const copy = await app.evaluate<{ name: string }>(`${api}.duplicate('Studeerkamer')`);
  assert.equal(copy.name, 'Studeerkamer copy');
  assert.deepEqual((await readdir(app.store)).sort(), ['Studeerkamer', 'Studeerkamer copy']);
  assert.deepEqual(await app.evaluate<string[]>(`${api}.list().then((r) => r.map((x) => x.name))`),
                   ['Studeerkamer copy', 'Studeerkamer'], 'most recently changed first, from the store');

  await app.evaluate(`${api}.remove('Studeerkamer copy')`);
  await app.evaluate(`${api}.remove('Studeerkamer')`);
  assert.deepEqual(await readdir(app.store), [], 'and removing takes the folders with it');
});

test('a refusal crosses as a thrown error carrying the store rule word for word', async (t) => {
  // Two things at once. That a rejection in the main process arrives in the page as a real error,
  // rather than as a value the window has to inspect and might not; and that the words are the ones
  // `whyNameIsRefused` produces, which is how we know the window is not carrying its own copy of the
  // rule that would drift from it.
  const app = await launch();
  t.after(() => app.close());
  const api = `window['${API_NAMESPACE}'].remotes`;

  const refusal = async (call: string) => app.evaluate<{ error: string; message: string } | null>(
    `(async () => {
       try { await ${call}; return null; }
       catch (thrown) { return { error: thrown.constructor.name, message: thrown.message }; }
     })()`);

  await app.evaluate(`${api}.create('Woonkamer')`);

  assert.deepEqual(await refusal(`${api}.create('a/b')`),
                   { error: 'Error', message: whyNameIsRefused('a/b')! });
  assert.deepEqual(await refusal(`${api}.create('Woonkamer')`),
                   { error: 'Error', message: 'there is already a remote called Woonkamer' });
  assert.deepEqual(await refusal(`${api}.rename('Zolder', 'Zolderkamer')`),
                   { error: 'Error', message: 'there is no remote called Zolder' });
  assert.deepEqual(await readdir(app.store), ['Woonkamer'], 'and nothing was created by any of them');
});

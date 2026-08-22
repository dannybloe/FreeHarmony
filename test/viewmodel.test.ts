/**
 * The view model, driven with no React, no DOM and no rendering library.
 *
 * This is the other half of the architecture's argument. `RemotesModel` holds everything a screen
 * needs to know and nothing about drawing, so the states that are awkward to produce by clicking,
 * a failure mid flight, a reload that must not blank the list, are reachable here in three lines
 * each. `useRemotes.ts` adds no behaviour to it, which is what makes testing the module equivalent
 * to testing the screen's logic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { RemotesApi } from '../src/shared/api.ts';
import type { RemoteDocument } from '../src/shared/remote.ts';
import { RemotesModel, type RemotesState } from '../src/renderer/src/viewmodels/remotes.model.ts';

function remote(name: string): RemoteDocument {
  return {
    name, provenance: 'created-empty',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * An API that answers from a list held here, and can be told to fail the next call.
 *
 * It is addressed by name throughout, like the real one, and that is not incidental to the test: the
 * view model passes a name straight from what is on screen to the main process, so if a name were not
 * enough to say which remote is meant, this fake could not be written either.
 */
function fakeApi(initial: RemoteDocument[] = []) {
  let held = [...initial];
  let failWith: string | undefined;
  const calls: string[] = [];

  const refuseIfAsked = () => {
    if (failWith === undefined) return;
    const message = failWith;
    failWith = undefined;
    throw new Error(message);
  };

  const api: RemotesApi = {
    list: async () => { calls.push('list'); refuseIfAsked(); return [...held]; },
    create: async (name) => {
      calls.push('create'); refuseIfAsked();
      const made = remote(name);
      held.push(made);
      return made;
    },
    rename: async (name, to) => {
      calls.push('rename'); refuseIfAsked();
      held = held.map((r) => (r.name === name ? { ...r, name: to } : r));
      return held.find((r) => r.name === to)!;
    },
    duplicate: async (name) => {
      calls.push('duplicate'); refuseIfAsked();
      const made = remote(`${name} copy`);
      held.push(made);
      return made;
    },
    remove: async (name) => {
      calls.push('remove'); refuseIfAsked();
      held = held.filter((r) => r.name !== name);
    },
    // The four that reach a configuration. This view model is about the list of documents and calls
    // none of them, which is what these throwing bodies assert: if it ever starts, a test fails here
    // rather than a page quietly opening a device.
    inspectAttached: async () => { throw new Error('the list view model must not read hardware'); },
    importFrom: async () => { throw new Error('the list view model must not import'); },
    contents: async () => { throw new Error('the list view model must not read a configuration'); },
    fileDefinitions: async () => { throw new Error('the list view model must not write a library'); },
    addDevice: async () => { throw new Error('the list view model must not change a document'); },
    labelDevice: async () => { throw new Error('the list view model must not change a document'); },
    assignButton: async () => { throw new Error('the list view model must not change a document'); },
  };

  return { api, calls, fail: (message: string) => { failWith = message; } };
}

function record(api: RemotesApi) {
  const seen: RemotesState[] = [];
  const model = new RemotesModel(api, (state) => seen.push(state));
  return { model, seen };
}

test('loading goes busy and then ready, in that order', async () => {
  const { api } = fakeApi([remote('bedroom')]);
  const { model, seen } = record(api);

  await model.load();

  assert.deepEqual(seen.map((s) => [s.status, s.busy]), [['loading', true], ['ready', false]]);
  assert.deepEqual(model.state.remotes.map((r) => r.name), ['bedroom']);
});

test('a change is a request, and what is displayed is what came back', async () => {
  // The decision the whole architecture rests on, as an assertion: the model never patches its own
  // array. Every operation ends in a fresh `list`, so the window shows what the main process has
  // rather than what the window predicted it would have.
  const { api, calls } = fakeApi([remote('bedroom')]);
  const { model } = record(api);

  await model.load();
  await model.rename('bedroom', 'study');

  assert.deepEqual(calls, ['list', 'rename', 'list']);
  assert.deepEqual(model.state.remotes.map((r) => r.name), ['study']);
});

test('every operation refreshes, so none of them can leave the list stale', async () => {
  const { api, calls } = fakeApi();
  const { model } = record(api);

  await model.create('one');
  await model.duplicate('one');
  await model.remove('one');

  assert.deepEqual(calls, ['create', 'list', 'duplicate', 'list', 'remove', 'list']);
});

test('a failure before the first answer is a failed screen', async () => {
  const { api, fail } = fakeApi();
  const { model } = record(api);

  fail('the store could not be read');
  await model.load();

  assert.equal(model.state.status, 'failed');
  assert.equal(model.state.error, 'the store could not be read');
  assert.equal(model.state.busy, false);
});

test('a failure after the first answer keeps the list on screen', async () => {
  // The distinction `status` and `busy` exist for. A rename that is refused should say so above a
  // list somebody can still read, not replace it with an error page.
  const { api, fail } = fakeApi([remote('bedroom')]);
  const { model } = record(api);

  await model.load();
  fail('a remote needs a name');
  await model.rename('bedroom', '   ');

  assert.equal(model.state.status, 'ready');
  assert.equal(model.state.error, 'a remote needs a name');
  assert.deepEqual(model.state.remotes.map((r) => r.name), ['bedroom']);
});

test('the model reports every state it passes through, since a screen redraws from them', async () => {
  const { api } = fakeApi();
  const { model, seen } = record(api);

  await model.create('one');

  assert.deepEqual(seen.map((s) => s.busy), [true, false]);
  assert.equal(seen.at(-1)?.remotes.length, 1);
});

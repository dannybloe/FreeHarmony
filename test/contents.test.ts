/**
 * The view model behind a remote's own page, against a fake API.
 *
 * No React, no DOM, no window, which is why it is a class in `viewmodels` and not logic inside a
 * component: every path here can be walked, including the one that is awkward to reach by clicking,
 * asking about a document somebody deleted from Finder while the page was open.
 *
 * **The reading tests are not here any more, they are in `import.model.test.ts`.** Reading a remote
 * became an import with a decision in the middle of it on 22 August 2026, so the three tests that used to
 * sit below moved with their subject rather than being dropped.
 *
 * The fake is the shared `RemotesApi`, so a method added to that interface fails the typecheck here
 * too, which is the seam doing its job.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { RemotesApi } from '../src/shared/api.ts';
import type { DocumentContents } from '../src/shared/content.ts';
import type { RemoteDocument } from '../src/shared/remote.ts';
import { ContentsModel, type ContentsState } from '../src/renderer/src/viewmodels/contents.model.ts';

const AT = '2026-08-21T12:00:00.000Z';

function contentsWith(devices: number): DocumentContents {
  return {
    content: {
      devices: Array.from({ length: devices }, (_unused, slot) => ({ slot })),
      activities: [], buttons: [], filledFrom: 'a-configuration',
    },
    missing: [],
  };
}

function document(name: string): RemoteDocument {
  return { name, provenance: 'read-from-device', createdAt: AT, updatedAt: AT };
}

/** A stand in for the main process, steered by what `contents` answers. */
function fakeApi(options: { contents?: DocumentContents | undefined } = {}) {
  const held = options.contents;
  const calls: string[] = [];
  const api: RemotesApi = {
    list: async () => [],
    create: async (name) => document(name),
    rename: async (_name, to) => document(to),
    duplicate: async (name) => document(`${name} copy`),
    remove: async () => {},
    contents: async (name) => {
      calls.push(`contents:${name}`);
      if (name === 'gone') throw new Error(`there is no remote called ${name}`);
      return held;
    },
    inspectAttached: async () => { throw new Error('not this test'); },
    importFrom: async () => { throw new Error('not this test'); },
    fileDefinitions: async () => ({ added: [], kept: [] }),
    addDevice: async () => { throw new Error('not this test'); },
  };
  return { api, calls };
}

function record(api: RemotesApi) {
  const seen: ContentsState[] = [];
  const model = new ContentsModel(api, (contents) => seen.push(contents));
  return { model, seen };
}

test('a document with a configuration goes looking and then ready', async () => {
  const { api } = fakeApi({ contents: contentsWith(3) });
  const { model, seen } = record(api);

  await model.load('living room');

  assert.deepEqual(seen.map((one) => one.status), ['loading', 'ready']);
  const last = model.contents;
  assert.equal(last.status, 'ready');
  assert.equal(last.status === 'ready' ? last.contents.content.devices.length : 0, 3);
});

test('a document with no configuration is empty, which is not a failure and not ready', async () => {
  // The distinction the whole state type exists for. A document made by picking a model from a list
  // holds nothing, and a page has something different to say about that than about four appliances.
  const { api } = fakeApi({ contents: undefined });
  const { model, seen } = record(api);

  await model.load('bedroom');

  assert.deepEqual(seen.map((one) => one.status), ['loading', 'empty']);
});

test('a document that is gone says so instead of drawing nothing', async () => {
  // Deleted from Finder while the page was open, which is a real thing to do to a document application.
  const { api } = fakeApi();
  const { model } = record(api);

  await model.load('gone');

  assert.equal(model.contents.status, 'failed');
  assert.match(model.contents.status === 'failed' ? model.contents.error : '', /no remote called gone/);
});

test('the appliances this machine has not got are carried through to the page', async () => {
  // The consequence of the library sitting outside the document, which the page turns into a sentence.
  const { api } = fakeApi({ contents: { ...contentsWith(2), missing: ['appliance-aaaa', 'appliance-bbbb'] } });
  const { model } = record(api);

  await model.load('living room');

  assert.deepEqual(model.contents.status === 'ready' ? model.contents.contents.missing : [],
                   ['appliance-aaaa', 'appliance-bbbb']);
});

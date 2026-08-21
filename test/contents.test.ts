/**
 * The view model behind a remote's own page, against a fake API.
 *
 * No React, no DOM, no window, which is why it is a class in `viewmodels` and not logic inside a
 * component: every path here can be walked, including the three that are awkward to reach by clicking.
 * A read of an irreplaceable device failing halfway. Two presses of the read button. And asking about a
 * document somebody deleted from Finder while the page was open.
 *
 * The fake is the shared `RemotesApi`, so a method added to that interface fails the typecheck here
 * too, which is the seam doing its job.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { RemotesApi } from '../src/shared/api.ts';
import type { DocumentContents } from '../src/shared/content.ts';
import type { RemoteDocument } from '../src/shared/remote.ts';
import { ContentsModel, type ContentsState, type ReadState } from '../src/renderer/src/viewmodels/contents.model.ts';

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

/**
 * A stand in for the main process, with the two things a test needs to steer: what `contents` answers,
 * and whether a read succeeds.
 */
function fakeApi(options: {
  contents?: DocumentContents | undefined;
  readFails?: string;
  onRead?: () => void;
} = {}) {
  let held = options.contents;
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
    readConfiguration: async (name) => {
      calls.push(`read:${name}`);
      options.onRead?.();
      if (options.readFails !== undefined) throw new Error(options.readFails);
      // A read is what puts contents behind a document that had none, which is the whole point of the
      // button, so the fake has to model that rather than just succeeding.
      held = contentsWith(4);
      return document(name);
    },
    fileDefinitions: async () => ({ added: [], kept: [] }),
  };
  return { api, calls };
}

function record(api: RemotesApi) {
  const seen: { contents: ContentsState; read: ReadState }[] = [];
  const model = new ContentsModel(api, (contents, read) => seen.push({ contents, read }));
  return { model, seen };
}

test('a document with a configuration goes looking and then ready', async () => {
  const { api } = fakeApi({ contents: contentsWith(3) });
  const { model, seen } = record(api);

  await model.load('living room');

  assert.deepEqual(seen.map((one) => one.contents.status), ['loading', 'ready']);
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

  assert.deepEqual(seen.map((one) => one.contents.status), ['loading', 'empty']);
});

test('a document that is gone says so instead of drawing nothing', async () => {
  // Deleted from Finder while the page was open, which is a real thing to do to a document application.
  const { api } = fakeApi();
  const { model } = record(api);

  await model.load('gone');

  assert.equal(model.contents.status, 'failed');
  assert.match(model.contents.status === 'failed' ? model.contents.error : '', /no remote called gone/);
});

test('reading a remote fills the document, in one pass through the states', async () => {
  const { api, calls } = fakeApi({ contents: undefined });
  const { model, seen } = record(api);

  await model.load('living room');
  assert.equal(model.contents.status, 'empty');

  await model.readFrom('living room', 0xc121);

  assert.equal(model.contents.status, 'ready');
  assert.equal(model.read.status, 'idle');
  // The order matters: reading, then not reading, then the reload that shows the result. A page that
  // dropped out of `reading` before the contents were back would flash an empty document.
  assert.deepEqual(seen.map((one) => one.read.status),
                   ['idle', 'idle', 'reading', 'idle', 'idle', 'idle']);
  assert.deepEqual(calls,
                   ['contents:living room', 'read:living room', 'contents:living room']);
});

test('a read that fails leaves the document alone and says what went wrong', async () => {
  // Nothing was attached, or the transfer did not check out. Either way the document still holds
  // whatever it held, and a page that blanked itself would be claiming otherwise.
  const { api } = fakeApi({
    contents: contentsWith(2),
    readFails: 'no config base known for product id 0xc999',
  });
  const { model } = record(api);

  await model.load('living room');
  await model.readFrom('living room', 0xc999);

  assert.equal(model.read.status, 'failed');
  assert.match(model.read.status === 'failed' ? model.read.error : '', /no config base known/);
  assert.equal(model.contents.status, 'ready', 'and what it already held is still there');
  assert.equal(model.contents.status === 'ready' ? model.contents.contents.content.devices.length : 0, 2);
});

test('pressing read twice does not claim the remote twice', async () => {
  // Two of these in flight are two attempts to open one irreplaceable device, and the second fails in
  // a way that says nothing about the first. A button that can be pressed twice is how it happens.
  let reads = 0;
  const { api } = fakeApi({ contents: undefined, onRead: () => { reads += 1; } });
  const { model } = record(api);

  const first = model.readFrom('living room', 0xc121);
  const second = model.readFrom('living room', 0xc121);
  await Promise.all([first, second]);

  assert.equal(reads, 1);
});

test('the appliances this machine has not got are carried through to the page', async () => {
  // The consequence of the library sitting outside the document, which the page turns into a sentence.
  const { api } = fakeApi({ contents: { ...contentsWith(2), missing: ['appliance-aaaa', 'appliance-bbbb'] } });
  const { model } = record(api);

  await model.load('living room');

  assert.deepEqual(model.contents.status === 'ready' ? model.contents.contents.missing : [],
                   ['appliance-aaaa', 'appliance-bbbb']);
});

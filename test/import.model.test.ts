/**
 * The view model behind importing, against a fake API.
 *
 * **These three tests moved here rather than being written here.** They were `contents.test.ts`'s, about
 * a single `readFrom` that opened a remote and filled a document in one act. On 22 August 2026 reading a
 * remote became an import with a person's decision in the middle of it, so the subject moved and the
 * tests moved with it: a read failing halfway, two presses of the button, and a read landing.
 *
 * What the split added is the case that could not exist before, and it is the one worth having: **the
 * half that writes refuses to run without the half that shows.** An import that could start from nothing
 * is an import with no confirmation in front of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { RemotesApi } from '../src/shared/api.ts';
import type { AttachedSummary, ImportOutcome } from '../src/shared/import.ts';
import type { RemoteDocument } from '../src/shared/remote.ts';
import {
  ImportModel, type CommitState, type InspectionState,
} from '../src/renderer/src/viewmodels/import.model.ts';

const AT = '2026-08-22T12:00:00.000Z';

function document(name: string): RemoteDocument {
  return { name, provenance: 'read-from-device', createdAt: AT, updatedAt: AT };
}

function summary(token: string): AttachedSummary {
  return {
    token,
    model: { name: 'Harmony One', skin: 54 },
    skin: 54,
    byteLength: 1_572_864,
    appliances: [
      { slot: 0, label: 'TV', commandCount: 47, definition: 'appliance-aaaa', disposition: 'new' },
      {
        slot: 1, label: 'Amp', commandCount: 31, definition: 'appliance-bbbb',
        disposition: 'linked', knownAs: 'A manufacturer AV-1',
      },
    ],
    activities: [{ slot: 0, name: 'Watch a film' }],
    buttonCount: 229,
    language: 'nl',
  };
}

const OUTCOME: ImportOutcome = {
  linked: ['appliance-bbbb'], created: ['appliance-aaaa'], replaced: false, moved: 3, unmatched: 0,
};

/**
 * A stand in for the main process. Both halves can be made to fail on their own, which is the point of
 * there being two of them.
 */
function fakeApi(options: {
  inspectFails?: string;
  importFails?: string;
  onInspect?: () => void;
  onImport?: () => void;
} = {}) {
  const calls: string[] = [];
  const api: RemotesApi = {
    list: async () => [],
    create: async (name) => document(name),
    rename: async (_name, to) => document(to),
    duplicate: async (name) => document(`${name} copy`),
    remove: async () => {},
    contents: async () => { throw new Error('the import model must not read a document'); },
    fileDefinitions: async () => { throw new Error('the import model must not file definitions'); },
    inspectAttached: async (productId, into) => {
      calls.push(`inspect:${productId.toString(16)}:${into ?? '-'}`);
      options.onInspect?.();
      if (options.inspectFails !== undefined) throw new Error(options.inspectFails);
      return summary('token-1');
    },
    importFrom: async (name, token) => {
      calls.push(`import:${name}:${token}`);
      options.onImport?.();
      if (options.importFails !== undefined) throw new Error(options.importFails);
      return OUTCOME;
    },
  };
  return { api, calls };
}

function record(api: RemotesApi) {
  const seen: { inspection: InspectionState; commit: CommitState }[] = [];
  const model = new ImportModel(api, (inspection, commit) => seen.push({ inspection, commit }));
  return { model, seen };
}

test('inspecting says what is on the remote and commits nothing', async () => {
  const { api, calls } = fakeApi();
  const { model, seen } = record(api);

  await model.inspect(0xc121, 'living room');

  assert.deepEqual(seen.map((one) => one.inspection.status), ['inspecting', 'ready']);
  // The half that writes has not moved at all, which is the whole shape of this flow.
  assert.deepEqual(seen.map((one) => one.commit.status), ['idle', 'idle']);
  assert.deepEqual(calls, ['inspect:c121:living room']);
  assert.equal(model.inspection.status === 'ready' ? model.inspection.summary.buttonCount : 0, 229);
});

test('confirming without a reading in hand does nothing at all', async () => {
  // The case the split created and the reason it is worth having. An import that can start from nothing
  // is an import with no confirmation in front of it, and no interface can put that back.
  const { api, calls } = fakeApi();
  const { model } = record(api);

  await model.confirm('living room');

  assert.deepEqual(calls, []);
  assert.equal(model.commit.status, 'idle');
});

test('confirming carries the token of the reading that was shown', async () => {
  // Not the document, not the product id: the token names the exact bytes somebody looked at. Anything
  // else would let a confirmation land on a different reading than the one that was on the screen.
  const { api, calls } = fakeApi();
  const { model } = record(api);

  await model.inspect(0xc121, 'living room');
  await model.confirm('living room');

  assert.deepEqual(calls, ['inspect:c121:living room', 'import:living room:token-1']);
  assert.equal(model.commit.status, 'done');
  assert.deepEqual(model.commit.status === 'done' ? model.commit.outcome : undefined, OUTCOME);
});

test('a reading that fails says what went wrong and leaves nothing behind', async () => {
  // Nothing attached, or the transfer did not check out. Either way no document was touched, because
  // this half touches none.
  const { api } = fakeApi({ inspectFails: 'no config base known for product id 0xc999' });
  const { model } = record(api);

  await model.inspect(0xc999, 'living room');

  assert.equal(model.inspection.status, 'failed');
  assert.match(model.inspection.status === 'failed' ? model.inspection.error : '',
               /no config base known/);
  assert.equal(model.commit.status, 'idle');
});

test('an import that fails keeps the reading, so it can be tried again without the remote', async () => {
  // The practical reason the two halves are separate states rather than one: the bytes are still held in
  // the main process, so a failure here does not cost another minute of somebody's hardware.
  const { api } = fakeApi({ importFails: 'that reading is no longer held' });
  const { model } = record(api);

  await model.inspect(0xc121, 'living room');
  await model.confirm('living room');

  assert.equal(model.commit.status, 'failed');
  assert.equal(model.inspection.status, 'ready', 'and what was read is still on the screen');
});

test('pressing read twice does not claim the remote twice', async () => {
  // Two of these in flight are two attempts to open one irreplaceable device, and the second fails in a
  // way that says nothing about the first. Moved here from the contents model with its reason intact.
  let reads = 0;
  const { api } = fakeApi({ onInspect: () => { reads += 1; } });
  const { model } = record(api);

  await Promise.all([model.inspect(0xc121, 'living room'), model.inspect(0xc121, 'living room')]);

  assert.equal(reads, 1);
});

test('pressing import twice does not import twice', async () => {
  // The same guard on the other half, and here the cost is different: a second import would replace the
  // document a second time and file its appliances again.
  let imports = 0;
  const { api } = fakeApi({ onImport: () => { imports += 1; } });
  const { model } = record(api);

  await model.inspect(0xc121, 'living room');
  await Promise.all([model.confirm('living room'), model.confirm('living room')]);

  assert.equal(imports, 1);
});

test('dismissing puts both halves away, which is what lets the bytes go', async () => {
  const { api } = fakeApi();
  const { model } = record(api);

  await model.inspect(0xc121, 'living room');
  model.dismiss();

  assert.equal(model.inspection.status, 'idle');
  assert.equal(model.commit.status, 'idle');
});

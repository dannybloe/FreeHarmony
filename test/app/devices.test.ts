/**
 * The USB half of the bridge, in a running window, which is the only place it can be checked.
 *
 * What is being proved here is not the answer, it is the **path**. `node-hid` is a native binding, and
 * a native binding built against Node's ABI does not load under Electron's. Nothing in a unit test can
 * see that: the view model talks to an interface, and a fake answers it happily. Only a real window,
 * asking the real main process, which really loads the real binding, can tell whether that works.
 *
 * The assertion is deliberately weak about content and strict about shape, because the content is
 * whatever happens to be on this machine's bus. What makes it a check rather than a description is that
 * `attachedRemotes` does **not** swallow a failure: a binding that will not load rejects, and the
 * rejection crosses the bridge as a thrown error. So an empty array is the bus being empty and nothing
 * else, which was not true of the first version of that function.
 *
 * It never opens a device. Everything here is enumeration, so it is as safe with a remote on the cable
 * as without one, and it says more when there is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { API_NAMESPACE } from '../../src/shared/api.ts';
import type { AttachedRemote } from '../../src/shared/devices.ts';
import { launch } from './electron.ts';

/** Everything a device may carry, so a key the main process invents is a failure and not a shrug. */
const ALLOWED_KEYS = ['productId', 'skin', 'model', 'product'];

test('the page can ask what is attached, and the native binding loads to answer it', async (t) => {
  const app = await launch();
  t.after(() => app.close());

  const attached = await app.evaluate<AttachedRemote[]>(
    `window['${API_NAMESPACE}'].devices.attached()`);

  assert.ok(Array.isArray(attached), `an array, and it answered: ${JSON.stringify(attached)}`);
  for (const device of attached) {
    assert.equal(typeof device.productId, 'number', 'a device always states its product id');
    for (const key of Object.keys(device)) {
      assert.ok(ALLOWED_KEYS.includes(key), `${key} is not part of what crosses the bridge`);
    }
    // A model, where there is one, is exactly what a document stores: a name and a skin. Anything
    // richer would mean the main process had built a shape the store cannot keep.
    if (device.model !== undefined) {
      assert.deepEqual(Object.keys(device.model).sort(), ['name', 'skin']);
      assert.equal(device.skin, device.model.skin, 'the two skins are the same fact twice');
    }
  }
});

test('asking twice is harmless, which is what lets the page poll', async (t) => {
  // The Connect screen asks once a second for as long as it is open. If enumeration held anything, or
  // claimed anything, doing it sixty times a minute would be a problem rather than a design.
  const app = await launch();
  t.after(() => app.close());

  const rounds = await app.evaluate<number[]>(`(async () => {
    const counts = [];
    for (let n = 0; n < 5; n += 1) {
      counts.push((await window['${API_NAMESPACE}'].devices.attached()).length);
    }
    return counts;
  })()`);

  assert.equal(rounds.length, 5);
  assert.equal(new Set(rounds).size, 1, `five rounds disagreed about the bus: ${rounds.join(', ')}`);
});

test('the empty answer is the bus being empty and not the binding failing to load', async (t) => {
  // The claim that makes the two tests above mean anything, and it is about a mechanism rather than a
  // value: nothing in `attachedRemotes` catches, so a `node-hid` that will not load under Electron's
  // ABI comes out of this call as a rejection and not as an empty list.
  //
  // The control was run rather than argued, on 21 August 2026: a throw placed at the top of
  // `attachedRemotes` fails all three tests in this file, and this one fails with the thrown message
  // reaching the page, `the bridge itself refused: ...`. So the path really does carry a failure, and
  // an empty array really is a statement about the bus.
  //
  // Pointing the import at a package that does not exist was tried first and controls nothing: the
  // build refuses, so the tests never run. Worth recording, because a control that cannot report is
  // indistinguishable from a control that passed.
  //
  // The binding itself was measured before any of this was written: `node-hid` loads under Electron 43
  // with no rebuild, seeing 37 HID devices on this machine.
  const app = await launch();
  t.after(() => app.close());

  const seen = await app.evaluate<{ ok: boolean; message?: string; devices?: number }>(
    `(async () => {
       try {
         const all = await window['${API_NAMESPACE}'].devices.attached();
         return { ok: true, devices: all.length };
       } catch (thrown) {
         return { ok: false, message: thrown.message };
       }
     })()`);

  assert.equal(seen.ok, true, `the bridge itself refused: ${seen.message}`);
  assert.equal(typeof seen.devices, 'number');
});

test('asking a remote what it is refuses when there is none, and opens nothing by accident', async (t) => {
  /**
   * The one method in this application that **opens a device**, tested the only way a routine run may.
   *
   * The shape is deliberate. With an empty bus this asserts something real: that the refusal comes from
   * `openHarmony` in the library and reaches the page word for word, so a page has something to show and
   * this repository is not carrying its own copy of the message. With a remote attached it **skips**,
   * because a test that runs `pnpm check` must not claim an irreplaceable remote on its way past, which
   * is the rule the sibling repository enforces with its own hardware flag.
   *
   * Skipping rather than passing, so the reason is on screen instead of implied by a green line.
   */
  const app = await launch();
  t.after(() => app.close());

  const attached = await app.evaluate<AttachedRemote[]>(
    `window['${API_NAMESPACE}'].devices.attached()`);
  if (attached.length > 0) {
    t.skip(`a remote is attached and this test will not open it: ${attached.length} on the bus`);
    return;
  }

  const refusal = await app.evaluate<{ error: string; message: string } | null>(
    `(async () => {
       try { await window['${API_NAMESPACE}'].devices.readHardware(0xc121); return null; }
       catch (thrown) { return { error: thrown.constructor.name, message: thrown.message }; }
     })()`);

  assert.deepEqual(refusal, { error: 'Error', message: 'no Harmony remote found on the USB bus' },
                   'the library refuses, and its words arrive in the page');
});

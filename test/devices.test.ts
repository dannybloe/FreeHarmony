/**
 * What is plugged in, driven with no Electron, no USB and no hardware.
 *
 * The four states of the Connect screen are the point. Three of them are awkward or impossible to
 * arrange on the bench: two remotes attached at once needs two remotes, a remote whose model nothing
 * names needs a model nobody here owns, and a bus that will not answer needs a fault. All three are one
 * line each below, which is the whole argument for a view model that owns no timer and talks to an
 * interface rather than to `node-hid`.
 *
 * Two guards are tested and both have teeth. `theRecognisedOne` decides whether the application moves
 * somebody on to a naming screen with a model already filled in, and getting it wrong puts the wrong
 * piece of hardware in their documents, where it looks settled. `advanceOn` decides whether it does that
 * **again**, which is a smaller mistake with a louder symptom: back from the naming page returns to the
 * Connect screen, and without the memory it advances straight forward, so the back arrow does nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { DevicesApi } from '../src/shared/api.ts';
import type { AttachedRemote } from '../src/shared/devices.ts';
import type { HardwareReading } from '../src/shared/devices.ts';
import {
  advanceOn,
  arrivalKey,
  DevicesModel,
  HardwareModel,
  NOTHING_YET,
  theRecognisedOne,
  UNREAD,
  type DevicesState,
  type HardwareState,
} from '../src/renderer/src/viewmodels/devices.model.ts';

const A_HARMONY_ONE: AttachedRemote = {
  productId: 0xc121, skin: 54, model: { name: 'Harmony One', skin: 54 }, product: 'Harmony',
};
const A_HARMONY_600: AttachedRemote = {
  productId: 0xc124, skin: 71, model: { name: 'Harmony 600', skin: 71 }, product: 'Harmony',
};
/** A remote the tables do not name. Real: three models are drawn and forty were retired. */
const SOMETHING_UNNAMED: AttachedRemote = { productId: 0xc133, skin: 40, product: 'Harmony' };

/** An API that answers from a list this test controls, and can be told to refuse the next call. */
function fakeApi(...rounds: AttachedRemote[][]) {
  let at = 0;
  let failWith: string | undefined;
  const calls: number[] = [];

  const api: DevicesApi = {
    // Refused rather than stubbed, because every test in this half is about **enumeration** and an
    // accidental call would be a test opening a device. `hardwareApi` below is the one that answers.
    readHardware: async () => {
      throw new Error('this fake does not open devices');
    },
    attached: async () => {
      calls.push(at);
      if (failWith !== undefined) {
        const message = failWith;
        failWith = undefined;
        throw new Error(message);
      }
      // The last round repeats, so a test can poll as often as it likes without describing every tick.
      const round = rounds[Math.min(at, rounds.length - 1)] ?? [];
      at += 1;
      return [...round];
    },
  };

  return { api, calls, fail: (message: string) => { failWith = message; } };
}

function record(api: DevicesApi) {
  const seen: DevicesState[] = [];
  const model = new DevicesModel(api, (state) => seen.push(state));
  return { model, seen };
}

test('before the first answer it is looking, which is not an error and not a failure', () => {
  const { api } = fakeApi();
  const { model } = record(api);
  assert.deepEqual(model.state, NOTHING_YET);
  assert.equal(model.state.status, 'looking');
});

test('an empty bus is an answer, so the screen can stop saying it is still starting up', async () => {
  const { api } = fakeApi([]);
  const { model, seen } = record(api);

  await model.poll();

  assert.deepEqual(seen.map((s) => s.status), ['answered']);
  assert.deepEqual(model.state.attached, []);
  assert.equal(theRecognisedOne(model.state), undefined);
});

test('one recognised remote is the one case that may carry somebody onwards', async () => {
  const { api } = fakeApi([A_HARMONY_ONE]);
  const { model } = record(api);

  await model.poll();

  assert.deepEqual(theRecognisedOne(model.state), A_HARMONY_ONE);
  assert.equal(theRecognisedOne(model.state)?.model?.name, 'Harmony One');
});

test('two remotes carry nobody anywhere, because nothing here knows which one was meant', async () => {
  // The guard that costs the most to get wrong. Both are recognised, so a rule of "is anything
  // recognised" would advance with whichever happened to be first, and name the other one's model.
  const { api } = fakeApi([A_HARMONY_ONE, A_HARMONY_600]);
  const { model } = record(api);

  await model.poll();

  assert.equal(model.state.attached.length, 2);
  assert.equal(theRecognisedOne(model.state), undefined, 'and it is undefined even though both are named');
});

test('a remote whose model nothing names carries nobody onwards either', async () => {
  // The ordinary case rather than the exception. It is attached, it is a Harmony, and the honest thing
  // is to say so and offer the chooser: a naming screen with no model on it would have nothing to fill in.
  const { api } = fakeApi([SOMETHING_UNNAMED]);
  const { model } = record(api);

  await model.poll();

  assert.equal(model.state.attached.length, 1);
  assert.equal(theRecognisedOne(model.state), undefined);
});

test('a bus that will not answer says so, and does not pretend nothing is attached', async () => {
  const { api, fail } = fakeApi([A_HARMONY_ONE]);
  const { model } = record(api);

  fail('the USB layer would not load');
  await model.poll();

  assert.equal(model.state.status, 'failed');
  assert.equal(model.state.error, 'the USB layer would not load');
  assert.deepEqual(model.state.attached, [], 'and it does not keep a stale list beside a failure');
});

test('an unchanged answer is not announced, because this runs on a timer', async () => {
  // Not an optimisation. The screen redraws from every state it is told about, and this is polled once
  // a second, so emitting an identical state every second would restart the animation on the page
  // every second. Two polls of an unchanged bus, one emission.
  const { api } = fakeApi([A_HARMONY_ONE]);
  const { model, seen } = record(api);

  await model.poll();
  await model.poll();
  await model.poll();

  assert.equal(seen.length, 1, 'three rounds, one emission');
});

test('a change is announced, which is the control on the test above', async () => {
  // Without this, "emits nothing" and "emits nothing when it should" are the same passing test.
  const { api } = fakeApi([], [A_HARMONY_ONE], [A_HARMONY_ONE], []);
  const { model, seen } = record(api);

  await model.poll();
  await model.poll();
  await model.poll();
  await model.poll();

  assert.deepEqual(seen.map((s) => s.attached.length), [0, 1, 0], 'plugged in, then out');
});

test('a failure and then an answer recovers, so a moment of trouble does not end the wait', async () => {
  const { api, fail } = fakeApi([A_HARMONY_ONE]);
  const { model } = record(api);

  fail('a passing fault');
  await model.poll();
  await model.poll();

  assert.equal(model.state.status, 'answered');
  assert.deepEqual(theRecognisedOne(model.state), A_HARMONY_ONE);
});

test('a recognised remote advances once, and standing still does not advance again', () => {
  // The bug this rule exists for, as an assertion. Without the memory, back from the naming page lands
  // on Connect with the remote still plugged in, `advanceOn` says go, and back becomes a button that
  // does nothing. Two calls, one advance.
  const answered: DevicesState = { status: 'answered', attached: [A_HARMONY_ONE] };

  const first = advanceOn(answered, undefined);
  assert.deepEqual(first.model, A_HARMONY_ONE.model, 'the first arrival carries somebody onwards');
  assert.equal(typeof first.remember, 'string');

  const again = advanceOn(answered, first.remember);
  assert.equal(again.model, undefined, 'and the same remote sitting there does not, however often we ask');
  assert.equal(again.remember, first.remember, 'while the memory is kept, so it stays not advancing');
});

test('unplugging forgets, so plugging the same remote back in works', () => {
  // The other half, and the half that makes the rule usable rather than a one shot. Somebody who plugs
  // in the wrong remote, goes back, unplugs it and plugs in the right one has to be carried onwards
  // again, and after unplugging the right one too.
  const answered: DevicesState = { status: 'answered', attached: [A_HARMONY_ONE] };
  const empty: DevicesState = { status: 'answered', attached: [] };

  const first = advanceOn(answered, undefined);
  const unplugged = advanceOn(empty, first.remember);
  assert.equal(unplugged.model, undefined, 'nothing to advance to with an empty bus');
  assert.equal(unplugged.remember, undefined, 'and the memory is cleared, which is what re-arms it');

  assert.deepEqual(advanceOn(answered, unplugged.remember).model, A_HARMONY_ONE.model);
});

test('a second remote appearing clears the memory rather than leaving a stale one', () => {
  // A change of situation, so the rule should not carry an answer about the old one across it. The
  // assertion that matters is the second: after the second remote goes away, the first is a new arrival.
  const one: DevicesState = { status: 'answered', attached: [A_HARMONY_ONE] };
  const both: DevicesState = { status: 'answered', attached: [A_HARMONY_ONE, A_HARMONY_600] };

  const first = advanceOn(one, undefined);
  const crowded = advanceOn(both, first.remember);
  assert.equal(crowded.model, undefined, 'two attached carries nobody anywhere');
  assert.equal(crowded.remember, undefined);

  assert.deepEqual(advanceOn(one, crowded.remember).model, A_HARMONY_ONE.model);
});

test('two different remotes are two different arrivals, and one is not the other', () => {
  // Without this, the key could be a constant and every test above would still pass: one advance, then
  // never again, is exactly what a constant key produces.
  assert.notEqual(arrivalKey(A_HARMONY_ONE), arrivalKey(A_HARMONY_600));
  assert.equal(arrivalKey(A_HARMONY_ONE), arrivalKey({ ...A_HARMONY_ONE }),
               'and the same remote read twice is the same arrival');
});

test('a remote whose model nothing names never advances, however long it sits there', () => {
  const unnamed: DevicesState = { status: 'answered', attached: [SOMETHING_UNNAMED] };
  const answer = advanceOn(unnamed, undefined);
  assert.equal(answer.model, undefined);
  assert.equal(answer.remember, undefined, 'nothing was acted on, so there is nothing to remember');
});

/** A Harmony One's real answer, from `docs/usb-protocol.md`, so the shape here is a measured one. */
const A_REAL_READING: HardwareReading = {
  readAt: '2026-08-21T12:00:00.000Z',
  firmware: '3.4', hardware: '0.5', flash: '1F:C8',
  architecture: 12, skin: 54, softwareType: 0, softwareTypeName: 'application', platform: 12,
  versionBlock: '3405c81fc0360c3434163434',
};

/** An API whose one interesting method opens a device, or refuses to, on command. */
function hardwareApi(answer: HardwareReading | Error) {
  const asked: number[] = [];
  const api: DevicesApi = {
    attached: async () => [],
    readHardware: async (productId) => {
      asked.push(productId);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return { api, asked };
}

function recordHardware(api: DevicesApi) {
  const seen: HardwareState[] = [];
  const model = new HardwareModel(api, (state) => seen.push(state));
  return { model, seen };
}

test('nothing is read until somebody asks, which is the point of a separate model', () => {
  // Constructing it opens nothing and asks nothing. That is worth an assertion because the alternative,
  // reading on construction, is what a hook would do by accident and it would claim a device on
  // navigation.
  const { api, asked } = hardwareApi(A_REAL_READING);
  const { model, seen } = recordHardware(api);

  assert.deepEqual(model.state, UNREAD);
  assert.deepEqual(asked, [], 'no device was opened');
  assert.deepEqual(seen, [], 'and nothing was announced');
});

test('a read goes reading and then read, in that order, and keeps the answer', async () => {
  const { api, asked } = hardwareApi(A_REAL_READING);
  const { model, seen } = recordHardware(api);

  await model.read(0xc121);

  assert.deepEqual(seen.map((s) => s.status), ['reading', 'read']);
  assert.deepEqual(asked, [0xc121], 'and it asked the remote it was told to');
  assert.deepEqual(model.state.reading, A_REAL_READING);
});

test('a refusal is kept in the library own words rather than replaced with ours', async () => {
  // The messages worth showing come from `openHarmony`: no remote found, or a selector matching more
  // than one. Restating them here would be a second copy of a rule that lives next door.
  const { api } = hardwareApi(new Error('no Harmony remote found on the USB bus'));
  const { model } = recordHardware(api);

  await model.read(0xc121);

  assert.equal(model.state.status, 'failed');
  assert.equal(model.state.error, 'no Harmony remote found on the USB bus');
  assert.equal(model.state.reading, undefined, 'and nothing is left claiming to be a reading');
});

test('a second read while one is in flight is refused, because it would claim the same device twice', async () => {
  /**
   * The guard with hardware behind it. A button can be pressed twice, and two opens of one irreplaceable
   * remote is not a race worth having: the second fails in a way that says nothing about the first.
   *
   * **The mechanism is that `reading` is set synchronously, before the first await**, so the second call
   * sees it and returns. The assertion in the middle is that mechanism rather than a formality, and it is
   * what a first version of this test papered over with a promise it never awaited.
   */
  const { api, asked } = hardwareApi(A_REAL_READING);
  const { model } = recordHardware(api);

  const first = model.read(0xc121);
  assert.equal(model.state.status, 'reading', 'armed before the first await, which is what makes it work');
  const second = model.read(0xc121);
  await Promise.all([first, second]);

  assert.deepEqual(asked, [0xc121], 'one open, not two');
  assert.equal(model.state.status, 'read');
});

test('a failed read can be tried again, so one bad cable is not the end of it', async () => {
  const { api, asked } = hardwareApi(new Error('no Harmony remote found on the USB bus'));
  const { model } = recordHardware(api);

  await model.read(0xc121);
  await model.read(0xc121);

  assert.deepEqual(asked, [0xc121, 0xc121], 'the guard is about being in flight, not about having failed');
});

test('the model to advance on carries which remote it was, so the read can be offered', () => {
  // Without the product id the naming page cannot offer to ask anything, because opening a device needs
  // a selector. It travels with the model rather than being looked up again, which would be a second
  // answer to a question already settled.
  const answered: DevicesState = { status: 'answered', attached: [A_HARMONY_ONE] };
  const next = advanceOn(answered, undefined);

  assert.equal(next.productId, A_HARMONY_ONE.productId);
  assert.deepEqual(next.model, A_HARMONY_ONE.model);
});

test('nothing to advance on carries no product id either, so nothing can be opened from it', () => {
  const empty: DevicesState = { status: 'answered', attached: [] };
  const crowded: DevicesState = { status: 'answered', attached: [A_HARMONY_ONE, A_HARMONY_600] };

  assert.equal(advanceOn(empty, undefined).productId, undefined);
  assert.equal(advanceOn(crowded, undefined).productId, undefined,
               'and two attached is the case that matters, since a product id would name a model');
});

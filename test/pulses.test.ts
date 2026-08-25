/**
 * Phase 4's check, from the sibling repository's `docs/adding-a-device.md`: a definition built from a
 * catalogue reply, round tripped through the store, produces the same pulses on the way out as it did
 * on the way in, and a definition with no family and no pulses is refused rather than written as a
 * device that sends nothing.
 *
 * The pulses here are **derived**, which is the store or derive decision this test pins: nothing below
 * stores a duration, so the equality is between two derivations either side of a disk write, and it can
 * only hold if the stated code survived the store byte for byte. The refusal is the other half of the
 * same decision: `pulsesOf` answering `undefined` is what a composer has to treat as "do not write this
 * command", because the alternative is a device on a remote whose buttons do nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { asDefinition } from '../src/main/logitech/convert.ts';
import { pulsesOf } from '../src/main/frames.ts';
import { DeviceLibrary } from '../src/main/store/library.ts';

/** The catalogue shapes are copied from real replies, like every recorded shape in `logitech.test.ts`. */
const REPLY = [
  { name: 'PowerToggle', protocol: 'Sony 12 Bit', bits: 12,
    stated: 'G:Sony 12 Bit:()(0x915)():3', frames: ['915'], frame: '915' },
  // Toshiba names its second frame with a word, so no single `frame` exists, and deriving from the
  // stated code is the only way this command can ever be sent. It is in the round trip for that reason.
  { name: 'ChannelUp', protocol: 'Toshiba 32 Bit', bits: 32,
    stated: 'G:Toshiba 32 Bit:(0x20DF10EF)(Repeat)():3', frames: ['20df10ef'], words: ['Repeat'] },
] as const;

test('a catalogue definition derives the same pulses before and after the store', async () => {
  const made = asDefinition(
    { manufacturer: 'LG', model: '42LM3400', kind: 'television', commandsId: 1 },
    REPLY, '2026-08-25T12:00:00.000Z');
  const before = made.commands.map((one) => pulsesOf(one.signal));
  // The derivation works at all, which the equality below cannot show on its own: two `undefined`s are
  // equal too, and would mean the round trip preserved nothing.
  assert.equal(before.length, 2);
  for (const block of before) {
    assert.ok(block !== undefined && block.length > 0, 'each catalogue command derives a block');
  }
  // The held block derives too, per family; whether a given command uses one is the composer's call.
  assert.ok(pulsesOf(made.commands[1]!.signal, 'held') !== undefined,
            "Toshiba's repeat block derives");

  const root = await mkdtemp(join(tmpdir(), 'freeharmony-pulses-'));
  try {
    const library = new DeviceLibrary({ root });
    await library.put(made);
    const back = await library.get(made.id);
    const after = back.commands.map((one) => pulsesOf(one.signal));
    assert.deepEqual(after, before, 'the derived pulses are identical either side of the disk');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a signal with no stated code and no pulses is refused, not sent as nothing', () => {
  // A frame value alone is a claim about a number, not about a rhythm: without the family's stated code
  // there is nothing to derive from, and a stored block is absent by construction here.
  assert.equal(pulsesOf({ protocol: 'Sony 12 Bit', bits: 12, frame: '915' }), undefined);
  assert.equal(pulsesOf({}), undefined);
  // A family the rhythm table cannot emit refuses too, even with the code whole: `Saitek 11 Bit` is the
  // catalogue's one placeholder family, a single all zero command on an appliance with no receiver.
  assert.equal(pulsesOf({ stated: 'G:Saitek 11 Bit:()(0x000)():3' }), undefined);
});

test('a measured block outranks a derived one', () => {
  // A learned code has pulses and no notation; a definition may hold both, and then the measurement
  // wins, because the table is a generalisation and the measurement is this appliance's own.
  const measured = [{ mark: true, us: 1000 }, { mark: false, us: 500 }];
  const both = { stated: 'G:Sony 12 Bit:()(0x915)():3', once: measured };
  assert.deepEqual(pulsesOf(both), measured);
});

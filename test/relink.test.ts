/**
 * Pointing a device position at another description of the same appliance, without changing what any
 * button sends.
 *
 * **The test that carries the most weight in this round**, because the failure it guards is invisible:
 * relink wrongly and every button still works and starts sending different codes. Nothing throws, no
 * count moves, and the document reads as correct.
 *
 * So every test here has a control. It is not enough to show that relinking preserves what a button
 * sends; the same fixture has to show that **not** relinking breaks it, or the test would pass against a
 * function that does nothing at all. That was a real hazard here: the first version of the corpus test
 * below passed with the mapping replaced by an identity, because the sample it happened to pick had its
 * commands in the same order in both configurations.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { require_, skipUnless } from '@harmony/lab';

import { importConfiguration } from '../src/main/import.ts';
import type { RemoteContent } from '../src/shared/content.ts';
import type { DeviceCommand, InfraredSignal } from '../src/shared/library.ts';
import { fingerprintOf, signatureOf } from '../src/shared/library.ts';
import { matchBySignal, relinkAppliance } from '../src/shared/relink.ts';

/** A signal that is distinguishable from every other by one number, which is all these tests need. */
function signal(us: number): InfraredSignal {
  return { carrierHz: 38_000, once: [{ mark: true, us }], held: [], tail: [] };
}

function commands(order: readonly number[]): DeviceCommand[] {
  return order.map((us, slot) => ({ slot, signal: signal(us), origin: 'from-a-configuration' }));
}

/** What every button and every activity handler actually sends, as codes rather than as numbers. */
function whatItSends(content: RemoteContent, slot: number, of: readonly DeviceCommand[]): string[] {
  const code = (command: number): string => {
    const found = of[command];
    return found === undefined ? `#${command} does not exist` : signatureOf(found.signal);
  };
  const steps = [
    ...content.buttons.flatMap((one) => one.sends),
    ...content.activities.flatMap((one) => [...one.onStart, ...one.onStop]),
  ];
  return steps.filter((one) => one.device === slot).map((one) => code(one.command));
}

test('a reference follows its code when the new description orders its commands differently', () => {
  const from = commands([100, 200, 300]);
  const to = commands([300, 100, 200]);
  const content: RemoteContent = {
    devices: [{ slot: 0 }],
    activities: [{ slot: 0, roles: [], onStart: [{ device: 0, command: 2 }], onStop: [], wants: [], sequences: [], devices: [0] }],
    buttons: [{ surface: 'keypad', sends: [{ device: 0, command: 0 }, { device: 0, command: 1 }] }],
    filledFrom: 'a-configuration',
  };

  const before = whatItSends(content, 0, from);
  const { content: after, moved, unmatched } = relinkAppliance(content, 0, matchBySignal(from, to));

  assert.deepEqual(whatItSends(after, 0, to), before, 'the same three codes, in the same order');
  assert.equal(unmatched, 0);
  assert.equal(moved, 3, 'all three moved, because every position changed');

  // The control. Without the rewrite the same document against the new description sends something else
  // entirely, which is the failure this whole file exists for.
  assert.notDeepEqual(whatItSends(content, 0, to), before);
});

test('a reference to a code the new description has not got is left alone and counted', () => {
  // Never dropped. A button that quietly sends nothing is worse than one that still means what it did,
  // and the caller is the only thing that can decide which. The import refuses to link on a count above
  // zero; hanging a position onto a different appliance by hand has not been designed yet.
  const from = commands([100, 200]);
  const to = commands([100]);
  const content: RemoteContent = {
    devices: [{ slot: 0 }],
    activities: [],
    buttons: [{ surface: 'keypad', sends: [{ device: 0, command: 1 }] }],
    filledFrom: 'a-configuration',
  };

  const { content: after, unmatched, moved } = relinkAppliance(content, 0, matchBySignal(from, to));

  assert.equal(unmatched, 1);
  assert.equal(moved, 0);
  assert.deepEqual(after.buttons[0]?.sends, [{ device: 0, command: 1 }]);
});

test('other device positions are not touched', () => {
  // The mapping belongs to one position. A relink that walked every step would repoint appliances it was
  // never asked about, and their numbering has nothing to do with this one's.
  const from = commands([100, 200]);
  const to = commands([200, 100]);
  const content: RemoteContent = {
    devices: [{ slot: 0 }, { slot: 1 }],
    activities: [],
    buttons: [{ surface: 'keypad', sends: [{ device: 1, command: 0 }, { device: 0, command: 0 }] }],
    filledFrom: 'a-configuration',
  };

  const { content: after, moved } = relinkAppliance(content, 0, matchBySignal(from, to));

  assert.equal(moved, 1);
  assert.deepEqual(after.buttons[0]?.sends, [{ device: 1, command: 0 }, { device: 0, command: 1 }]);
});

test('one code held twice resolves to the first of them, deterministically', () => {
  // Not a theoretical tie break: 229 of the 3925 commands in the corpus next door send exactly what an
  // earlier command of the same appliance sends. Safe because the appliance cannot tell them apart, and
  // pinned because "whichever" is not a specification.
  const from = commands([100, 200]);
  const to = commands([200, 100, 100]);

  assert.deepEqual(matchBySignal(from, to), [1, 0]);
});

test('only three lists in the model hold a command number, so the rewrite is exhaustive', () => {
  // A claim about the shape of the model rather than about its values, checked statically because it
  // cannot be checked at runtime: a fourth list of `Step` added to `content.ts` would make `relink.ts`
  // silently partial, and partial is the failure mode this whole file is about.
  const here = dirname(fileURLToPath(import.meta.url));
  const model = readFileSync(join(here, '..', 'src', 'shared', 'content.ts'), 'utf8');
  const holders = [...model.matchAll(/readonly (\w+): readonly Step\[\]/g)].map((one) => one[1]);

  assert.deepEqual(holders.sort(), ['onStart', 'onStop', 'sends']);
});

test('the same appliance from two of Logitech\'s own configurations, relinked', { ...skipUnless('arch8_config_a', 'arch8_config_b') }, () => {
  // The real case, and the reason this is not a precaution. Of the twelve appliances that appear in more
  // than one configuration in the corpus, three are described with their commands in a different order,
  // and these are two configurations of one remote from Logitech's own generator ten minutes apart.
  const project = (name: string) =>
    importConfiguration(require_(name), { idPrefix: name, now: '2026-08-22T00:00:00.000Z' });
  const a = project('arch8_config_a');
  const b = project('arch8_config_b');

  // The shared appliance whose order differs: same codes, so the same identity, and a different sequence.
  const pairs = a.content.devices.flatMap((use) => {
    const mine = a.definitions.find((one) => one.id === use.definition);
    if (mine === undefined) return [];
    const theirs = b.definitions.find((one) => fingerprintOf(one.commands) === fingerprintOf(mine.commands));
    if (theirs === undefined) return [];
    const order = (of: readonly DeviceCommand[]) => of.map((one) => signatureOf(one.signal)).join('|');
    return order(mine.commands) === order(theirs.commands) ? [] : [{ use, mine, theirs }];
  });
  assert.ok(pairs.length > 0, 'these two configurations are supposed to disagree about an order');

  for (const { use, mine, theirs } of pairs) {
    const before = whatItSends(a.content, use.slot, mine.commands);
    assert.ok(before.length > 0, `position ${use.slot} is referred to by something`);

    const { content: after, unmatched } = relinkAppliance(
      a.content, use.slot, matchBySignal(mine.commands, theirs.commands));

    assert.equal(unmatched, 0, 'the two descriptions hold the same codes, so nothing can fail to match');
    assert.deepEqual(whatItSends(after, use.slot, theirs.commands), before,
                     `position ${use.slot} still sends exactly what it sent`);
    // The control, on real bytes: leaving the numbers alone against the other description changes them.
    assert.notDeepEqual(whatItSends(a.content, use.slot, theirs.commands), before,
                        'if this passes, the sample no longer disagrees and the test above proves nothing');
  }
});

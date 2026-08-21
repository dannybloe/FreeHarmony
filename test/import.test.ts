/**
 * The projection from a configuration into the model, against real configurations.
 *
 * **It needs a lab and skips cleanly without one**, using the sibling's own locator rather than a
 * second copy of it: this repository may never hold a configuration, so the test either runs against
 * somebody's own remote or does not run at all. `skipUnless` is what says which, up front, because a
 * skip raised inside a loop lets the loop finish and a corpus wide total afterwards is asserted against
 * nothing.
 *
 * Four configurations, three architectures, on purpose. Two of one remote prove much less than two
 * architectures, and the arch 9 one is where the corpus stops agreeing with itself: it packs into four
 * action list runs where every other packs into five.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { require_, skipUnless } from '@harmony/lab';

import { importConfiguration } from '../src/main/import.ts';
import { mayBeShared } from '../src/shared/library.ts';

/**
 * One per architecture we hold, with what each has to produce.
 *
 * **Per sample and exact**, rather than one total over the loop. A total hides which side moved, and it
 * hides a sample dropping out of the loop entirely; these four rows move only when a reader changes or
 * a sample is added, and then they move in a diff somebody reads. `steps` is bindings plus macros, so
 * it exceeds `buttons` wherever a button sends more than one code.
 */
const SAMPLES = [
  { name: 'one_config', devices: 5, activities: 8, buttons: 461, steps: 461 },
  { name: 'h600_config', devices: 4, activities: 3, buttons: 229, steps: 241 },
  { name: 'h525_config', devices: 4, activities: 3, buttons: 220, steps: 220 },
  { name: 'arch8_config_a', devices: 3, activities: 1, buttons: 210, steps: 210 },
] as const;

const NAMES = SAMPLES.map((one) => one.name);

const NOW = '2026-08-21T12:00:00.000Z';

test('every configuration fills the model, and what it cannot say it leaves absent',
     skipUnless(...NAMES), () => {
  for (const { name, devices, activities, buttons, steps } of SAMPLES) {
    const imported = importConfiguration(require_(name), { now: NOW, idPrefix: name });
    const { content, definitions } = imported;

    assert.equal(content.devices.length, devices, `${name}: devices`);
    assert.equal(content.activities.length, activities, `${name}: activities`);
    assert.equal(content.buttons.length, buttons, `${name}: bindings that send something`);
    assert.equal(content.buttons.reduce((n, one) => n + one.sends.length, 0), steps, `${name}: steps`);
    // A provisional definition per device, which is the import's own promise: a device the remote
    // drives is an appliance the library has to have something to say about, even if that something is
    // only its codes.
    assert.equal(definitions.length, devices, `${name}: a definition per device`);
    assert.equal(content.filledFrom, 'a-configuration');

    for (const definition of definitions) {
      // The three claims that make an imported definition honest. It says where it came from, it may
      // not be shared, and it does not pretend to know which appliance it is.
      assert.equal(definition.origin, 'from-a-configuration');
      assert.equal(mayBeShared(definition.origin), false);
      assert.equal(definition.manufacturer, undefined, `${name}: a configuration names no manufacturer`);
      assert.equal(definition.model, undefined);
      for (const command of definition.commands) {
        assert.equal(command.name, undefined, `${name}: an infrared record carries no name`);
        // What it does carry: something to send. A command with no pulses at all would be a reader
        // returning nothing, which is the failure this loop is here to catch.
        const pulses = [command.signal.once, command.signal.held, command.signal.tail]
          .filter((block) => block !== undefined);
        assert.ok(pulses.length > 0, `${name}: command ${command.slot} sends nothing`);
      }
    }

    for (const activity of content.activities) {
      // Empty rather than guessed, and for two different reasons that the model itself distinguishes:
      // a kind and a role were discarded by the compiler, where the enter and leave handlers are in the
      // file and waiting on a reading. Asserting the emptiness is what stops somebody filling either
      // one from a guess and calling it progress.
      assert.equal(activity.kind, undefined, `${name}: what an activity was for is not in the file`);
      assert.deepEqual(activity.roles, []);
      assert.deepEqual(activity.onStart, [], `${name}: which tag is the enter handler is unread`);
      assert.deepEqual(activity.onStop, []);
      // What it does have: the devices it drives, all of which exist.
      for (const device of activity.devices) {
        assert.ok(device < content.devices.length, `${name}: an activity drives a device that exists`);
      }
    }

    for (const button of content.buttons) {
      assert.ok(button.sends.length > 0, `${name}: a binding in the map sends something`);
      // The two surfaces are what the format keeps strictly apart, so a binding is on one of them and
      // is placed in exactly one context. A binding nobody can place is a binding nobody can show.
      assert.equal(
        (button.inActivity === undefined) !== (button.inDeviceMode === undefined),
        true,
        `${name}: a binding sits in exactly one context`,
      );
    }
  }
});

test('a step never names a command the device has not got', skipUnless(...NAMES), () => {
  // The check that would have caught the failure mode section 117 demonstrates from the other side: a
  // configuration whose every infrared command addressed the wrong place still parsed, rendered and
  // closed its counts. Here the two ends come from different readers, the group array and the action
  // lists, so a disagreement is real rather than arithmetic.
  let steps = 0;
  for (const { name } of SAMPLES) {
    const { content, definitions } = importConfiguration(require_(name), { now: NOW, idPrefix: name });
    // The slots a definition actually offers, not how many it has. **The first version counted**, and
    // the control walked straight through it: shifting every command's slot by one leaves the count
    // identical, so the test passed while every step in every document pointed at the wrong code. That
    // is the failure the sibling repository records twice, a claim asserted against a number that
    // cannot move, and it is worth the extra line to make the two ends independent.
    const offered = new Map(definitions.map((one, slot) =>
      [slot, new Set(one.commands.map((command) => command.slot))]));
    for (const list of [...content.activities.map((a) => a.onStart),
                        ...content.buttons.map((b) => b.sends)]) {
      for (const step of list) {
        const commands = offered.get(step.device);
        assert.ok(commands !== undefined,
                  `${name}: step names device ${step.device}, which has no definition`);
        assert.ok(commands.has(step.command),
                  `${name}: step names command ${step.command}, which device ${step.device} has not got`);
        steps += 1;
      }
    }
  }
  // Exact, so that a reader falling silent shows up as a number rather than as a loop that ran zero
  // times and passed. The per sample figures are in `SAMPLES` and this is their sum.
  assert.equal(steps, SAMPLES.reduce((n, one) => n + one.steps, 0));
});

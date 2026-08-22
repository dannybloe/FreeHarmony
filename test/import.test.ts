/**
 * The projection from a configuration into the model, against real configurations.
 *
 * **It needs a lab and skips cleanly without one**, using the sibling's own locator rather than a
 * second copy of it: this repository may never hold a configuration, so the test either runs against
 * somebody's own remote or does not run at all. `skipUnless` is what says which, up front, because a
 * skip raised inside a loop lets the loop finish and a corpus wide total afterwards is asserted against
 * nothing.
 *
 * Five configurations, three architectures, on purpose. Two of one remote prove much less than two
 * architectures, and the arch 9 ones are where the corpus stops agreeing with itself: one packs into
 * four action list runs where every other packs into five, and the other is the only configuration
 * here that is not in English.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse, payloadOf } from '@harmony/codec';
import { require_, skipUnless } from '@harmony/lab';

import { importConfiguration, propertiesOf } from '../src/main/import.ts';
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
  { name: 'one_config', devices: 5, activities: 8, buttons: 461, steps: 461,
    properties: 9, transitions: 41, language: 'en' },
  { name: 'h600_config', devices: 4, activities: 3, buttons: 229, steps: 241,
    properties: 7, transitions: 17, language: 'en' },
  { name: 'h525_config', devices: 4, activities: 3, buttons: 220, steps: 220,
    properties: 6, transitions: 16, language: 'en' },
  { name: 'arch8_config_a', devices: 3, activities: 1, buttons: 210, steps: 210,
    properties: 5, transitions: 15, language: 'en' },
  // **The fifth row exists for one field.** Twelve of the thirteen configurations in the corpus are in
  // English, so a language assertion over the four above would pass on a reader that answered `en`
  // unconditionally. This one is Dutch, and it is the only sample here that can fail that claim.
  { name: 'h525_config_2', devices: 1, activities: 1, buttons: 102, steps: 102,
    properties: 2, transitions: 22, language: 'nl' },
] as const;

const NAMES = SAMPLES.map((one) => one.name);

const NOW = '2026-08-21T12:00:00.000Z';

test('every configuration fills the model, and what it cannot say it leaves absent',
     skipUnless(...NAMES), () => {
  for (const { name, devices, activities, buttons, steps, language } of SAMPLES) {
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
    // **The language, which no field in the file states.** It is inferred from Logitech's own menu and
    // Help wording, so the claim that carries weight is the Dutch sample: twelve of the thirteen
    // configurations in the corpus are English, and a reader that answered `en` unconditionally would
    // pass every other row here.
    assert.equal(content.language, language, `${name}: language`);

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

test('every appliance gets its state machine, and its transitions send its own codes',
     skipUnless(...NAMES), () => {
  // The part of a Harmony that makes switching activity feel clever: it knows what state it believes
  // each appliance is in and sends only the difference. That table is per appliance in the file, and
  // this is the check that it comes across whole.
  for (const { name, properties, transitions } of SAMPLES) {
    const imported = importConfiguration(require_(name), { now: NOW, idPrefix: name });
    const found = imported.definitions.flatMap((one) => one.properties);
    assert.equal(found.length, properties, `${name}: properties`);
    assert.equal(found.reduce((n, one) => n + one.transitions.length, 0), transitions,
                 `${name}: transitions`);
    for (const property of found) {
      // A property with one value cannot be switched and is still a property: the corpus has several,
      // which is how an appliance the remote only ever turns on shows up. What is refused is zero.
      assert.ok(property.values >= 1, `${name}: ${property.name} has no values`);
      for (const transition of property.transitions) {
        assert.ok(transition.sends.length > 0, `${name}: a transition that sends nothing`);
        assert.ok(transition.to <= property.values - 1 || transition.to < 0,
                  `${name}: ${property.name} moves to ${transition.to} of ${property.values}`);
      }
    }
  }
});

test('no transition sends another appliance\'s code, which is what pins the pairing',
     skipUnless(...NAMES), () => {
  // Two unrelated readings agreeing. Which appliance a property belongs to comes from the names in the
  // file; which codes a transition sends comes from the action lists. A single crossing would mean one
  // of the two is wrong, so the count is asserted at zero rather than mentioned in a comment.
  let crossings = 0;
  for (const { name } of SAMPLES) {
    const { foreign } = propertiesOf(parse(payloadOf(require_(name), name)));
    crossings += foreign;
  }
  assert.equal(crossings, 0);
});

test('a keypad key names the activity it belongs to, and never the configuration\'s own set number',
     skipUnless(...NAMES), () => {
  // **The correction of 22 August 2026, with the control that would have caught it.** A keypad key belongs
  // to a binding set, and the import wrote that set's number into `inActivity`, whose own docstring says it
  // holds the activity by position. Those are two different numbering spaces: on one Harmony One the
  // activities are 0 to 6 and 8 while the sets holding their keys are 7 to 15, so all 220 of that
  // configuration's keypad bindings named an activity that either does not exist or is a different one, and
  // nothing failed, because the numbers were plausible and no test asked what one meant.
  //
  // The closure is that the two facts come from **different fields of the configuration**. An activity's
  // own device list is read from its binding set's groups, and what a key sends is a `0x7D` operand inside
  // an action list, so agreement between them is not arithmetic on one number.
  let agree = 0;
  let activities = 0;
  for (const { name } of SAMPLES) {
    const { content } = importConfiguration(require_(name), { now: NOW, idPrefix: name });
    const keypad = content.buttons.filter((one) => one.surface === 'keypad');
    // Every one of them, on every architecture: a physical key on a real remote is always inside an
    // activity. Which is also why the device page cannot show a key's command without naming one.
    assert.deepEqual(keypad.filter((one) => one.inActivity === undefined), [],
                     `${name}: a keypad key with no activity`);
    for (const activity of content.activities) {
      activities += 1;
      const here = keypad.filter((one) => one.inActivity === activity.slot);
      const sent = [...new Set(here.flatMap((one) => one.sends.map((step) => step.device)))];
      if (here.length > 0 && sent.every((device) => activity.devices.includes(device))) agree += 1;
    }
  }
  // Exact on both counts, and the population is the five samples above, so this moves only when a reader
  // changes or a sample is added.
  assert.equal(activities, 16);
  assert.equal(agree, 16, 'every activity\'s keys send only to devices the activity itself lists');
});

test('shifting the activity a key belongs to breaks that agreement, which is what makes it a check',
     skipUnless(...NAMES), () => {
  // The negative, and its magnitude is the evidence: shifting the mapping by one in either direction
  // takes the agreement from 16 of 16 to 3, and leaves 6 activities with no keys at all. Without this the
  // test above could pass on a mapping that happened to be constant, which is roughly what the defect it
  // corrects was.
  for (const shift of [1, -1]) {
    let agree = 0;
    let empty = 0;
    for (const { name } of SAMPLES) {
      const { content } = importConfiguration(require_(name), { now: NOW, idPrefix: name });
      const keypad = content.buttons.filter((one) => one.surface === 'keypad');
      for (const activity of content.activities) {
        const here = keypad.filter((one) => one.inActivity === activity.slot + shift);
        if (here.length === 0) { empty += 1; continue; }
        const sent = [...new Set(here.flatMap((one) => one.sends.map((step) => step.device)))];
        if (sent.every((device) => activity.devices.includes(device))) agree += 1;
      }
    }
    assert.equal(agree, 3, `shifted by ${shift}`);
    assert.equal(empty, 6, `shifted by ${shift}: activities left with no keys`);
  }
});

/**
 * One appliance's commands as rows: what each is called, what it sends, and what the page can count.
 *
 * **The subject is the page that puts words on nameless codes.** A configuration read off a remote states
 * the rhythm a lamp blinks in and nothing else, so an imported television is eighty codes with no names,
 * and everything here is about being honest about that rather than papering over it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { CommandInUse } from '../src/shared/api.ts';
import type { DeviceCommand } from '../src/shared/library.ts';
import { commandLabel } from '../src/shared/library.ts';
import { commandRows, groupsOf, matching, namedCount, waiting }
  from '../src/renderer/src/viewmodels/commands.model.ts';

/** A command with whatever is being asked about, and a signal that is a signal. */
function command(slot: number, over: Partial<DeviceCommand> = {}): DeviceCommand {
  return {
    slot,
    signal: { carrierHz: 38000, once: [{ mark: true, us: 560 }, { mark: false, us: 1690 }] },
    origin: 'from-a-configuration',
    ...over,
  };
}

test('a command with no name is called by its position, one based', () => {
  // The fallback is a fact rather than a placeholder: this really is the twelfth code the appliance
  // answers to, and nothing in the file says which button it belonged to. One based because the position
  // in the file is zero based and nobody reading a screen is.
  assert.equal(commandLabel(command(11)), 'Command 12');
  assert.equal(commandLabel(command(0)), 'Command 1');
  assert.equal(commandLabel(command(0, { name: 'Volume up' })), 'Volume up');
  // An empty name is not a name of no characters, it is an absent one, which is what clearing the field
  // on the page produces before the write lands.
  assert.equal(commandLabel(command(4, { name: '' })), 'Command 5');
});

test('a row says whether its label is a name somebody gave it', () => {
  // The distinction the page counts, and it cannot come from the label: "Command 12" is a perfectly
  // possible thing for somebody to have typed, so `named` has to be read off the field and not the words.
  const rows = commandRows([command(0), command(1, { name: 'Power' }), command(2, { name: '' })], []);

  assert.deepEqual(rows.map((one) => one.named), [false, true, false]);
  assert.deepEqual(rows.map((one) => one.label), ['Command 1', 'Power', 'Command 3']);
  assert.deepEqual(namedCount(rows), { named: 1, total: 3 });
});

test('a command is offered the word its own remote already shows for it', () => {
  // **The correction of 22 August 2026, and the whole point of the page.** This row used to carry the
  // carrier frequency, the number of marks and gaps, and the code in hexadecimal. All three are facts and
  // all three are this project's own vocabulary: somebody filling in eighty names does not care how fast a
  // lamp flickers.
  //
  // What a configuration does know is the words it **draws**. A screen key that sends a command has the
  // word printed beside it on the display, in the owner's language, because that is how they know what they
  // are pressing. So most of an imported appliance is already named and nothing had to be fetched.
  const uses: CommandInUse[] = [
    { slot: 1, remote: 'Woonkamer', surface: 'screen', scan: 12, label: 'Sleep' },
  ];
  const rows = commandRows([command(0), command(1)], uses);

  assert.deepEqual(rows[0]?.known, [], 'a command nothing uses has no word, which is ordinary');
  assert.deepEqual(rows[1]?.known, ['Sleep']);
  assert.equal(rows[1]?.from, 'the screen of Woonkamer', 'and it says where the word came from');
  // Nothing about the signal is on a row at all, which is the absence worth asserting: a frequency or a
  // hexadecimal code creeping back in would pass every other test in this file.
  assert.deepEqual(Object.keys(rows[1] ?? {}), ['slot', 'label', 'named', 'known', 'from']);
});

test('a keypad key is named by the drawing, because the name is printed on the plastic', () => {
  // The configuration cannot answer this one: a keypad key's word is on the physical key, so it comes from
  // the drawn model. Passed in as a function, which is what keeps this file from knowing about drawings.
  const uses: CommandInUse[] = [{ slot: 0, remote: 'Woonkamer', surface: 'keypad', scan: 7 }];
  const rows = commandRows([command(0)], uses, (remote, scan) =>
    remote === 'Woonkamer' && scan === 7 ? 'Volume Up' : undefined);

  assert.deepEqual(rows[0]?.known, ['Volume Up']);

  // And a key with no drawing and no measured code yields nothing rather than a placeholder, which is most
  // keys of most models: a Harmony 525 has no scan code measured at all.
  assert.deepEqual(commandRows([command(0)], uses)[0]?.known, []);
});

test('a drawn word beats a key name, because it describes the command and not the key', () => {
  // The ordering decision. "Sleep" printed beside a screen key was chosen to describe **this command**,
  // where "Volume Up" describes the **key**, and on an activity's map that same key may carry something
  // else entirely. Both worth offering, one worth offering first.
  const uses: CommandInUse[] = [
    { slot: 0, remote: 'Woonkamer', surface: 'keypad', scan: 7 },
    { slot: 0, remote: 'Woonkamer', surface: 'screen', label: 'Volume up one step' },
  ];
  const rows = commandRows([command(0)], uses, () => 'Volume Up');

  assert.deepEqual(rows[0]?.known, ['Volume up one step', 'Volume Up']);
  assert.equal(rows[0]?.from, 'the screen of Woonkamer');
});

test('the same word from four remotes is offered once', () => {
  // A page showing one suggestion four times reads as four different things to choose between.
  const uses: CommandInUse[] = ['Woonkamer', 'Zolder', 'Keuken', 'Slaapkamer'].map((remote) => ({
    slot: 0, remote, surface: 'screen' as const, label: 'Sleep',
  }));
  assert.deepEqual(commandRows([command(0)], uses)[0]?.known, ['Sleep']);
});

test('how many nameless commands have a word waiting is the number the page leads with', () => {
  // The one figure that tells somebody whether this is ten minutes of typing or one press.
  const uses: CommandInUse[] = [
    { slot: 0, remote: 'Woonkamer', surface: 'screen', label: 'Sleep' },
    { slot: 1, remote: 'Woonkamer', surface: 'screen', label: 'Zoom' },
  ];
  const rows = commandRows([command(0), command(1, { name: 'Zoom' }), command(2)], uses);

  assert.deepEqual(namedCount(rows), { named: 1, total: 3 });
  // One, not two: the command that already has a name is not waiting for anything, and the one nothing
  // uses has nothing to take.
  assert.equal(waiting(rows), 1);
});

test('rows keep the definition\'s own order, whatever the names are', () => {
  // **Position order and never sorted.** A document's button bindings name a command by its position, so
  // the position is what is true about it, and a list that reordered itself as somebody typed would move
  // the row out from under their hands mid word.
  const rows = commandRows(
    [command(0, { name: 'Zoom' }), command(1, { name: 'Aspect' }), command(2)], []);

  assert.deepEqual(rows.map((one) => one.slot), [0, 1, 2]);
});

test('the groups are whatever a source stated, in first appearance order, and usually none', () => {
  const rows = commandRows(
    [command(0, { group: 'Volume' }), command(1, { group: 'Channel' }), command(2, { group: 'Volume' })],
    []);
  assert.deepEqual(groupsOf(rows), ['Volume', 'Channel']);
  // The ordinary case on this machine: a configuration states no groups at all, so an imported appliance
  // has none and a filter built on them would be a filter with nothing in it.
  assert.deepEqual(groupsOf(commandRows([command(0), command(1)], [])), []);
});

test('the search reaches the suggestions as well as the names', () => {
  // The half that makes the box useful before anybody has typed anything: on a fresh appliance no command
  // has a name, so a search over names alone would find nothing at all. Searching what the remote calls
  // them finds the codes it calls volume.
  const rows = commandRows(
    [command(0, { name: 'Power' }), command(1), command(2, { group: 'Picture' })],
    [{ slot: 1, remote: 'Woonkamer', surface: 'screen', label: 'Volume up' }]);

  assert.deepEqual(matching(rows, 'power').map((one) => one.slot), [0]);
  assert.deepEqual(matching(rows, 'VOLUME').map((one) => one.slot), [1], 'case does not matter');
  assert.deepEqual(matching(rows, 'picture').map((one) => one.slot), [2], 'and a group is searchable');
  assert.deepEqual(matching(rows, '   ').map((one) => one.slot), [0, 1, 2], 'blank is not a filter');
  assert.deepEqual(matching(rows, 'nothing like it'), []);
});

test('the Help walkthrough\'s Yes and No are not command names', () => {
  // **Measured before this rule existed**, over four configurations: of the commands whose drawn words
  // disagreed with each other, almost every one was this shape. A third to a half of a configuration's
  // screen pages are Logitech's own Help walkthrough, which asks whether the television came on and offers
  // Yes and No, and No re-sends the power command so you can try again. So the binding is real and the word
  // is the answer to a question.
  //
  // Dropped rather than sorted to the back, because a handful of commands had "No" as their **only** word.
  // Offering that as a name is worse than offering nothing: "Command 41" does not pretend to mean anything.
  const uses: CommandInUse[] = [
    { slot: 0, remote: 'Woonkamer', surface: 'screen', label: 'No' },
    { slot: 0, remote: 'Woonkamer', surface: 'screen', label: 'Turn off' },
    { slot: 1, remote: 'Woonkamer', surface: 'screen', label: 'No' },
  ];
  const rows = commandRows([command(0), command(1)], uses);

  assert.deepEqual(rows[0]?.known, ['Turn off'], 'the real word is the only one offered');
  assert.deepEqual(rows[1]?.known, [], 'and a command whose only word is chrome is offered nothing');
  assert.equal(waiting(rows), 1);
});

test('a label that ran onto a second page loses its page counter', () => {
  // "Input 1 OF 14" is one word and one piece of screen furniture: the counter is drawn in the slot where
  // the label continues, which the sibling repository reads as a page indicator rather than as part of the
  // label. So it comes off, and what is left is what the key means.
  const uses: CommandInUse[] = [
    { slot: 0, remote: 'Woonkamer', surface: 'screen', label: 'Input 1 OF 14' },
    // And the plain form of the same word, from another binding, which must not become a second suggestion.
    { slot: 0, remote: 'Woonkamer', surface: 'screen', label: 'Input' },
    { slot: 1, remote: 'Woonkamer', surface: 'screen', label: 'Surround 1 OF 2' },
  ];
  const rows = commandRows([command(0), command(1)], uses);

  assert.deepEqual(rows[0]?.known, ['Input']);
  assert.deepEqual(rows[1]?.known, ['Surround']);
});

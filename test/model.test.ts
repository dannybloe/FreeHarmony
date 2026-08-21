/**
 * The document model's own rules, which are the ones no type can state.
 *
 * The types are checked by the compiler and the tables in `writeback.ts` are complete because the
 * compiler insists. What is left for a test is the part that is a claim rather than a shape: that a
 * verdict says where it lives exactly when it lives somewhere, that only something learned from
 * hardware may be shared, and that the tables have not quietly stopped covering the model.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mayBeShared, type DefinitionOrigin } from '../src/shared/library.ts';
import { canReachARemote, TABLES, type Verdict } from '../src/shared/writeback.ts';

test('only something learned from hardware may ever be shared', () => {
  // Every origin, named rather than iterated, so a new one has to be added here and thought about.
  // `from-a-configuration` is the one that looks shareable and is not: the codes in a compiled
  // configuration were authored by Logitech's compiler out of Logitech's database, and coming off your
  // own remote does not change who wrote them.
  const origins: DefinitionOrigin[] = ['learned-here', 'from-logitech', 'from-a-configuration'];
  assert.deepEqual(
    origins.filter(mayBeShared),
    ['learned-here'],
    'the provenance rule is the one field that cannot be established in hindsight',
  );
});

test('a verdict names where a field lives exactly when it lives somewhere', () => {
  const wrong: string[] = [];
  for (const [table, fields] of Object.entries(TABLES)) {
    for (const [field, verdict] of Object.entries(fields)) {
      const ours = verdict.writeback === 'ours';
      if (ours !== (verdict.structure === undefined)) {
        wrong.push(`${table}.${field}: ${verdict.writeback} with ` +
          (verdict.structure === undefined ? 'no structure' : `structure ${verdict.structure}`));
      }
    }
  }
  // The check that keeps the table honest in both directions. A field marked `ours` that names a
  // structure is a contradiction, and a field that claims a structure without naming one is a verdict
  // nobody can check against the emitter.
  assert.deepEqual(wrong, []);
});

test('every table covers a field and the count is exact', () => {
  // Exact, never a floor, per the sibling's own rule: a floor absorbs a whole table falling out, and
  // these move only when somebody changes the model, and then they move in a diff.
  const counted = Object.fromEntries(
    Object.entries(TABLES).map(([name, fields]) => [name, Object.keys(fields).length]),
  );
  assert.deepEqual(counted, {
    SIGNAL: 7, COMMAND: 5, TIMING: 3, DEFINITION: 8, DEVICE_USE: 3,
    STEP: 2, ROLE: 2, ACTIVITY: 7, BUTTON: 6, CONTENT: 4,
  });
});

test('the fields an editor would offer first can all reach a remote', () => {
  // The question the whole table exists to answer, asked about the things step 3 of the plan promises:
  // rename an activity, correct a device's name, change what a button sends.
  const reachable = (verdict: Verdict | undefined): boolean =>
    verdict !== undefined && canReachARemote(verdict);
  assert.ok(reachable(TABLES['ACTIVITY']?.['name']), 'renaming an activity is step 3');
  assert.ok(reachable(TABLES['DEVICE_USE']?.['label']), "correcting a device's name is step 3");
  assert.ok(reachable(TABLES['BUTTON']?.['sends']), 'changing what a button sends is step 5');
  // And the control, which is what makes the three above mean anything: the model deliberately holds
  // things that can never reach a remote, and the table has to say so rather than shrug.
  assert.equal(reachable(TABLES['ACTIVITY']?.['kind']), false, 'what an activity is for is ours alone');
  assert.equal(reachable(TABLES['COMMAND']?.['name']), false, 'an infrared record carries no name');
});

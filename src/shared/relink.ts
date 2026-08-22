/**
 * Pointing a device position at a different description of the same appliance, without changing what
 * any button sends.
 *
 * **The one place in this model where something can go wrong silently**, which is why it is its own file
 * with its own tests. A binding does not name a command, it names *the hundred and twelfth* command of
 * whatever appliance sits in that position. Swap the description and every one of those numbers means
 * something else, and nothing errors: the buttons keep working and start sending the wrong codes.
 *
 * It arises immediately, on the first import. Two descriptions of one television are the same appliance
 * when they send the same things, and that comparison **sorts**, so it is deliberately blind to the order
 * the commands sit in. Which is right for deciding identity and exactly wrong for deciding what a button
 * sends. So identity and order are two questions, and this file is the second one.
 *
 * The rewrite is on the **code itself** and never on a name. Two reasons, and the second is the one that
 * settles it. A description read out of a configuration carries no names at all: a command there is a
 * position and a set of pulses, not "volume up". And a code is what the appliance actually hears, so two
 * descriptions that agree on it agree about reality rather than about vocabulary.
 *
 * `matchBySignal` is passed rather than inlined, because there is a known next case: recognising an
 * appliance whose codes are *nearly* the same and mapping what it can. That is a different question, it
 * has to report what it guessed, and it is not decided. Keeping the matcher separate means it can arrive
 * without this file being rewritten, and means this file's own guarantee stays checkable: given an exact
 * matcher, nothing is ever dropped.
 */
import type { Activity, ButtonBinding, RemoteContent, Step } from './content.ts';
import type { DeviceCommand, InfraredSignal } from './library.ts';
import { signatureOf } from './library.ts';

/** Stands in for a position the other description does not have, so the comparison needs no branch. */
const EMPTY: InfraredSignal = { once: [], held: [], tail: [] };

/**
 * Which command of the new description each command of the old one becomes.
 *
 * `undefined` at a position means the new description has nothing that sends that code. A caller decides
 * what that means; this module never quietly drops a step.
 */
export type CommandMapping = readonly (number | undefined)[];

export interface Relinked {
  readonly content: RemoteContent;
  /** Steps whose command moved to a different position, so a number in the document changed. */
  readonly moved: number;
  /** Steps whose command has no counterpart at all. Zero whenever the two descriptions are the same. */
  readonly unmatched: number;
}

/**
 * Match every command of one description to the command of another that sends the same thing.
 *
 * Exact, on the signal, and that is the whole of it. Two rules, and the first one was added because a test
 * found its absence.
 *
 * **A position that already agrees keeps its number.** Where a description holds one code twice, under two
 * names, looking the code up would send both references to the first of the pair, and 229 of the 3925
 * commands in the corpus next door are exactly that: a command sending what an earlier command of the same
 * appliance sends. So importing the same remote twice moved references that had no reason to move. It was
 * harmless, since the appliance cannot tell the two apart, and it made `moved` report churn as though
 * something had happened. Now identical descriptions map to themselves and the count means what it says.
 *
 * **Otherwise the first occurrence of the code wins.** Arbitrary, and it has to be decided by something:
 * it is deterministic so a test can pin it, and the candidates are indistinguishable to the appliance.
 *
 * A command with no signal at all maps to nothing. None exist, 0 of those 3925, so this is a definition
 * of behaviour rather than a case being handled.
 */
export function matchBySignal(
  from: readonly DeviceCommand[], to: readonly DeviceCommand[],
): CommandMapping {
  const byCode = new Map<string, number>();
  to.forEach((command, index) => {
    const code = signatureOf(command.signal);
    if (code !== '' && !byCode.has(code)) byCode.set(code, index);
  });
  return from.map((command, index) => {
    const code = signatureOf(command.signal);
    if (code === '') return undefined;
    // The position it already sits at, when that position sends the same thing. Cheaper than the lookup
    // and, more to the point, the answer that leaves the document alone.
    if (signatureOf(to[index]?.signal ?? EMPTY) === code) return index;
    return byCode.get(code);
  });
}

/**
 * Rewrite every reference to one device position through a mapping.
 *
 * Three lists hold a command number and no others: a button's, and an activity's two handler lists. That
 * is checked rather than remembered, by `test/relink.test.ts` walking the model's own types.
 *
 * An unmatched step is **kept as it is** and counted. Dropping it would change what a button does on the
 * strength of a comparison the caller has not been told the result of yet, and a button that quietly
 * sends nothing is worse than one that still says what it used to mean. So the caller sees the count and
 * decides: the import refuses to link at all unless the count is zero, and hanging a position onto a
 * different appliance by hand is a conversation that has not happened.
 */
export function relinkAppliance(
  content: RemoteContent, slot: number, mapping: CommandMapping,
): Relinked {
  let moved = 0;
  let unmatched = 0;

  const step = (one: Step): Step => {
    if (one.device !== slot) return one;
    const to = mapping[one.command];
    if (to === undefined) { unmatched += 1; return one; }
    if (to === one.command) return one;
    moved += 1;
    return { ...one, command: to };
  };

  const activities: Activity[] = content.activities.map((activity) => ({
    ...activity,
    onStart: activity.onStart.map(step),
    onStop: activity.onStop.map(step),
  }));
  const buttons: ButtonBinding[] = content.buttons.map((binding) => ({
    ...binding, sends: binding.sends.map(step),
  }));

  return { content: { ...content, activities, buttons }, moved, unmatched };
}

/**
 * Naming a remote's codes from Logitech's catalogue by comparing the codes themselves.
 *
 * **This is the route that is not a guess, and it is worth saying what the other two were.** A word drawn
 * on a remote's screen and the name of the key a code sits on both describe **where** a code is, not what
 * it is: somebody may have put channel up on the key marked 1, and Logitech's own default is only a
 * default. This route compares the code, so it either matches or it does not.
 *
 * **The measurement it rests on**, made on 22 August 2026: 52 of the 58 commands Logitech states for one
 * Panasonic television are byte for byte equal to a code on the television attached to the bench Harmony
 * 600, which is a **different model** of the same family. So the numbers really do line up, and they line
 * up across models, which is what makes the catalogue useful at all.
 *
 * The comparison is a frame and its width together, never the value alone. `0x10ef` at 16 bits and at 32
 * bits are different codes, and a match on the value alone would hand somebody a name from another
 * protocol entirely.
 *
 * **Nothing is written by this file.** It reports which position would get which word, and applying it is
 * a separate step, because a name a machine found is still a name somebody should be able to look at.
 */
import type { CommandNaming } from '../../shared/api.ts';
import type { DeviceDefinition } from '../../shared/library.ts';
import { frameKeyOf } from '../frames.ts';
import type { CatalogueCommand } from './client.ts';

export interface Matched {
  /** What to name which position. Ready to hand to `nameCommands`. */
  readonly names: readonly CommandNaming[];
  /** How many of the appliance's codes could be compared at all, which bounds what a match could be. */
  readonly comparable: number;
  /** How many words the catalogue offered, so a share can be stated with both its counts. */
  readonly offered: number;
}

/**
 * Which of an appliance's codes Logitech has a word for.
 *
 * **Only the nameless ones by default**, which is the decision worth stating: a name somebody typed is
 * their own and beats a catalogue, and a page that quietly replaced it would be a page that loses work.
 * `overNames` is how a caller asks for the other behaviour, and the only honest caller for it is somebody
 * pressing a button that says so.
 *
 * A code the catalogue names twice is taken once, first occurrence, and a code that decodes to no frame is
 * simply not comparable. Both are counted rather than hidden: the report says how many could be compared,
 * so a poor result can be read as "these are not the same appliance" rather than as a failure here.
 */
export function matchNames(
  definition: DeviceDefinition,
  theirs: readonly CatalogueCommand[],
  options: { overNames?: boolean } = {},
): Matched {
  // Their side first, keyed on width and value. Built from theirs rather than from ours so that a
  // catalogue offering two words for one code resolves to the first, deterministically.
  const byCode = new Map<string, string>();
  for (const command of theirs) {
    if (command.bits === undefined || command.frame === undefined) continue;
    const key = `${command.bits}:${command.frame.toLowerCase()}`;
    if (!byCode.has(key)) byCode.set(key, command.name);
  }

  const names: CommandNaming[] = [];
  let comparable = 0;
  for (const command of definition.commands) {
    const key = frameKeyOf(command.signal);
    if (key === undefined) continue;
    comparable += 1;
    const named = command.name !== undefined && command.name !== '';
    if (named && options.overNames !== true) continue;
    const word = byCode.get(key);
    if (word === undefined || word === command.name) continue;
    names.push({ slot: command.slot, name: word });
  }

  return { names, comparable, offered: byCode.size };
}

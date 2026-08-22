/**
 * One appliance's commands, as rows a page can draw and a test can walk.
 *
 * **Why this page exists at all.** An infrared command is a lamp blinking in a precise rhythm, and a
 * configuration read off a remote stores the rhythm and nothing else: no command names. So an imported
 * television is eighty codes called "Command 1" to "Command 81", and every screen in this application that
 * shows one shows that. This is where somebody puts words on them.
 *
 * **What is on a row besides the field, and this took two attempts.** The first version showed the carrier
 * frequency, how many marks and gaps the transmission was made of, and the bit frame in hexadecimal. All
 * three are facts and all three are this project's own vocabulary: somebody filling in eighty names does
 * not care how fast a lamp flickers, and Danny said so on 22 August 2026.
 *
 * What belongs there is what **their own remote already calls it**. A screen key that sends a command has
 * the word printed beside it on the display, in their language, because that is how the person pressing it
 * knows what it does. And a code on the keypad is on a key with a name printed on the plastic. So most of
 * an imported appliance is already named, by the file and the drawing between them, and the page's job is
 * to offer that rather than to describe a waveform.
 *
 * No React and no DOM, so every rule below is walkable by `node:test`.
 */
import type { CommandInUse } from '../../../shared/api.ts';
import type { DeviceCommand } from '../../../shared/library.ts';
import { commandLabel } from '../../../shared/library.ts';

export interface CommandRow {
  readonly slot: number;
  /** What it is called, or the position where nobody has said. `commandLabel`'s answer. */
  readonly label: string;
  /** Whether that label is a name somebody gave it, which is what the page counts. */
  readonly named: boolean;
  /** Logitech's own grouping where a source stated one, which is nowhere yet on an imported appliance. */
  readonly group?: string;
  /**
   * What this command is already called somewhere on a remote, best first, without repeats.
   *
   * Empty for a command nothing uses, which is an ordinary answer rather than a gap: a television answers
   * to a hundred codes and a remote binds thirty of them, so the obscure ones genuinely have no word
   * anywhere and there is nothing honest to put beside them.
   */
  readonly known: readonly string[];
  /** Where the first of those words came from, so a page can say it without implying we invented it. */
  readonly from?: string;
}

/**
 * What a scan code is called on a remote, which the drawing knows and the configuration does not.
 *
 * A function passed in rather than the drawing itself, because this file has no business knowing about
 * `@harmony/silhouettes`: the view holds the drawings, and the rule for turning a key's identifier into
 * words is `spelledOut` next door. Returning `undefined` is the common case, since most models have no
 * drawing and most keys of the drawn ones have no measured code.
 */
export type KeyNamer = (remote: string, scan: number) => string | undefined;

/**
 * Every command as a row, in the order the definition holds them.
 *
 * **Position order and never sorted by name**, which is a decision rather than laziness: a document's
 * button bindings name a command by its position, so the position is what is true about it, and a list that
 * reordered itself as somebody typed would move the row out from under their hands mid word.
 */
export function commandRows(
  commands: readonly DeviceCommand[],
  uses: readonly CommandInUse[],
  keyNamer: KeyNamer = () => undefined,
): readonly CommandRow[] {
  return commands.map((command) => {
    const mine = uses.filter((one) => one.slot === command.slot);
    const words = suggestions(mine, keyNamer);
    return {
      slot: command.slot,
      label: commandLabel(command),
      named: command.name !== undefined && command.name !== '',
      ...(command.group === undefined ? {} : { group: command.group }),
      known: words.map((one) => one.word),
      ...(words[0] === undefined ? {} : { from: words[0].where }),
    };
  });
}

/**
 * Words that are drawn beside a key and are not a command's name, so they are dropped rather than ranked.
 *
 * **These are Logitech's Help walkthrough answering its own question.** A third to a half of a
 * configuration's screen pages are that walkthrough: it asks whether the television came on and offers Yes
 * and No, and No re-sends the power command so you can try again. So the code is genuinely bound to a key
 * drawn "No", and "No" is the answer to a question rather than the name of anything.
 *
 * Measured over four configurations before this list existed: of the commands whose words disagreed, almost
 * every one was this exact shape, `{No, Turn off}` or `{No, Input Hdmi1}`. And a handful of commands had
 * "No" as their **only** word, which is why these are removed rather than sorted to the back: offering
 * somebody "No" as a name for a code is worse than offering nothing, since "Command 41" at least does not
 * pretend.
 */
const NOT_A_NAME = ['yes', 'no'];

/**
 * A drawn word with the screen's own furniture taken off it.
 *
 * A label that runs onto a second page carries its page indicator, "Input 1 OF 14" or "PwrOff 3 OF 3",
 * which the sibling repository reads as exactly that: an indicator drawn in the continuation slot rather
 * than part of the word. So it comes off, and what is left is "Input".
 */
function cleaned(word: string): string {
  return word.replace(/\s*\d+\s+OF\s+\d+\s*$/i, '').trim();
}

/**
 * The words a command is already known by, best first.
 *
 * **A drawn word beats a key's name**, which is the ordering decision and the reason it is a decision: the
 * word on the screen was chosen by whoever set the remote up to describe **this command**, where a key's
 * name describes the **key**. "Sleep" printed beside a screen key is what that code does; "Volume Up" on a
 * keypad key is where it happens to sit, and on an activity's map the same key may carry something else
 * entirely. Both are worth offering and only one of them is worth offering first.
 */
function suggestions(
  uses: readonly CommandInUse[], keyNamer: KeyNamer,
): readonly { word: string; where: string }[] {
  const found: { word: string; where: string }[] = [];
  const add = (word: string | undefined, where: string) => {
    const wanted = word === undefined ? '' : cleaned(word);
    if (wanted === '' || NOT_A_NAME.includes(wanted.toLowerCase())) return;
    // Deduplicated on the word, so a command bound on four remotes that all draw "Sleep" offers it once.
    // A page showing the same suggestion four times reads as four different things to choose between.
    if (found.some((one) => one.word.toLowerCase() === wanted.toLowerCase())) return;
    found.push({ word: wanted, where });
  };

  for (const use of uses) {
    if (use.surface === 'screen') add(use.label, `the screen of ${use.remote}`);
  }
  for (const use of uses) {
    if (use.surface !== 'keypad' || use.scan === undefined) continue;
    const named = keyNamer(use.remote, use.scan);
    add(named, `the ${named ?? ''} key of ${use.remote}`);
  }
  return found;
}

/** How many have a name, and how many there are. Both numbers, never a share. */
export function namedCount(rows: readonly CommandRow[]): { named: number; total: number } {
  return { named: rows.filter((one) => one.named).length, total: rows.length };
}

/**
 * How many nameless rows have a word waiting to be taken, which is the number a page leads with.
 *
 * It is the one figure on the page that tells somebody whether this is ten minutes of typing or one press,
 * so it is worth computing rather than leaving them to scroll and find out.
 */
export function waiting(rows: readonly CommandRow[]): number {
  return rows.filter((one) => !one.named && one.known.length > 0).length;
}

/** Every group any row states, in first appearance order, for a filter. Empty on an imported appliance. */
export function groupsOf(rows: readonly CommandRow[]): readonly string[] {
  const seen: string[] = [];
  for (const row of rows) {
    if (row.group !== undefined && !seen.includes(row.group)) seen.push(row.group);
  }
  return seen;
}

/**
 * The rows that match what somebody typed into the search box, over every word on the row.
 *
 * The suggestions are searchable as well as the names, which is the half that makes the box useful before
 * anybody has typed a single name: searching "volume" on a fresh appliance finds the codes its own remote
 * already calls volume.
 */
export function matching(rows: readonly CommandRow[], typed: string): readonly CommandRow[] {
  const wanted = typed.trim().toLowerCase();
  if (wanted === '') return rows;
  return rows.filter((row) =>
    [row.label, row.group ?? '', ...row.known]
      .some((one) => one.toLowerCase().includes(wanted)));
}

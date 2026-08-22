/**
 * What each key on a drawing is doing on one device's page, as plain data.
 *
 * **No React and no DOM**, which is the point of it being here: the interesting part of a clickable keypad
 * is not the click, it is the four states a key can be in, and three of those are easy to get wrong in a
 * way a screenshot cannot show. So the states are computed by a function a test can walk with a drawing
 * and a document and nothing else, and the view's whole job is to paint them.
 *
 * **The fourth state is the one this project has to be honest about.** A key is drawn from measured
 * geometry, and its scan code is a separate measurement that mostly has not been made: 36 of a Harmony
 * 600's 54 keys have one, 34 of a Harmony One's 44, and **none at all** of a Harmony 525's 50. A key with
 * no code cannot be pointed at anything, ever, by anybody, and that is not the same as a key nobody has
 * pointed at yet. Drawing them alike would be the interface claiming a capability it has not got, so
 * `unmeasured` exists and the page says what it means when one is pressed.
 *
 * `taken` is the other one worth stating. Within one activity a key sends to one place, because the remote
 * would otherwise have to choose, so a key already pointed at another position is shown as belonging to
 * that position rather than as free. The same key in a different activity is a different question, which
 * is why every function here takes one.
 */
import type { Key, Model } from '@harmony/silhouettes';
import { elementId } from '@harmony/silhouettes';

import type { ButtonBinding } from '../../../shared/content.ts';

export type KeyState =
  /** Sends to the device whose page this is. */
  | 'mine'
  /** Sends to another position on this remote. */
  | 'taken'
  /** Nothing is bound to it, and something could be. */
  | 'free'
  /** Its code has never been measured on this model, so nothing can ever be bound to it here. */
  | 'unmeasured';

export interface KeyOnScreen {
  /** Logitech's own word for the key where we have it, which is what the page shows. */
  readonly name: string;
  /** The element the drawing gives it, so the view can find it without guessing. */
  readonly id: string;
  readonly scan?: number;
  readonly state: KeyState;
  /** Which commands it sends, by position in the device's own list. Only for `mine`. */
  readonly sends: readonly number[];
  /** Which position owns it. Only for `taken`. */
  readonly ownedBy?: number;
}

/**
 * The keypad bindings of one activity.
 *
 * **Every keypad binding in the corpus that sends a code belongs to an activity**, all 1122 of them across
 * five configurations and three architectures. Which is what a Harmony is for: the volume key sends to the
 * amplifier while you are listening to music and to the television while you are watching it, so the same
 * key has as many answers as there are activities and a page has to pick one.
 *
 * **That is a claim about these files and not about the format**, and the difference was Danny's point on
 * 22 August 2026. A Harmony also has a **device mode**, where the keypad drives one device with no activity
 * running, and a map for that would be a keypad binding with no activity. The measurement says these
 * configurations carry none: of 48 keypad maps in them, exactly the 16 an activity installs send an
 * infrared code, and the other 32 send nothing at any depth, 10 of them binding fifty or more keys to
 * comparisons and mode entries, which is a menu. Whether a remote in device mode remaps its keypad at all
 * is a question for the bench, and `test/import.test.ts` states the population so a sample that carries one
 * fails rather than being absorbed.
 *
 * An earlier version of this page read the bindings with no context, which is a real place in the format
 * and is empty in every file here, so it showed no assignments at all on a configuration holding 220.
 *
 * A screen key is a separate population that shares no code with the keypad, and it is a later round.
 */
export function keypadBindings(
  buttons: readonly ButtonBinding[], activity: number,
): readonly ButtonBinding[] {
  return buttons.filter((one) =>
    one.surface === 'keypad' && one.scan !== undefined && one.inActivity === activity);
}

/** Every key on the drawing, in the drawing's own order, with what it is doing in one activity. */
export function keypadFor(
  drawing: Model, buttons: readonly ButtonBinding[], slot: number, activity: number,
): readonly KeyOnScreen[] {
  const bound = keypadBindings(buttons, activity);
  return drawing.keys.map((key) => describeKey(key, bound, slot));
}

function describeKey(key: Key, bound: readonly ButtonBinding[], slot: number): KeyOnScreen {
  const id = elementId(key.name);
  if (key.scan === undefined) {
    // A candidate set is still no code. The Harmony 525's four soft keys are known to be four of
    // `{30, 31, 38, 39}` and nothing says which, so binding one would be a guess written into a document.
    return { name: key.name, id, state: 'unmeasured', sends: [] };
  }
  const scan = key.scan;
  const here = bound.find((one) => one.scan === scan);
  if (here === undefined) return { name: key.name, id, scan, state: 'free', sends: [] };
  const owner = here.sends[0]?.device;
  if (owner === slot) {
    return { name: key.name, id, scan, state: 'mine', sends: here.sends.map((step) => step.command) };
  }
  return {
    name: key.name, id, scan, state: 'taken', sends: [],
    ...(owner === undefined ? {} : { ownedBy: owner }),
  };
}

/**
 * How many of a model's keys can ever be bound, which is what a page needs to say something true.
 *
 * Both numbers, never a share: "36 of 54" can be checked against the drawing in front of you and "67%"
 * cannot. The sibling repository's rule about stating both counts, applied to a screen.
 */
export function measuredKeys(keys: readonly KeyOnScreen[]): { measured: number; total: number } {
  return { measured: keys.filter((one) => one.state !== 'unmeasured').length, total: keys.length };
}

/**
 * What a name reads as: `VolumeUp` is one word on the drawing and two on a page.
 *
 * **Spaces only, and the capitals are left exactly as they are.** These are Logitech's own identifiers,
 * one word by design so that "which key is the mute key" is one lookup on every model, and each word of
 * one is a word printed on a real key. Lowercasing the second word would give "Volume up" where the
 * remote in front of somebody says "Volume Up", and it would have to know that `OK` is not a word to
 * lowercase. Inserting a space is a change nothing can be wrong about.
 */
export function spelledOut(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // A digit is its own word too, which is measured rather than assumed: the ten names in the whole
    // library that carry one are `Number0` to `Number9`, so there is no `MP3` to be broken by this.
    .replace(/([A-Za-z])(\d)/g, '$1 $2');
}

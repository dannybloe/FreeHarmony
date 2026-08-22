/**
 * What each key on a drawing does for one device, as plain data.
 *
 * **This is the device's own button map, which is device mode.** Danny's picture of it, and it is the one
 * to hold on to: switching to a device is like reaching for the old remote that came with that appliance.
 * On that old remote you cannot control anything else, because there is nothing else on it. One appliance,
 * its own keys, its own commands.
 *
 * So there are three things a key can be here and no more: it sends one of this device's commands, it
 * sends nothing, or its scan code has never been measured on this model so nothing can ever be put on it.
 *
 * **Activities are not part of this and two earlier versions thought they were.** The first showed one
 * activity's map with a chooser above it. The second showed the device's map but decorated every key with
 * which activities carried it and which other device held it elsewhere. Both were answering a question
 * about the **activity** map, which is the mixed one: in an activity any key may carry any command of any
 * appliance you own, and that is a different page. Here there is only ever one appliance, so there is
 * nothing to be in the way and nothing to disagree about.
 *
 * No React and no DOM, so every state below is walkable by a test. The derivation is
 * `shared/buttonmap.ts`, shared with the writer.
 */
import type { Key, Model } from '@harmony/silhouettes';
import { elementId } from '@harmony/silhouettes';

import type { ButtonBinding } from '../../../shared/content.ts';
import { activitiesUsing, deviceMap, keypadBindings } from '../../../shared/buttonmap.ts';

export type KeyState =
  /** Sends one of this device's commands. */
  | 'mine'
  /** Sends nothing for this device, and something could. */
  | 'free'
  /** Its code has never been measured on this model, so nothing can ever be bound to it here. */
  | 'unmeasured';

export interface KeyOnScreen {
  /** Logitech's own word for the key where we have it, which is what a page shows. */
  readonly name: string;
  /** The element the drawing gives it, so a view can find it without guessing. */
  readonly id: string;
  readonly scan?: number;
  readonly state: KeyState;
  /** Which of this device's commands it sends, by position in the device's own list. Only for `mine`. */
  readonly command?: number;
}

export { keypadBindings, activitiesUsing };

/** Every key on the drawing, in the drawing's own order, with what it does for one device. */
export function keypadFor(
  drawing: Model, buttons: readonly ButtonBinding[], slot: number,
): readonly KeyOnScreen[] {
  const map = deviceMap(buttons, slot);
  return drawing.keys.map((key) => describeKey(key, map));
}

function describeKey(key: Key, map: ReadonlyMap<number, number>): KeyOnScreen {
  const id = elementId(key.name);
  if (key.scan === undefined) {
    // A candidate set is still no code. A Harmony 525's four soft keys are known to be four of a set of
    // four and nothing says which is which, so binding one would be a guess written into a document.
    return { name: key.name, id, state: 'unmeasured' };
  }
  const command = map.get(key.scan);
  if (command === undefined) return { name: key.name, id, scan: key.scan, state: 'free' };
  return { name: key.name, id, scan: key.scan, state: 'mine', command };
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

/** How many of them this device already uses, which is the other half of a sentence worth reading. */
export function boundKeys(keys: readonly KeyOnScreen[]): number {
  return keys.filter((one) => one.state === 'mine').length;
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

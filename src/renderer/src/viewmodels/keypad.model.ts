/**
 * What each key on a drawing does for one device, as plain data.
 *
 * **This is the device's own button map, which is what device mode is.** Press Devices on a Harmony, pick
 * the television, and every key drives the television. That is the ordinary way to reach a command an
 * activity does not carry, and it is the whole subject of a page about a device. `CLAUDE.md`'s first
 * section is the operating concept and it is worth reading before changing anything here.
 *
 * **A configuration does not state that map, it states one per activity**, so the map is worked out from the
 * activities that drive the device. The derivation is `shared/buttonmap.ts` and it is shared with the writer
 * on purpose: the sentence this page shows before a change and the change itself must not be able to
 * disagree. What is left here is the part that is genuinely a view's: which of five words to say.
 *
 * The first version of this file read one activity at a time and offered a chooser, which was the wrong
 * question on a page about a device. The second read the whole remote instead of the driving activities, so
 * a key free in every activity that drives this device but spoken for in some unrelated one showed as
 * another device's: 31 of a Harmony 600's 36 placeable keys, on the very configuration its test uses.
 *
 * **The states are about the map and not about the differences between activities**, which is the third
 * version and the one worth stating. A key can differ across activities in three ways and only one of them
 * leaves the device's map without an answer: two commands. The other two, another device holding it and
 * nothing holding it, are ordinary and common, and they say where a change reaches rather than what the map
 * says. Those belong in the panel beside the chooser, per key, before anything is written; folding them into
 * a colour would have marked 27 of a Harmony One's 30 bound keys as a conflict.
 *
 * No React and no DOM, so every state below is walkable by a test.
 *
 * **One state exists because this project has to be honest about its own reach.** A key is drawn from
 * measured geometry and its scan code is a separate measurement, mostly not made: 36 of a Harmony 600's
 * 54 keys have one, 34 of a Harmony One's 44, and none at all of a Harmony 525's 50. A key with no code
 * cannot be pointed at anything by anybody, which is not the same as a key nobody has pointed at yet.
 */
import type { Key, Model } from '@harmony/silhouettes';
import { elementId } from '@harmony/silhouettes';

import type { Activity, ButtonBinding } from '../../../shared/content.ts';
import type { KeyInActivity } from '../../../shared/buttonmap.ts';
import { drivingActivities, heldOnThisRemote, keyAcrossActivities, keypadBindings }
  from '../../../shared/buttonmap.ts';

export type KeyState =
  /** Sends one command to this device. */
  | 'mine'
  /**
   * Sends **two different commands** to this device, depending on which activity is running.
   *
   * The one case where the device's map has no answer, so a page about the device may not pick one. Nine
   * of 1105 pairs of a device and a key in the corpus, and an amplifier whose input differs per activity is
   * the real example.
   *
   * Deliberately narrow. Two other things make the activities not uniform, a key another device holds in
   * some of them and a key nothing has in some of them, and both are ordinary: 27 of the first device's 30
   * keys on the Harmony One in the lab are another device's key in at least one of the eight activities
   * that drive it. Colouring those as a conflict would mark almost the whole keypad as a problem. They are
   * facts about **where a change reaches**, so they belong in the panel beside the chooser and are said
   * there, per key, before anything is written.
   */
  | 'contested'
  /** Every activity that drives this device has this key on another device, so there is no room for it. */
  | 'taken'
  /** Nothing has it in at least one activity that drives this device, so something could. */
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
  /**
   * Which command it sends for this device, by position in the device's own list.
   *
   * Only for `mine`, which is the state that means there is one answer. A `contested` key has two and the
   * page has to say so rather than pick, which is what `perActivity` is for.
   */
  readonly command?: number;
  /** What it does in each activity that drives this device, in the document's order. */
  readonly perActivity: readonly KeyInActivity[];
  /** The activities a change would be written into: this device's already, or free. */
  readonly writable: readonly number[];
  /** The activities another device holds it in, which a change leaves alone. */
  readonly held: readonly number[];
  /** Which device holds it. Only for `taken`. */
  readonly ownedBy?: number;
}

export { keypadBindings, drivingActivities };

/**
 * Every key on the drawing, in the drawing's own order, with what it does for one device.
 *
 * `activities` carries the declared device lists, which is what says who drives what.
 */
export function keypadFor(
  drawing: Model,
  buttons: readonly ButtonBinding[],
  slot: number,
  activities: readonly Activity[],
): readonly KeyOnScreen[] {
  return drawing.keys.map((key) => describeKey(key, buttons, slot, activities));
}

function describeKey(
  key: Key, buttons: readonly ButtonBinding[], slot: number, activities: readonly Activity[],
): KeyOnScreen {
  const id = elementId(key.name);
  if (key.scan === undefined) {
    // A candidate set is still no code. A Harmony 525's four soft keys are known to be four of a set of
    // four and nothing says which is which, so binding one would be a guess written into a document.
    return {
      name: key.name, id, state: 'unmeasured', perActivity: [], writable: [], held: [],
    };
  }
  const scan = key.scan;
  const across = keyAcrossActivities(buttons, slot, activities, scan);
  const at = { name: key.name, id, scan, ...across };

  if (across.commands.length === 0) {
    // Nothing of this device's on this key. Free where a driving activity leaves room, and otherwise
    // somebody else's, which includes the case where no activity drives this device at all: then the
    // page refuses the write in its own words and the drawing still says something true about the remote.
    if (across.writable.length > 0) return { ...at, state: 'free' };
    const owner = heldOnThisRemote(buttons, scan, slot);
    return { ...at, state: 'taken', ...(owner === undefined ? {} : { ownedBy: owner }) };
  }

  // Two commands is the one state where the device's map has no answer. Everything else about how the
  // activities differ is a fact about where a change reaches, and the panel says it per key.
  if (across.commands.length > 1) return { ...at, state: 'contested' };
  return { ...at, state: 'mine', command: across.commands[0]! };
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

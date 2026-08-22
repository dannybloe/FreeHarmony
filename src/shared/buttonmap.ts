/**
 * What one key of one remote does for one device, activity by activity.
 *
 * **This is a device's own button map, which is what device mode is on a Harmony.** Press Devices, pick the
 * television, and every key drives the television. `CLAUDE.md`'s first section is the operating concept and
 * it comes before this file.
 *
 * **A configuration does not store that map. It stores one keypad map per activity**, so the device's map
 * has to be worked out from the activities that drive it, and the answer is not always one thing. Measured
 * on the two configurations with a drawn model, over the activities each device is actually driven by:
 *
 * | | Harmony 600, its first device | Harmony One, its first device |
 * |---|---|---|
 * | activities driving it | 3 | 8 |
 * | keys it already drives | 5 | 30 |
 * | of those, the same command in every one of them | 3 | 3 |
 * | of those, a different device in at least one | 2 | 27 |
 * | of those, free in at least one | 0 | 24 |
 *
 * So the interesting case is the ordinary one, and two blunt answers are both wrong. Picking one activity's
 * answer invents the map. Writing every driving activity **takes the key away from the other device** in the
 * activities where it is that device's key, which is a destructive edit nobody asked for: on that Harmony
 * One it would do so for 27 of 30 keys.
 *
 * What is right is per activity: a key is written where there is room for it, which is where this device
 * already has it or where nothing has it, and the activities where another device holds it are left alone
 * and named. That is why this lives in `shared/` rather than in either caller. The writer in
 * `main/content.ts` and the keypad in the window both need the same answer, and two derivations of one fact
 * are the state the sibling repository's oldest rule is about: they were right together for a while and then
 * one of them moved.
 */
import type { Activity, ButtonBinding } from './content.ts';

/** What a key does for this device in one activity. Neither field means nothing has it there. */
export interface KeyInActivity {
  readonly activity: number;
  /** The command it sends for **this** device, by position in the device's own command list. */
  readonly command?: number;
  /** The device that holds it there instead. */
  readonly heldBy?: number;
}

export interface KeyAcrossActivities {
  /** Every activity that drives the device, in the document's own order, and what the key does in each. */
  readonly perActivity: readonly KeyInActivity[];
  /**
   * The activities a write may reach: this device already has the key there, or nothing has.
   *
   * The writer's own list, so the sentence a page shows before a change and the change itself cannot
   * disagree.
   */
  readonly writable: readonly number[];
  /** The activities another device holds it in, which a write leaves exactly as they are. */
  readonly held: readonly number[];
  /** The commands this device sends with it, in the order the activities are read. Usually one. */
  readonly commands: readonly number[];
}

/**
 * Which activities drive a device, by their own position, in the document's order.
 *
 * The activity's **own declared device list** and not its bindings, because an activity that drives the
 * television and has no key for it yet is exactly the case a first assignment is for.
 */
export function drivingActivities(
  activities: readonly Activity[], device: number,
): readonly number[] {
  return activities.filter((one) => one.devices.includes(device)).map((one) => one.slot);
}

/** The keypad bindings of a remote: on the keypad, and with a scan code that can be placed. */
export function keypadBindings(buttons: readonly ButtonBinding[]): readonly ButtonBinding[] {
  return buttons.filter((one) => one.surface === 'keypad' && one.scan !== undefined);
}

/**
 * One key, one device, across every activity that drives that device.
 *
 * A binding with **no** activity is device mode's own map, if such a thing is ever found in a
 * configuration: none of the fifteen here holds one. It is read as applying everywhere rather than dropped,
 * so the day one turns up it shows.
 */
export function keyAcrossActivities(
  buttons: readonly ButtonBinding[],
  device: number,
  activities: readonly Activity[],
  scan: number,
): KeyAcrossActivities {
  const driving = drivingActivities(activities, device);
  const here = keypadBindings(buttons).filter((one) => one.scan === scan);
  const perActivity: KeyInActivity[] = [];
  for (const activity of driving) {
    // The binding for this activity, or one that names no activity at all, which is device mode's.
    const found = here.find((one) => one.inActivity === activity)
      ?? here.find((one) => one.inActivity === undefined);
    const sends = found?.sends[0];
    if (sends === undefined) perActivity.push({ activity });
    else if (sends.device === device) perActivity.push({ activity, command: sends.command });
    else perActivity.push({ activity, heldBy: sends.device });
  }
  return {
    perActivity,
    writable: perActivity.filter((one) => one.heldBy === undefined).map((one) => one.activity),
    held: perActivity.filter((one) => one.heldBy !== undefined).map((one) => one.activity),
    commands: [...new Set(perActivity
      .filter((one) => one.command !== undefined)
      .map((one) => one.command as number))],
  };
}

/**
 * Which device holds this key on this remote, where no activity driving `device` leaves room for it.
 *
 * Answered off the whole remote rather than off the driving activities, because it is the sentence a page
 * shows when a key cannot be had: whoever has it, that is who has to give it up.
 */
export function heldOnThisRemote(
  buttons: readonly ButtonBinding[], scan: number, device: number,
): number | undefined {
  for (const one of keypadBindings(buttons)) {
    if (one.scan !== scan) continue;
    const owner = one.sends[0]?.device;
    if (owner !== undefined && owner !== device) return owner;
  }
  return undefined;
}

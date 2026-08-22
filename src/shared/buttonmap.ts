/**
 * A device's own button map, which is what device mode is on a Harmony.
 *
 * **Press Devices, pick the television, and every button on the remote drives the television.** That is
 * Logitech's own statement, from the Harmony One manual: "After you select a device, the Harmony One
 * controls only that device." So a device's map is a thing in its own right: one key, one command **of
 * that device**, and no other device anywhere in it.
 *
 * **Activities have nothing to do with it**, and getting that wrong twice is why this docstring is long.
 * An activity's map is the mixed one: it draws on every device you own, volume to the amplifier and
 * channels to the set top box. A device's map draws on one device. They are two maps of the same keypad,
 * authored separately, and Logitech's own software has a page for each, "Changing how buttons work for a
 * device" and "Changing how buttons work in an Activity", named as such in the Harmony 600 manual's
 * contents. So a page about a device says nothing about which activity uses a key, because the answer is
 * not part of the question.
 *
 * **The keypad is the smaller half of a device's map, and the screen is the bigger one.** An old remote has
 * far more buttons than a Harmony does, so what people actually build in device mode is **pages on the
 * screen**, one screenful of commands at a time, to reach the obscure functions the keypad has no room for.
 * That is also why Logitech can say you should hardly ever need device mode and be right: a well set up
 * activity carries what you use often, and device mode is where the rest lives. Nothing here touches the
 * screen pages yet and they are the obvious next thing, `docs/roadmap.md`.
 *
 * **In the model a device map binding is a keypad binding with no activity**, which is the shape
 * `ButtonBinding` already had and documented. Nothing new is invented for it.
 *
 * **A configuration read off a remote holds no device map**, measured over fifteen of them in the sibling
 * repository, `docs/findings.md` section 151: every keypad map that sends a code is one an activity
 * installs. Where the remote keeps its device map is an open question there and must not be guessed at.
 * So an import has nothing to copy, and `seededFromActivities` is what it does instead: an activity's map
 * is the device map plus that activity's overrides, so running that backwards over the activities gives
 * the best reconstruction available. 1096 of 1105 pairs of a device and a key send the same command in
 * every activity that binds them, and the nine that disagree are left unbound rather than decided by a
 * coin toss.
 */
import type { Activity, ButtonBinding } from './content.ts';

/** The keypad bindings of a remote: on the keypad, and with a scan code that can be placed. */
export function keypadBindings(buttons: readonly ButtonBinding[]): readonly ButtonBinding[] {
  return buttons.filter((one) => one.surface === 'keypad' && one.scan !== undefined);
}

/**
 * One device's button map: which command each key sends, by the device's own command position.
 *
 * The bindings with **no activity**, which is device mode's map, filtered to this device. A key that is
 * not in the answer sends nothing for this device, and that is the only other state there is.
 */
export function deviceMap(
  buttons: readonly ButtonBinding[], device: number,
): ReadonlyMap<number, number> {
  const found = new Map<number, number>();
  for (const one of keypadBindings(buttons)) {
    if (one.inActivity !== undefined) continue;
    const step = one.sends[0];
    if (step === undefined || step.device !== device) continue;
    found.set(one.scan as number, step.command);
  }
  return found;
}

/**
 * What a device's map most likely was, reconstructed from the activity maps of an imported configuration.
 *
 * Only for an import, and only for a device that has no map of its own yet. The reasoning is the one in
 * this file's docstring: Logitech's software authored the device map first and each activity took it and
 * overrode what it needed, so where every activity that binds a key agrees, that agreement is the device's
 * own answer. Where they disagree the key is left out, because a device map with a guess in it is worse
 * than one with a hole: a hole can be filled by whoever knows, and a guess cannot be spotted.
 */
export function seededFromActivities(
  buttons: readonly ButtonBinding[], device: number,
): ReadonlyMap<number, number> {
  const said = new Map<number, Set<number>>();
  for (const one of keypadBindings(buttons)) {
    if (one.inActivity === undefined) continue;
    const step = one.sends[0];
    if (step === undefined || step.device !== device) continue;
    const scan = one.scan as number;
    said.set(scan, new Set([...(said.get(scan) ?? []), step.command]));
  }
  const found = new Map<number, number>();
  for (const [scan, commands] of said) {
    if (commands.size === 1) found.set(scan, [...commands][0]!);
  }
  return found;
}

/**
 * Every device map an imported document should start with, as bindings ready to be written.
 *
 * One pass over the whole document rather than one per device, because the answer is a list of bindings
 * and the caller wants them all. Devices that reach nothing contribute nothing.
 */
export function seededDeviceMaps(
  buttons: readonly ButtonBinding[], devices: readonly number[],
): ButtonBinding[] {
  const made: ButtonBinding[] = [];
  for (const device of devices) {
    for (const [scan, command] of seededFromActivities(buttons, device)) {
      made.push({ surface: 'keypad', scan, sends: [{ device, command }] });
    }
  }
  return made;
}

/**
 * Which activities use a device, by their own position, in the document's order.
 *
 * **Not for the keypad**, which is the whole point of the file above. It answers "where is this appliance
 * used on this remote", which is a fact about the appliance and belongs on a page about it; nothing about
 * a key comes from it.
 */
export function activitiesUsing(
  activities: readonly Activity[], device: number,
): readonly number[] {
  return activities.filter((one) => one.devices.includes(device)).map((one) => one.slot);
}

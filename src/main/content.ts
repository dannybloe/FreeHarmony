/**
 * A document's own contents, on disk beside its manifest.
 *
 * **The document is the truth and the configuration is where it came from**, decided on 22 August 2026,
 * and this file is that decision expressed as a file name. Until now the contents were worked out from
 * the configuration bytes on every single look, which was cheap, always consistent, and left nowhere at
 * all for anything a person adds. A television typed in by hand had no place to be.
 *
 * So the projection happens **once**, at the moment of an import, and is written down. From then on this
 * file is what is being edited and the bytes beside it are what the remote said on the day it was read.
 *
 * The price is stated rather than hidden: the two can drift apart. That is already recorded as the known
 * seam in `docs/data-model.md`, and it is the direct consequence of importing rather than synchronising.
 * A document knows when it was imported, so a screen can say how old the agreement is.
 *
 * Every change goes through `editContent`, so there is one writer. Two writers of one file is the state
 * the sibling repository's oldest rule is about, and here it would show up as an edit landing on top of
 * a stale read.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ButtonBinding, RemoteContent } from '../shared/content.ts';
import type { DeviceUsage } from '../shared/library.ts';
import type { RemoteStore } from './store/remotes.ts';

const CONTENT = 'content.json';

function fileFor(store: RemoteStore, name: string): string {
  return join(store.folderOf(name), CONTENT);
}

/**
 * What a document holds, or `undefined` because nothing has been written for it yet.
 *
 * `undefined` has one meaning and it is narrow: **this file is not there**. It does not mean the document
 * is empty and it does not mean the import failed. Callers that have configuration bytes fall back to
 * projecting them, which is what carries the documents written before this file existed; callers that
 * have nothing have nothing.
 */
export async function storedContentOf(
  store: RemoteStore, name: string,
): Promise<RemoteContent | undefined> {
  try {
    return JSON.parse(await readFile(fileFor(store, name), 'utf8')) as RemoteContent;
  } catch {
    return undefined;
  }
}

/**
 * Write a document's contents, whether that is an import landing or an edit being saved.
 *
 * Deliberately not called `save`: there is no dirty state anywhere in this application and adding one
 * would invite a screen that holds unwritten work. Every change is written when it is made.
 */
export async function writeContent(
  store: RemoteStore, name: string, content: RemoteContent,
): Promise<RemoteContent> {
  // `store.get` first, so writing contents for a document that does not exist fails the same way every
  // other operation on a missing document fails, rather than creating a stray file in a folder.
  await store.get(name);
  await writeFile(fileFor(store, name), `${JSON.stringify(content, undefined, 2)}\n`, 'utf8');
  return content;
}

/**
 * Change a document's contents: read, apply, write.
 *
 * The one route every edit takes, which is what makes the read and the write impossible to get out of
 * order.
 *
 * **A document with nothing in it gets contents of its own**, marked `here`, and that is a correction made
 * on 22 August 2026. It used to refuse, on the reasoning that an empty `RemoteContent` is a claim about
 * somebody's equipment and there is nothing to change on a document nobody has imported into. Both halves
 * of that were wrong. The model has `filledFrom` precisely so that contents built here can say so, and the
 * case the refusal blocked is the one the whole arrangement exists for: you import the living room remote,
 * then set up a bedroom one and say it drives the same television. That remote has no configuration and
 * never will until one is compiled for it.
 *
 * Found by being asked what a screenshot was showing, which is worth recording: the picker had nothing
 * useful to offer in the only state it could be photographed in, and the reason was this refusal two
 * layers down.
 */
export async function editContent(
  store: RemoteStore, name: string, change: (content: RemoteContent) => RemoteContent,
): Promise<RemoteContent> {
  const held = await storedContentOf(store, name)
    ?? { devices: [], activities: [], buttons: [], filledFrom: 'here' as const };
  return writeContent(store, name, change(held));
}

/**
 * Put an appliance on a remote: a position, pointing at a description in the library, with a name.
 *
 * **The position is ours now**, and that is the change of meaning `DeviceUse.slot` took on 22 August
 * 2026. It used to be the configuration's own numbering, because that was the only identity a device had
 * in a file somebody else compiled. Now the document is the source and a configuration is what will be
 * built from it, so the numbering belongs here and an import fills it from the file rather than owning
 * it. Three things refer to a position by number, so it has to be stable: a step in an activity, a wanted
 * state, and a button binding.
 *
 * The next free number, and **never the count**, which would collide the moment a position in the middle
 * had been removed. Nothing removes one yet; writing it this way means nothing has to remember to when
 * something does.
 *
 * On a document with nothing in it this is what creates its contents, marked `here` rather than as coming
 * from a configuration. That is the case the arrangement exists for: a second remote that drives the
 * television the first one taught this machine about, before anything has ever been read off it.
 */
export async function addDeviceUse(
  store: RemoteStore, name: string, definition: string, label?: string,
): Promise<RemoteContent> {
  return editContent(store, name, (content) => {
    const taken = content.devices.map((one) => one.slot);
    const slot = taken.length === 0 ? 0 : Math.max(...taken) + 1;
    return {
      ...content,
      devices: [...content.devices, { slot, definition, ...(label === undefined ? {} : { label }) }],
    };
  });
}

/**
 * Every appliance every document uses, with the name that document gives it.
 *
 * **Derived, on every call, and deliberately so.** The alternative is a name on the description itself,
 * which would have to come from whichever remote happened to be imported first and would then be wrong for
 * every other one. The label belongs to the use.
 *
 * It reads every document's contents, which is a handful of small files this application wrote. A document
 * with nothing in it contributes nothing rather than failing, because a machine part way through being set
 * up is the ordinary state and not an error.
 */
export async function deviceUsage(store: RemoteStore): Promise<DeviceUsage[]> {
  const found: DeviceUsage[] = [];
  for (const document of await store.list()) {
    const content = await storedContentOf(store, document.name);
    if (content === undefined) continue;
    for (const use of content.devices) {
      if (use.definition === undefined) continue;
      found.push({
        definition: use.definition,
        remote: document.name,
        ...(use.label === undefined ? {} : { label: use.label }),
      });
    }
  }
  return found;
}

/**
 * Rename a position on a remote, or take its name away.
 *
 * The label belongs to the **use** and not to the description, which is `deviceUsage`'s whole argument
 * above: four identical televisions on four remotes are one description under four names. So this writes
 * a document and touches the library not at all.
 *
 * Absent removes the field rather than storing an empty string, for the reason the library's own create
 * path gives: an empty string satisfies every presence test and then renders as nothing, which is a name
 * that looks set and is not. With no label the interface shows the library's name, which is the whole
 * point of a label being optional.
 */
export async function labelDeviceUse(
  store: RemoteStore, name: string, slot: number, label?: string,
): Promise<RemoteContent> {
  const wanted = label?.trim();
  return editContent(store, name, (content) => {
    if (!content.devices.some((one) => one.slot === slot)) {
      throw new Error(`${name} has nothing at position ${slot + 1}`);
    }
    return {
      ...content,
      devices: content.devices.map((one) => {
        if (one.slot !== slot) return one;
        const { label: _gone, ...rest } = one;
        return wanted === undefined || wanted === '' ? rest : { ...rest, label: wanted };
      }),
    };
  });
}

/**
 * Point a key on the keypad at one command of this device, or clear it.
 *
 * **This writes the device's own button map, which is what device mode is on a Harmony**: press Devices,
 * pick the television, and every key drives the television. One key, one command of **this** device, and
 * nothing else in it. `CLAUDE.md`'s first section is the operating concept and `shared/buttonmap.ts` is
 * the shape.
 *
 * **Activities do not come into it, and that was got wrong twice.** The first version showed and wrote one
 * activity's map, which is a different map of the same keypad. The second wrote every activity that drives
 * the device, refused where another device held the key, and reported which activities it had reached, all
 * of which is the activity map's business and none of it belongs to a device. An activity draws on every
 * device you own; a device draws on itself.
 *
 * So there is one binding per key here, it carries no activity, and it can only be refused for reasons
 * about **this** document: no such position, and nothing else. There is no other device to be in the way,
 * because in this map there is no other device.
 *
 * `command` absent clears the binding rather than writing an empty one, because a key that sends nothing
 * and a key with a binding that sends nothing are the same thing to a remote and only one is honest.
 *
 * Whether a model's key 12 exists at all is the drawing's business and not this one's, which is the same
 * division of labour as before: only 36 of a Harmony 600's 54 keys have a measured scan code.
 */
export async function assignButton(
  store: RemoteStore, name: string, scan: number, device: number, command?: number,
): Promise<RemoteContent> {
  return editContent(store, name, (held) => {
    if (!held.devices.some((one) => one.slot === device)) {
      throw new Error(`${name} has nothing at position ${device + 1}`);
    }
    // This device's own binding for this key, if there is one. An activity binding on the same key is a
    // different map and is left exactly as it is.
    const mine = (one: ButtonBinding) =>
      one.surface === 'keypad' && one.scan === scan && one.inActivity === undefined
      && one.sends[0]?.device === device;
    const rest = held.buttons.filter((one) => !mine(one));
    if (command === undefined) return { ...held, buttons: rest };
    // The label is carried where there was one, since it is a word the generator drew and not something
    // this application has any business inventing.
    const label = held.buttons.find(mine)?.label;
    const added: ButtonBinding = {
      surface: 'keypad',
      scan,
      ...(label === undefined ? {} : { label }),
      sends: [{ device, command }],
    };
    return { ...held, buttons: [...rest, added] };
  });
}

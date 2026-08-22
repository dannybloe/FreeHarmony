/**
 * The two library operations that are not the store's business: making one by hand, and copying one.
 *
 * Both are composed out of `DeviceLibrary`'s own `get` and `put`, so the store keeps exactly the shape it
 * has: read a file, write a file, refuse an identifier that is not a usable file name. Putting a `create`
 * or a `clone` in there would put a policy about identities and origins inside the thing that only knows
 * about files.
 */
import { randomBytes } from 'node:crypto';

import type { CommandFrame, CommandNaming } from '../shared/api.ts';
import type { DeviceDefinition, DeviceDraft } from '../shared/library.ts';
import { frameOf } from './frames.ts';
import type { DeviceLibrary } from './store/library.ts';

/**
 * Write down an appliance somebody typed in.
 *
 * `origin` is `'typed-here'`, which is a fourth value rather than the nearest of the three that existed.
 * Filling in `learned-here` would have been the easy shortcut and it would have put a falsehood in the
 * one field this model says cannot be repaired afterwards: nothing was learned from any hardware, so
 * `mayBeShared` is false and stays false.
 *
 * **The identifier is random and that is the interesting decision.** Everything imported is addressed by
 * the digest of its own codes, which is what makes the same television on three remotes one description.
 * A hand typed appliance has no codes, so there is nothing to address it by, and the two candidates that
 * suggest themselves are both wrong:
 *
 *   - the lowest free number, which **reuses** an identifier after a delete. A document still naming the
 *     old one would then quietly be pointing at a different appliance, which is precisely the class of
 *     silent wrongness this application is built to refuse
 *   - a digest of the typed words, which would make two amplifiers nobody has distinguished yet one row,
 *     and would change identity the moment somebody fixed a spelling
 *
 * So it is random, it is never reused, and it never changes. The price is real and it is worth stating:
 * teach codes to a hand typed appliance and it keeps this identifier, so an import of the same codes
 * elsewhere creates a **second** description of one appliance. That is what `likelyDuplicates` is for,
 * which groups by fingerprint and reports rather than merges.
 */
export async function createDefinition(
  library: DeviceLibrary, draft: DeviceDraft, now: string,
): Promise<DeviceDefinition> {
  return library.put({
    id: `appliance-typed-${randomBytes(6).toString('hex')}`,
    ...cleaned(draft),
    kind: draft.kind,
    commands: [],
    properties: [],
    timing: {},
    origin: 'typed-here',
    addedAt: now,
  });
}

/**
 * A second description of the same appliance, with a fresh identifier and everything else carried over.
 *
 * This is what the appliance's own `name` was added for, and it is the case the shared library creates
 * rather than solves: two televisions of one model, one of them with its sound going through an
 * amplifier. They send the same codes, so an import makes them one description, and telling them apart
 * has to be somebody's deliberate act.
 *
 * **The origin is carried, not restamped.** A copy of a description learned from real hardware is still a
 * description of what that hardware sends, so it keeps `learned-here` and stays shareable; a copy of a
 * Logitech entry stays unshareable. Stamping `'typed-here'` here would lose a true provenance, and
 * stamping the original's date is what `addedAt` already does by being copied: it says when this
 * appliance was described, and a copy describes the same appliance.
 */
export async function cloneDefinition(
  library: DeviceLibrary, id: string, name?: string,
): Promise<DeviceDefinition> {
  const original = await library.get(id);
  return library.put({
    ...original,
    id: `appliance-copy-${randomBytes(6).toString('hex')}`,
    ...(name === undefined || name === '' ? {} : { name }),
  });
}

/**
 * The typed words, with the empty ones left out rather than stored as `''`.
 *
 * A form hands back an empty string for a field nobody filled in, and an empty string is not the same as
 * an absence: `describeDefinition` falls back through these, and a stored `''` would satisfy a presence
 * test and then render as nothing. So the boundary between the form and the model is where they go.
 */
function cleaned(draft: DeviceDraft): Partial<DeviceDefinition> {
  const kept: Record<string, string> = {};
  for (const field of ['name', 'manufacturer', 'model'] as const) {
    const value = draft[field]?.trim();
    if (value !== undefined && value !== '') kept[field] = value;
  }
  return kept;
}

/**
 * Name commands, or take names away.
 *
 * Read, change the named elements, write, which is `create` and `clone`'s shape and is here for the same
 * reason: the store knows about files and this knows what an edit means. **The narrowness is the safety.**
 * The only field it can touch is `name`, so nothing it does can move an identifier, change a code, or
 * reorder a list that every document's button bindings point into by position.
 *
 * One read and one write however many names arrive, which is the point of taking a list: the page offers to
 * accept every word the remote already draws for an appliance, and on a real television that is 37 of 81.
 *
 * An empty or blank name **removes** it rather than storing `''`, which is the same rule the typed fields
 * follow: a field that satisfies every presence test and renders as nothing is a field that looks filled
 * in. And it is a real thing to want, since the way to undo a name typed by mistake is to clear it.
 *
 * A position nobody has is refused rather than ignored, and it refuses the **whole** call: a silent no-op
 * would show as a name that would not stick, and a partial write would leave nobody able to say which half
 * landed.
 */
export async function nameCommands(
  library: DeviceLibrary, id: string, names: readonly CommandNaming[],
): Promise<DeviceDefinition> {
  const held = await library.get(id);
  for (const naming of names) {
    if (!held.commands.some((one) => one.slot === naming.slot)) {
      throw new Error(`${id} has no command at position ${naming.slot + 1}`);
    }
  }
  // The last entry for a position wins, which only matters for a caller that sent one twice. Building the
  // map up front is also what keeps this one pass over the commands rather than one per name.
  const wanted = new Map(names.map((one) => [one.slot, one.name?.trim() ?? '']));
  return library.put({
    ...held,
    commands: held.commands.map((one) => {
      const to = wanted.get(one.slot);
      if (to === undefined) return one;
      const { name: _was, ...rest } = one;
      return to === '' ? rest : { ...rest, name: to };
    }),
  });
}

/** Every command of one appliance that reads as a frame, with the ones that do not left out. */
export async function framesOfDefinition(
  library: DeviceLibrary, id: string,
): Promise<CommandFrame[]> {
  const held = await library.get(id);
  const out: CommandFrame[] = [];
  for (const command of held.commands) {
    const found = frameOf(command.signal);
    if (found !== undefined) out.push({ slot: command.slot, ...found });
  }
  return out;
}

/**
 * The bit frame a command's pulses encode, which is the only thing two catalogues can be compared on.
 *
 * **Why this is worth having.** An infrared command is a lamp blinking in a precise rhythm, and a
 * configuration stores that rhythm as a list of durations. Two rhythms can be compared to each other and
 * to nothing else: either they are identical or they tell you nothing. The **frame** is the number the
 * appliance actually reads out of that rhythm, and a number can be compared with a number written down
 * somewhere else, which is what lets a catalogue's names be carried onto codes read off a remote.
 *
 * **The decoder is next door and stays there.** `framesOfPulses` in `@harmony/codec` is it, and this file
 * is the adapter from our model's shape to its. That is the whole content of this file on purpose: the
 * decoder took two attempts to get right in that repository and a copy of it here would be a second thing
 * to keep right.
 *
 * **This is the second file in this repository that imports the codec**, after `src/main/import.ts`, whose
 * docstring used to claim it was the only one. Both are in the main process for the same reason: the shared
 * model is plain data with no library behind it, so anything that reads a byte or a duration sits on this
 * side of that line.
 *
 * A frame is **derived and never stored**. `import.ts` says why at the point where it declines to store
 * one: a frame a catalogue stated and a frame we decoded ourselves are different claims, and a store that
 * holds both in one field loses the difference. So it is computed where it is needed, which is cheap.
 */
import { blockOfStatedCode, framesOfPulses } from '@harmony/codec';

import type { InfraredSignal, Pulse } from '../shared/library.ts';

export interface Frame {
  readonly bits: number;
  /** The frame itself, lower case hexadecimal, which is how `frame` is spelled in the model. */
  readonly frame: string;
}

/**
 * What one command's press sends, as a frame, or nothing where it does not read as one.
 *
 * **`once` and not `held`**, because that is the block that goes out on the press and carries the code; a
 * held block is the protocol's repeat and a tail is the closing silence.
 *
 * **Ambiguity is refused rather than resolved.** Consumer infrared puts a bit in the length of one half of
 * a mark and space pair, and which half is the protocol's business, so a train can read as a frame under
 * both conventions. In the corpus next door that is 148 records of 4630, all of them a shape whose second
 * pointer group makes them a special case. A caller comparing against a catalogue must not be handed one
 * of two candidate numbers, so it is handed none.
 */
export function frameOf(signal: InfraredSignal): Frame | undefined {
  // A frame the source stated wins over one decoded from durations, since the source knew the protocol
  // and this only knows the rhythm. That is the case for anything fetched from a catalogue.
  if (signal.bits !== undefined && signal.frame !== undefined) {
    return { bits: signal.bits, frame: signal.frame.toLowerCase() };
  }
  if (signal.once === undefined) return undefined;
  const readings = framesOfPulses(signal.once.map((one) => ({ mark: one.mark, us: one.us })));
  if (readings.length !== 1) return undefined;
  const only = readings[0]!;
  return { bits: only.bits, frame: only.value.toString(16) };
}

/** The key a lookup against another catalogue uses: a frame is only comparable with its own bit count. */
export function frameKeyOf(signal: InfraredSignal): string | undefined {
  const found = frameOf(signal);
  return found === undefined ? undefined : `${found.bits}:${found.frame}`;
}

/**
 * What one command sends, as pulses: the stored block where one was measured, else derived from the
 * code the catalogue states.
 *
 * **The other direction from `frameOf` above, and the reason both live in this file**: it is the
 * adapter to the one codec, and a second reading of either direction is the thing the sibling
 * repository's oldest rule forbids. The stored block wins because a measurement outranks a table: a
 * learned code has pulses and no notation, a catalogue code has notation and no pulses, and a
 * definition may hold both.
 *
 * A signal with neither comes back `undefined`, and that refusal is the model's own rail: a command
 * that cannot say what it sends must not be composed into a configuration as a device that sends
 * nothing. The derivation itself is next door, measured per protocol family off Logitech's own
 * compiler, and a family the rhythm table cannot emit refuses there for the same reason.
 *
 * `held` is what repeats while the key is down. Whether a given command repeats at all is a fact the
 * catalogue does not state, phase 4's audit names it, so a caller asking for `held` gets the family's
 * repeat block and decides for itself whether this command uses one.
 */
export function pulsesOf(
  signal: InfraredSignal, which: 'once' | 'held' = 'once',
): readonly Pulse[] | undefined {
  const stored = which === 'held' ? signal.held : signal.once;
  if (stored !== undefined) return stored;
  if (signal.stated === undefined) return undefined;
  return blockOfStatedCode(signal.stated, undefined, which);
}

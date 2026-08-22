/**
 * A device out of Logitech's catalogue, as one of ours.
 *
 * **What arrives is names and numbers, not signals**, and that decides everything here. Logitech stores a
 * protocol family and a frame value per command, never the pulses: `Raw` was null on all 419 commands
 * fetched across six devices. Turning `Sony 12 Bit` and `0x910` back into a rhythm a lamp can blink needs
 * an encoder per family, which nothing in this project has.
 *
 * So a definition made here **cannot send anything**, and saying that plainly is the point of this file.
 * It is worth having for exactly one reason: it is a list of Logitech's own words attached to Logitech's
 * own codes, which is what lets the nameless codes on somebody's remote be recognised.
 *
 * `origin` is `from-logitech`, so `mayBeShared` is false. Not out of caution: this is somebody else's
 * database and none of it was measured here.
 */
import { randomBytes } from 'node:crypto';

import type { DeviceCommand, DeviceDefinition, DeviceKind } from '../../shared/library.ts';
import { KINDS } from '../../shared/library.ts';
import type { CatalogueCommand, CatalogueDevice } from './client.ts';

/**
 * One catalogue device with its commands, as a definition this application can hold.
 *
 * **The identifier is random**, for the reason `createDefinition` gives at length: the identifier of an
 * imported appliance is the digest of the codes it sends, and this one sends nothing, so there is nothing
 * to address it by. A digest of the manufacturer and model would look tidy and would change identity the
 * day somebody corrected a spelling.
 *
 * The name is left **unset** and the manufacturer and model carry Logitech's own spelling. That is what
 * `describeDefinition` wants: it reads the make and the model where nobody has typed a name, so "Sony
 * KDL-32W705B" appears without this having to compose it, and a name of somebody's own still wins later.
 */
export function asDefinition(
  device: CatalogueDevice, commands: readonly CatalogueCommand[], now: string,
): DeviceDefinition {
  return {
    id: `appliance-logitech-${randomBytes(6).toString('hex')}`,
    kind: asKind(device.kind),
    ...(device.manufacturer === '' ? {} : { manufacturer: device.manufacturer }),
    ...(device.model === '' ? {} : { model: device.model }),
    commands: commands.map(asCommand),
    // Neither of these is in what the catalogue hands over. Inputs are a separate call of Logitech's and
    // the switching delays are another, and both are a later step: an empty list here is "not fetched"
    // rather than "this appliance has none", and the page that shows them does not exist yet.
    properties: [],
    timing: {},
    origin: 'from-logitech',
    addedAt: now,
  };
}

/**
 * One command: the word, and the code as a claim rather than as something sendable.
 *
 * `signal` carries the protocol, the bit count and the frame, and **no pulses at all**, which is exactly
 * the half of `InfraredSignal` that exists for this. A reader that needs to send has to check for `once`
 * and find it missing, which is the honest failure: the alternative is inventing a rhythm.
 *
 * The position is the position in the list Logitech returned. It has no meaning outside this definition,
 * which is true of every definition here: a document refers to a command by where it sits.
 */
function asCommand(command: CatalogueCommand, slot: number): DeviceCommand {
  return {
    slot,
    name: command.name,
    signal: {
      ...(command.protocol === undefined ? {} : { protocol: command.protocol }),
      ...(command.bits === undefined ? {} : { bits: command.bits }),
      ...(command.frame === undefined ? {} : { frame: command.frame }),
    },
    origin: 'from-logitech',
  };
}

/**
 * Their category as ours, with anything unrecognised becoming `other`.
 *
 * The check is against `KINDS` rather than a cast, because the table it reads from is a plain record of
 * numbers to strings and a typo in it would otherwise become a category no screen can draw.
 */
function asKind(kind: string): DeviceKind {
  return (KINDS as readonly string[]).includes(kind) ? (kind as DeviceKind) : 'other';
}

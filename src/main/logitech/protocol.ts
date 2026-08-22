/**
 * Logitech's own service, as facts: where it lives, what it is called, and the shapes it answers in.
 *
 * **Why this is worth having at all.** A command read off somebody's remote is a rhythm and a position in
 * a list, and nothing in the file says it is the volume. Logitech's database does say, because their
 * software is what compiled that file in the first place, and the service is **still answering**: measured
 * on 12 and 13 August 2026 from the bench, and again by this client. It is also the one source here that
 * can disappear without notice, which is why nothing depends on it and everything works without it.
 *
 * Everything below is either an operation name lifted out of Logitech's own decompiled client or a shape
 * observed in a real reply. Both are facts about somebody else's service, so both are recorded here rather
 * than inferred at the call site, and the traps are in the comments because each of them cost a round of
 * requests to find.
 *
 * The whole surface used is **three reads**. No compile, no sync, no write of any kind: the account holds
 * configurations that are evidence, and the operation that queues a compile is one call away from these.
 */

/** The host. One host for the whole platform, and each service is a path under it. */
const SVCS = 'https://svcs.myharmony.com';

/**
 * The two services this needs, of the fifty the platform advertises.
 *
 * The endpoints end in `.svc`, which means WCF and reads to anyone who has met it as an invitation to
 * build a SOAP envelope. **It is JSON**: the `json/` at the end of each path is the variant Logitech's own
 * client uses, and that client contains the string "soap" exactly zero times. So a request is a URL and a
 * body, with no schema, no generator and no dependency.
 */
export const SECURITY = `${SVCS}/CompositeSecurityServices/Security.svc/json/`;
export const DEVICES = `${SVCS}/HarmonyPlatform/DeviceManager.svc/json/`;

/**
 * How a device is looked up, and the field name is the trap.
 *
 * **It is `manufacturer`, not `manufacturerName`.** WCF silently ignores a field it does not know, so a
 * wrong spelling answers `200` with no matches, which is indistinguishable from a device the database has
 * never heard of. Six searches were spent on that before a neighbouring operation happened to complain
 * "Manufacturer can not be null." and named the field. Anything added here is measured, never guessed.
 *
 * `deviceType` 0 is Unknown, which the service treats as "any", and that is what this sends: the category
 * somebody picked in this application is our vocabulary and Logitech's has sixty values in it, so
 * narrowing the search by a mapping of ours would hide real answers. The category comes back in the reply
 * and is translated then.
 *
 * `searchType` is **one based** and 1 is an exact match. Its other values are Logitech's own fuzzy ladder,
 * "did you mean", "close match", "last chance", and they are deliberately not used: a fuzzy match returns
 * a device that is not the one asked for, and this application would then hand somebody a description of
 * the wrong equipment with no way to tell.
 */
export const SEARCH_EXACT = 1;
export const ANY_DEVICE_TYPE = 0;

/**
 * Logitech's device categories, as far as they map onto ours.
 *
 * Their enumeration has sixty values and ours has nine, so this is deliberately lossy in one direction
 * only: it reads their answer and never writes their request. Everything unlisted becomes `other`, which
 * is honest and correctable, where a guess at "which of our nine is a Laserdisc player" would be neither.
 *
 * The numbers are from `DeviceType` in their own client. They are not contiguous and never were.
 */
export const CATEGORY_OF_DEVICE_TYPE: Readonly<Record<number, string>> = {
  1: 'television',
  37: 'television', // TVDVD
  38: 'television', // TVDVDVCR
  48: 'television', // TVHDD
  15: 'television', // TVVCR
  13: 'television', // Monitor
  7: 'television', // Projector
  5: 'receiver', // StereoReceiver
  19: 'receiver', // Amplifier
  30: 'receiver', // AudioVideoSwitch
  14: 'set-top-box', // CableBox
  12: 'set-top-box', // DigitalSetTopBox
  16: 'set-top-box', // Satellite
  51: 'set-top-box', // AppleTV
  52: 'set-top-box', // Roku
  63: 'player', // MediaPlayer
  4: 'player', // DVD
  3: 'player', // CDPlayer
  11: 'player', // CDJukebox
  28: 'player', // LaserdiscPlayer
  29: 'player', // MinidiscPlayer
  33: 'player', // DigitalMusicServer
  36: 'player', // RadioTuner
  2: 'recorder', // VCR
  18: 'recorder', // PVR
  34: 'recorder', // DVDRecorder
  25: 'recorder', // DVDVCR
  47: 'recorder', // DVDRVCR
  6: 'recorder', // TapeDeck
  20: 'recorder', // DAT
  9: 'game-console',
  23: 'game-console', // GameConsoleWithDvd
  8: 'computer',
  10: 'computer', // Laptop
  35: 'computer', // MediaCenterPC
  53: 'computer', // PCTV
  24: 'lighting', // LightController
  67: 'lighting', // Dimmer
};

/**
 * What a command's code looks like, and what it does **not** contain.
 *
 * `G:Sony 12 Bit:()(0x910)():3`. A protocol family and a frame value, and that is the whole of it: `Raw`
 * was null on all 419 commands fetched across six devices, and `IsLearned` false on every one. So Logitech
 * stores a protocol plus a number and the pulse blocks a configuration holds are the **compiled** form of
 * that, produced by their own server.
 *
 * **Which means a name can be carried across and a code cannot.** Turning `Sony 12 Bit` and `0x910` back
 * into a rhythm needs an encoder per protocol family, which nothing here has and which is a real piece of
 * work: six devices gave nine distinct family names. So a device fetched from here is a list of **named
 * codes we cannot send**, and it is useful for exactly one thing, which is putting words on the codes a
 * remote already has.
 *
 * **The value is in transmission order, which is the same order our own decoder produces**, and that is
 * measured rather than assumed. 52 of the 58 commands Logitech states for one Panasonic television are
 * byte for byte equal to a frame decoded out of the configuration on the bench Harmony 600, on a
 * **different** model of the same family, so a name can be carried across by comparing numbers and nothing
 * has to be turned round first.
 *
 * That corrects a claim written here earlier the same day, taken from the sibling repository: that the
 * values are bit reversed, on the evidence of the Sony digits, where 1 is `0x010`, 2 is `0x810` and 3 is
 * `0x410`. Those really are reversed, and what they are reversed relative to is the **logical** digit,
 * because Sony's protocol transmits least significant bit first. Our decoder reads the order the pulses
 * arrive in, so it produces `0x010` for that digit as well. Reversed relative to a command number,
 * unreversed relative to a rhythm, and only the second matters here.
 *
 * Established on one 48 bit family. Whether every family agrees is not established, which is why anything
 * built on this states its evidence: a family whose order differs would produce no matches rather than
 * wrong ones, since a frame either equals another frame or does not.
 */
const KEY_CODE = /^G:([^:]+):\(\)\(0x([0-9A-Fa-f]+)\)\(\)/;

export interface StatedCode {
  readonly protocol: string;
  /** From the family name, where it states one, since the value alone cannot say how wide it is. */
  readonly bits?: number;
  /** Lower case hexadecimal, no prefix, as `frame` is spelled in our own model. */
  readonly frame: string;
}

/** One command's code, or nothing where the string is not the shape above. */
export function statedCode(keyCode: string | null | undefined): StatedCode | undefined {
  if (typeof keyCode !== 'string') return undefined;
  const found = KEY_CODE.exec(keyCode);
  if (found === null) return undefined;
  const protocol = found[1]!.trim();
  // "Sony 12 Bit" and "Sharp 48 Bit 2" both state a width; a family that does not is left without one
  // rather than given a width counted off the hexadecimal, which would be wrong by up to three bits.
  const width = /(\d+)\s*Bit/i.exec(protocol);
  return {
    protocol,
    ...(width === null ? {} : { bits: Number(width[1]) }),
    frame: found[2]!.toLowerCase(),
  };
}

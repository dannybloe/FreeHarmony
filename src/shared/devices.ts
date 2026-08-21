/**
 * What the window is told about the remotes plugged into this computer.
 *
 * **Enumeration only.** Everything in this file comes from asking the operating system what is on the
 * USB bus, which is a question that opens nothing and claims nothing. Opening a remote is a separate
 * step with its own reasons, because it takes the device away from anything else and starts a
 * conversation with hardware nobody can replace.
 *
 * Plain data, like everything crossing the bridge, and deliberately thin: this is enough to say which
 * model is attached and to create a document for it, which is the whole scope of this round.
 */
import type { RemoteModel } from './remote.ts';

export interface AttachedRemote {
  /**
   * The USB product id, `0xc121` and the like.
   *
   * Not an identity: every remote of one model reports the same one. It is here because it is what
   * `openHarmony` selects on later, and because it is the only thing left to show when a remote
   * reports nothing this application recognises.
   */
  readonly productId: number;
  /**
   * The skin the remote states through `bcdDevice`, which is what names its keypad.
   *
   * Absent where the field carries no skin. A skin can also be present and name nothing, which is a
   * different case and the reason this is separate from `model`.
   */
  readonly skin?: number;
  /**
   * What this remote is, ready to be stored on a document, or absent when nothing names the skin.
   *
   * Absent is the ordinary case for most of the forty retired models rather than a fault, and the
   * interface has to handle it: somebody's remote is attached, recognised as a Harmony, and cannot be
   * named by us. Naming it after the nearest guess would put a wrong model in their documents.
   */
  readonly model?: RemoteModel;
  /**
   * What the device calls itself in its USB descriptor.
   *
   * The remote's own word rather than ours, so it is worth showing when `model` is absent, and worth
   * distrusting otherwise: it is a string a manufacturer chose, not a fact about the hardware.
   */
  readonly product?: string;
}

/**
 * What a remote said about itself when it was asked, which is a description and **not** an identity.
 *
 * The naming is deliberate and it was the second name this type had. Calling it an identity would be
 * exactly the overclaim this application is careful about elsewhere: every field below is a property of
 * the **model** or of the firmware installed on it, so two Harmony Ones with the same firmware produce
 * identical readings. What genuinely identifies a unit is three GUIDs in the remote's internal flash,
 * which nothing here reads.
 *
 * It comes from one `GET_VERSION`, which is the only command sent, and it is read by `readVersion` in
 * `@harmony/usb` rather than by anything here: interpreting a protocol reply is the library's job. Six
 * of the twelve fields have a reading, established by prediction and confirmed on three architectures,
 * and `versionBlock` carries every byte so nothing this reading does not cover is thrown away.
 */
export interface HardwareReading {
  /** When it was read. ISO 8601. A reading is about a moment: firmware gets updated. */
  readonly readAt: string;
  /** Field 0 as two nibbles, `3.4`. */
  readonly firmware: string;
  /** Field 1 the same way. `concordance -i` calls it the board version. */
  readonly hardware: string;
  /** Fields 3 and 2, manufacturer first, `1F:C8`. */
  readonly flash: string;
  /** The architecture the remote itself states, which decides which address rules apply. */
  readonly architecture: number;
  /** The skin, which `bcdDevice` states independently, so the two are a check on each other. */
  readonly skin: number;
  /** 0 in normal operation, 4 in safe mode. Logitech's own values. */
  readonly softwareType: number;
  /** Logitech's own word for that value, absent for one nobody has seen. */
  readonly softwareTypeName?: string;
  /** A platform rather than an architecture: arch 12 and arch 14 share it. */
  readonly platform: number;
  /**
   * Every byte of the version block, lowercase hex, no separators.
   *
   * Hex rather than an array of numbers because this ends up in a manifest somebody can open, and
   * `"3405c81fc0360c3434163434"` is readable where twelve JSON numbers on twelve lines are not. It is
   * here at all so that the six fields above are never the only record of what the remote said.
   */
  readonly versionBlock: string;
}

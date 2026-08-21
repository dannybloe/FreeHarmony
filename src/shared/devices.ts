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

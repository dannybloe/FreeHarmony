/**
 * Which remotes are plugged in, answered without opening any of them.
 *
 * **This is the first file in FreeHarmony that touches USB at all**, and what it does is the smallest
 * thing that counts as touching it: it asks the operating system for its list of HID devices. Nothing
 * here claims a device, sends a command, or reads a byte off anybody's remote.
 *
 * That distinction is the sibling repository's rule and it is worth restating where it first applies.
 * `listHarmony` looks; `openHarmony` claims. A remote is irreplaceable, and the write rails that
 * protect one live in `@harmony/usb` in this process, so the window is never given a route to a
 * device except the answers below.
 *
 * The import is static and that is safe: `@harmony/usb` loads `node-hid` **dynamically**, inside
 * `listHarmony`, precisely so that importing the library does not pull a native binding into a
 * process that may never need one. Measured before this file was written: the binding does load under
 * Electron 43's own ABI with no rebuild, which was the one real risk in this step.
 */
import { listHarmony, skinId } from '@harmony/usb';

import type { AttachedRemote } from '../shared/devices.ts';
import { remoteModelForSkin } from '../shared/models.ts';

/**
 * Every attached Harmony, as plain data the window can be told.
 *
 * **A failure to enumerate is allowed to reach the window**, and the first version of this function
 * swallowed it into an empty array on the reasoning that a page waiting for a cable has nothing useful
 * to say about a fault. That was wrong twice. It made the view model's `failed` state unreachable, so
 * the amber note on the Connect page was dead code and the test asserting it was testing a fake. And it
 * made an empty answer mean two things at once, which is precisely what nothing outside this process
 * can then tell apart: a bus with nothing on it, and a native binding that would not load.
 *
 * So the failure crosses, the page says it could not look, and an empty array means an empty bus.
 *
 * The serial number is dropped on the far side, in `listHarmony`, and not by this file. Worth knowing
 * rather than rediscovering: it identifies a unit rather than a model, so nothing upstream of here has
 * one to leak.
 */
export async function attachedRemotes(): Promise<AttachedRemote[]> {
  return (await listHarmony()).map((device) => {
    const skin = device.release === undefined ? undefined : skinId(device.release);
    const model = remoteModelForSkin(skin);
    return {
      productId: device.productId,
      ...(skin === undefined ? {} : { skin }),
      ...(model === undefined ? {} : { model }),
      ...(device.product === undefined ? {} : { product: device.product }),
    };
  });
}

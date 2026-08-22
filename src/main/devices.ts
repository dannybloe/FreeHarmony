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
import { HarmonyRemote, listHarmony, openHarmony, readVersion, skinId } from '@harmony/usb';

/**
 * The product id a pretended remote reports.
 *
 * A real one, `0xc121`, because the value has to reach `profileFor` on the other side and a made up
 * number would be refused there for the wrong reason. It selects a **model** and never a unit, so it
 * identifies nothing either way.
 */
const PRETEND_PRODUCT_ID = 0xc121;

import type { AttachedRemote, HardwareReading } from '../shared/devices.ts';
import { remoteModelForSkin } from '../shared/models.ts';
import { pretence, pretendedEnumeration } from './pretend.ts';

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
  // The seam, per `pretend.ts`: with it set there is nothing on the bus to enumerate, so the import
  // dialogue would be unreachable and the screen it shows would be designed by guessing. Off unless an
  // environment variable names a configuration file, and the half that writes refuses such a reading.
  const faking = pretence();
  if (faking !== undefined) {
    const { skin } = pretendedEnumeration(faking);
    const model = remoteModelForSkin(skin);
    return [{
      productId: PRETEND_PRODUCT_ID,
      ...(skin === undefined ? {} : { skin }),
      ...(model === undefined ? {} : { model }),
    }];
  }

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

/**
 * Ask one remote what it is, which means **opening it**, and that is what separates this from
 * everything above.
 *
 * `listHarmony` looks at a bus. This claims a device: it takes it away from anything else on the
 * machine and starts a conversation with hardware nobody can replace. It is the first thing FreeHarmony
 * does that has that weight, so five things about it are deliberate rather than incidental:
 *
 *   - **One command, `GET_VERSION`.** No flash is read, nothing is written, and no other command is
 *     sent. In particular no `READ_FLASH`, so the odd length read that hangs a remote is not in reach.
 *   - **It is never called on a timer.** The Connect page polls enumeration; this runs when somebody
 *     asks for it, once. A page that opened a device every second would be a page nobody should ship.
 *   - **The handle is closed in a `finally`**, so a reply that never arrives still leaves the device to
 *     whatever asks next. A clean read only session does not strand a remote, measured three times out
 *     of three on the bench next door, and leaving a handle open is the one way to spoil that.
 *   - **Nothing is sent at the end.** USB mode's exit is gated on a command state variable being zero
 *     and a completed command clears its own, so a session that simply stops leaves the gate open.
 *   - **The reading is the library's**, `readVersion`, not ours. Interpreting a reply is
 *     `@harmony/usb`'s job and a second reading of those fields here is the split the two repositories
 *     exist to prevent.
 *
 * The selector is a product id, which names a **model** and not a unit, so this refuses rather than
 * guesses when two of one model are attached: `openHarmony` will not choose between them. The caller is
 * expected to have established that there is one, which `theRecognisedOne` does.
 */
export async function readHardware(productId: number, now: () => string): Promise<HardwareReading> {
  const remote = new HarmonyRemote(await openHarmony({ productId }));
  try {
    const reading = readVersion(await remote.getVersion());
    return {
      readAt: now(),
      firmware: reading.firmware,
      hardware: reading.hardware,
      flash: reading.flash,
      architecture: reading.architecture,
      skin: reading.skin,
      softwareType: reading.softwareType,
      ...(reading.softwareTypeName === undefined ? {} : { softwareTypeName: reading.softwareTypeName }),
      platform: reading.platform,
      versionBlock: Array.from(reading.fields, (byte) => byte.toString(16).padStart(2, '0')).join(''),
    };
  } finally {
    await remote.close();
  }
}

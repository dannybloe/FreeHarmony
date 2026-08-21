/**
 * How a skin becomes a model somebody can read, and the one place that spelling is decided.
 *
 * Logitech's own table next door spells a model bare: `One`, `525`, `600`. A drawing spells it in
 * full: `Harmony One`. Both are right and having both is the problem, because a remote picked from
 * the chooser would then be stored as `Harmony One` and the same remote read over USB as `One`, which
 * is one piece of hardware under two names in one list. So the full spelling is derived here, once,
 * from the table, and `test/models.test.ts` asserts every drawing's own label agrees with it. Two
 * copies with a check between them is what this project does when a copy cannot be removed.
 *
 * It imports the model table through its **subpath**, which is a table with no imports at all, rather
 * than through `@harmony/usb`, whose main entry pulls in the HID transport. That is what lets this
 * file be used by the window as well as by the main process.
 */
import { MODELS_BY_SKIN, SKINS_WITHOUT_A_MODEL_RECORD } from '@harmony/usb/models';

import type { RemoteModel } from './remote.ts';

/**
 * The names in Logitech's table that are somebody else's brand, and therefore keep their own.
 *
 * Written out rather than inferred, because no rule about the string can tell `Olive` from `One`:
 * both are a word where every other entry is a number. 21 of the 76 names the two tables hold begin
 * with one of these, and `test/models.test.ts` asserts that count, so a name added upstream that
 * belongs here fails rather than appearing as `Harmony Monster AVL 300`.
 *
 * `RF Wireless Extender` is in the list for a different reason than the rest: it is Logitech's, and
 * it is not a remote at all, so calling it a Harmony would be wrong in a way a brand never is.
 */
export const NOT_CALLED_HARMONY: readonly string[] = [
  'Harman Kardon',
  'Logitech Revue',
  'Monster',
  'Olive',
  'RF Wireless Extender',
  'Telus',
  'Xbox',
];

/** The name to show and to store, from Logitech's own bare spelling. */
export function fullName(bare: string): string {
  return NOT_CALLED_HARMONY.some((brand) => bare.startsWith(brand)) ? bare : `Harmony ${bare}`;
}

/**
 * What to store on a document for a remote reporting this skin, or `undefined` when nothing names it.
 *
 * Both of Logitech's tables are consulted, and the difference between them is deliberately **not**
 * carried here. `MODELS_BY_SKIN` has a full capability record and `SKINS_WITHOUT_A_MODEL_RECORD` has
 * only a name, but a document needs only the name and the skin, so a remote in the second table gets
 * a document exactly as good as one in the first. What it does not get is the facts on the naming
 * page, and the page asks for those separately rather than being told a model is second class.
 *
 * `undefined` is a real answer: a skin nobody has recorded, or a remote whose `bcdDevice` carries no
 * skin at all. Inventing a name for it is the one thing not to do, so the interface shows the number
 * and lets somebody name their own remote.
 */
export function remoteModelForSkin(skin: number | undefined): RemoteModel | undefined {
  if (skin === undefined) return undefined;
  const bare = MODELS_BY_SKIN[skin]?.name ?? SKINS_WITHOUT_A_MODEL_RECORD[skin];
  return bare === undefined ? undefined : { name: fullName(bare), skin };
}

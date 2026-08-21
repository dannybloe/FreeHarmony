/**
 * The models this application knows about, and the one place the two libraries are joined.
 *
 * `@harmony/silhouettes` holds the drawings and the measured geometry; a document holds a name and,
 * where it is known, a skin. Turning one into the other is a lookup that must exist exactly once,
 * because a second copy would be a second answer to "which remote is this" and those two would
 * disagree the first time a model was added. That is the sibling repository's oldest rule and it is
 * the reason this file is not three lines inside a view.
 *
 * **It sits next to `theme.ts` rather than in a `models/` directory**, so that `models` and
 * `viewmodels` cannot be confused when reading a file list. A model here is a piece of hardware; a
 * view model is a screen's state.
 *
 * Two libraries: `@harmony/silhouettes` for the drawing and the geometry, and `@harmony/usb/models`
 * for what Logitech's own tables say about a skin. The second is a **subpath** on purpose: it is a
 * table with no imports at all, where the package's main entry pulls in the HID transport and its
 * native binding, which a window cannot load and does not need.
 *
 * **A tile is a face, not a model number.** A skin names a keypad, which is the reading in the model
 * table's own comments, so one drawing serves every skin whose keypad it matches and a tile lists the
 * model numbers those skins are sold as. Where that is one number it says one; where two model numbers
 * share a face it says both, which is the whole reason this is computed rather than written out.
 */
import { DETAIL, MODELS, type Model } from '@harmony/silhouettes';
import { modelForSkin } from '@harmony/usb/models';

import type { RemoteModel } from '../../shared/remote.ts';

/** How much of a drawing to show. Named here so a view asks for a purpose, not for a layer list. */
export const DRAWING_DETAIL = {
  /** The whole face, text and symbols included. For a model shown on its own. */
  full: DETAIL.full,
  /** Shape only, which is what reads at the size of a tile. */
  tile: DETAIL.thumbnail,
} as const;

/** A model somebody can pick, with the facts worth showing beside it. */
export interface SupportedModel {
  readonly id: string;
  /** Logitech's own name, which is what a document stores and what a screen shows. */
  readonly name: string;
  /**
   * The skin a document gets when this model is picked by hand.
   *
   * The **first** of the drawing's skins, and the choice is real: a drawing serves a model and its
   * regional twin, which differ by the four teletext keys and by nothing this application can see.
   * Picking from a list cannot tell them apart, so the primary one is recorded and a remote that is
   * read over USB later states its own.
   */
  readonly skin: number;
  /**
   * Every model number this one face is sold as, in the order the skins are claimed.
   *
   * Usually one. Two where Logitech sold the same keypad under two numbers, which is what a chooser
   * has to show: somebody holding the other number should recognise their own remote instead of
   * concluding it is unsupported.
   *
   * **A regional variant is not a second number.** Skins 54 and 59 are the Harmony One and the
   * European Harmony One, which differ in nothing on the face and in nothing printed on it, so the
   * suffix is Logitech's internal marker and adding it to a tile would be noise.
   */
  readonly soldAs: readonly string[];
  readonly drawing: Model;
  readonly facts: readonly string[];
}

/** The model numbers a drawing's skins are sold as, with regional duplicates folded together. */
function soldAs(drawing: Model): string[] {
  const seen: string[] = [];
  for (const skin of drawing.skins) {
    const named = modelForSkin(skin)?.name;
    if (named === undefined) continue;
    const withoutRegion = named.replace(/ EMEA$/, '');
    if (!seen.includes(withoutRegion)) seen.push(withoutRegion);
  }
  return seen;
}

/**
 * What is worth saying about a model, in words.
 *
 * The first two are **measured**, off the drawing: the buttons were counted and the display was read
 * out of a config. The device ceiling is **Logitech's own figure** and no config in the corpus next
 * door reaches any stated maximum, so it is phrased as "up to" and never as a promise. That
 * distinction is not decoration: one of these numbers can be checked and the other has to be taken
 * on somebody's word.
 */
function factsAbout(drawing: Model): string[] {
  const facts = [`${drawing.keys.length} buttons`];
  const screen = drawing.screen;
  if (screen !== undefined) {
    const size = `${screen.pixels.width} by ${screen.pixels.height} pixels`;
    facts.push(screen.touch ? `a touch screen of ${size}` : `a screen of ${size}`);
  }
  const stated = modelForSkin(drawing.skins[0]);
  if (stated !== undefined) facts.push(`up to ${stated.maxDevices} devices`);
  return facts;
}

/**
 * Every model with a drawing, in the order they are offered.
 *
 * Three of the forty models Logitech retired, so a remote whose model is not here is the ordinary
 * case rather than a fault.
 *
 * Ordered by name, with numbers read as numbers, so the row reads 525, 600, One. By architecture it
 * read 525, One, 600, which is correct about the hardware and wrong on a screen: nobody looking for
 * their own remote knows which generation of chip is in it.
 */
export const SUPPORTED: readonly SupportedModel[] = Object.values(MODELS)
  .map((drawing) => ({
    id: drawing.id,
    name: drawing.label,
    skin: drawing.skins[0] ?? 0,
    soldAs: soldAs(drawing),
    drawing,
    facts: factsAbout(drawing),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

/**
 * The drawing for a document's model, or `undefined` when there is none.
 *
 * By skin first, because that is what the hardware states and what a regional pair shares. By name
 * second, so a document written by hand still finds its picture. `undefined` is a real answer and
 * every caller has to draw something for it.
 */
export function drawingFor(model: RemoteModel | undefined): Model | undefined {
  if (model === undefined) return undefined;
  const all = Object.values(MODELS);
  const skin = model.skin;
  const bySkin = skin === undefined ? undefined : all.find((d) => d.skins.includes(skin));
  return bySkin ?? all.find((drawing) => drawing.label === model.name);
}

/** What goes into a document when somebody picks this model. */
export function asRemoteModel(picked: SupportedModel): RemoteModel {
  return { name: picked.name, skin: picked.skin };
}

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
 *
 * **`describe` is the single derivation and `SUPPORTED` is built out of it**, rather than the chooser
 * having its own copy. That matters now that a model can arrive from the USB bus as well as from the
 * chooser: a Harmony 655 attached to this machine has a name and a skin and no drawing, and it has to
 * be describable by the same code that describes a Harmony One somebody picked from a list.
 */
import { DETAIL, MODELS, type Model } from '@harmony/silhouettes';
import { MODELS_BY_SKIN, modelForSkin } from '@harmony/usb/models';

import { fullName } from '../../shared/models.ts';
import type { RemoteModel } from '../../shared/remote.ts';

/** How much of a drawing to show. Named here so a view asks for a purpose, not for a layer list. */
export const DRAWING_DETAIL = {
  /** The whole face, text and symbols included. For a model shown on its own. */
  full: DETAIL.full,
  /** Shape only, which is what reads at the size of a tile. */
  tile: DETAIL.thumbnail,
} as const;

/** Everything a screen can honestly say about a model, drawing included where there is one. */
export interface ModelDescription {
  /** `undefined` is the ordinary case: three of the forty retired models are drawn. */
  readonly drawing: Model | undefined;
  /** Short phrases, measured first and Logitech's own figures last. May be empty. */
  readonly facts: readonly string[];
  /** Every model number this face is sold as, most familiar first. May be empty. */
  readonly soldAs: readonly string[];
}

/** A model somebody can pick out of the chooser, which is a described model with a drawing. */
export interface SupportedModel extends ModelDescription {
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
  readonly drawing: Model;
}

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

/**
 * What is worth saying about a model, in words, and in the order of how much it can be trusted.
 *
 * The buttons and the display are **measured**, off the drawing: the keys were counted and the screen
 * was read out of a config. Where there is no drawing they are simply absent, and the panel kind stands
 * in, which is Logitech's word rather than ours. The device ceiling is Logitech's figure too and no
 * config in the corpus next door reaches any stated maximum, so it is phrased as "up to" and never as a
 * promise. That ordering is not decoration: some of these numbers can be checked and the rest have to
 * be taken on somebody's word.
 */
export function describe(model: RemoteModel): ModelDescription {
  const drawing = drawingFor(model);
  const stated = modelForSkin(model.skin ?? drawing?.skins[0]);
  const facts: string[] = [];

  if (drawing !== undefined) {
    facts.push(`${drawing.keys.length} buttons`);
    const screen = drawing.screen;
    if (screen !== undefined) {
      const size = `${screen.pixels.width} by ${screen.pixels.height} pixels`;
      facts.push(screen.touch ? `a touch screen of ${size}` : `a screen of ${size}`);
    }
  } else if (stated !== undefined && stated.panel !== 'none') {
    facts.push(stated.touch ? 'a touch screen' : `a ${stated.panel} screen`);
  }

  if (stated !== undefined) facts.push(`up to ${stated.maxDevices} devices`);

  return { drawing, facts, soldAs: soldAs(model, drawing) };
}

/**
 * The model numbers this face is sold as, with regional duplicates folded together.
 *
 * **The skins are the authority and the record's `alias` field is deliberately not consulted.** An
 * alias is the same specification row under another number, and the model table's own comment says
 * why that is not the same hardware: skin 22 is the Harmony 525 and its alias the 520, and the two
 * differ by four teletext keys. Different keys, different remote, so it does not share this face and
 * must not be listed as though it did. A drawing states which skins it serves and nothing else may.
 *
 * **A regional variant is not a second number either.** Skins 54 and 59 are the Harmony One and the
 * European Harmony One, which differ in nothing on the face and in nothing printed on it, so the
 * suffix is Logitech's internal marker and putting it on a tile would be noise.
 */
function soldAs(model: RemoteModel, drawing: Model | undefined): string[] {
  const skins = drawing?.skins ?? (model.skin === undefined ? [] : [model.skin]);
  const seen: string[] = [];
  for (const skin of skins) {
    const bare = MODELS_BY_SKIN[skin]?.name;
    if (bare === undefined) continue;
    const named = fullName(bare.replace(/ EMEA$/, ''));
    if (!seen.includes(named)) seen.push(named);
  }
  return seen;
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
  .map((drawing) => {
    const skin = drawing.skins[0] ?? 0;
    return { id: drawing.id, name: drawing.label, skin, ...describe({ name: drawing.label, skin }), drawing };
  })
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

/** What goes into a document when somebody picks this model. */
export function asRemoteModel(picked: SupportedModel): RemoteModel {
  return { name: picked.name, skin: picked.skin };
}

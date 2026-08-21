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
 * What it deliberately does **not** hold: how many devices or activities a model supports. Those are
 * in `@harmony/usb`, which brings a native binding with it, and they arrive when USB does. The facts
 * below are the ones the drawings already carry, and every one of them is measured rather than
 * tabulated.
 */
import { DETAIL, MODELS, type Model } from '@harmony/silhouettes';

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
  readonly drawing: Model;
  readonly facts: readonly string[];
}

/** What a drawing says about the hardware, in words. Measured, all of it. */
function factsAbout(drawing: Model): string[] {
  const facts = [`${drawing.keys.length} buttons`];
  const screen = drawing.screen;
  if (screen !== undefined) {
    const size = `${screen.pixels.width} by ${screen.pixels.height} pixels`;
    facts.push(screen.touch ? `a touch screen of ${size}` : `a screen of ${size}`);
  }
  return facts;
}

/**
 * Every model with a drawing, in the order they are offered.
 *
 * Three of the forty models Logitech retired, so a remote whose model is not here is the ordinary
 * case rather than a fault. Ordered oldest to newest by architecture, which happens to put the
 * simplest first.
 */
export const SUPPORTED: readonly SupportedModel[] = Object.values(MODELS)
  .map((drawing) => ({
    id: drawing.id,
    name: drawing.label,
    skin: drawing.skins[0] ?? 0,
    drawing,
    facts: factsAbout(drawing),
  }))
  .sort((a, b) => a.drawing.architecture - b.drawing.architecture);

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

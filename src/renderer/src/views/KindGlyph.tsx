/**
 * A small drawing per kind of appliance, so a tile says what it is before it says what it is called.
 *
 * Asked for on 21 August 2026: the same categories Logitech had, drawn rather than fetched. In the same
 * hand as `Glyphs.tsx`, whose `stroke` this imports rather than restating, and with no icon dependency
 * for the reason that file gives.
 *
 * **One component with a table rather than nine exported functions**, and that is the whole design: the
 * table is a `Record<DeviceKind, ...>`, so adding a kind to the model and forgetting to draw it does not
 * compile. Nine separate components would have needed a lookup somewhere, and a lookup with a fallback
 * is exactly how a kind ends up silently drawn as something else.
 *
 * **What to expect of this on a screen today**: nearly every appliance is `other`, because a
 * configuration does not say whether a device is a television or an amplifier. It states codes and
 * positions. So a kind is something a person fills in, or something the Logitech catalogue supplies, and
 * a freshly imported remote draws the same picture nine times. That is honest rather than a defect, and
 * it is the reason these arrive with the form that lets somebody set one.
 */
import type { ReactNode } from 'react';

import type { DeviceKind } from '../../../shared/library.ts';
import { stroke } from './Glyphs.tsx';

interface KindGlyphProps {
  readonly kind: DeviceKind;
  readonly size?: number | undefined;
  readonly className?: string | undefined;
}

export function KindGlyph({ kind, size = 24, className }: KindGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      {DRAWINGS[kind]}
    </svg>
  );
}

/**
 * The nine, and the two pairs worth knowing about because they are the ones a glance confuses.
 *
 * A **player** and a **recorder** are both a flat box, so one carries the play mark and the other the
 * record mark. That is a correction made by looking at them: they were a disc and a disc with a dot, which
 * is what those machines' fronts actually look like and was one indistinguishable picture at 30 pixels.
 * The **amplifier** went the same way, from a knob and a display band to two knobs, because the band was
 * the recorder's two lines. And a **set-top box** and **something else** are both a plain box, so the
 * unknown one carries the application's own beam leaving it: an appliance nobody has described is still a
 * thing that receives.
 */
const DRAWINGS: Readonly<Record<DeviceKind, ReactNode>> = {
  // A screen on a stand. The feet are what stop it reading as a window or a picture frame.
  television: (
    <>
      <rect {...stroke} x="2.5" y="4.5" width="19" height="12.5" rx="1.6" />
      <path {...stroke} d="M12 17v2.6M8.5 20.2h7" />
    </>
  ),
  // Two large knobs, which is the front of every amplifier ever made. The knobs and nothing else: a
  // display band beside them made this read as the recorder below at the size the form draws it.
  receiver: (
    <>
      <rect {...stroke} x="2.5" y="7" width="19" height="10" rx="1.6" />
      <circle {...stroke} cx="8" cy="12" r="2.3" />
      <circle {...stroke} cx="16" cy="12" r="2.3" />
    </>
  ),
  // Flat and wide with a standby light, and nothing else on it, because that is what they look like.
  'set-top-box': (
    <>
      <rect {...stroke} x="2.5" y="8.5" width="19" height="7" rx="1.6" />
      <circle cx="6" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <path {...stroke} d="M10.5 12h7.5" />
    </>
  ),
  // Play, and recorder below is record. **These two were a disc and a disc with a dot**, and at the size
  // the form draws them they were the same picture: a small box with something round in it. The two marks
  // every machine of that era printed on its own front panel are unmistakable at any size, and they say
  // what the appliance is **for** rather than what shape its front is, which is what a category is.
  player: (
    <>
      <rect {...stroke} x="2.5" y="7.5" width="19" height="9" rx="1.6" />
      <path {...stroke} d="M10 9.2 15.4 12 10 14.8z" />
    </>
  ),
  recorder: (
    <>
      <rect {...stroke} x="2.5" y="7.5" width="19" height="9" rx="1.6" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </>
  ),
  // A gamepad: the one appliance here with a shape of its own, so it needs no box at all.
  'game-console': (
    <>
      <rect {...stroke} x="2.5" y="8" width="19" height="9" rx="4.5" />
      <path {...stroke} d="M7 10.8v3.4M5.3 12.5h3.4" />
      <circle cx="16.2" cy="11.5" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="13.6" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  // A screen over a wide base, which is a laptop, and a laptop is what a computer looks like on a shelf.
  computer: (
    <>
      <rect {...stroke} x="5.5" y="4.5" width="13" height="10" rx="1.4" />
      <path {...stroke} d="M3 17.5h18" />
    </>
  ),
  // A bulb with a screw base. Lighting is a category Logitech had and one this application will meet.
  lighting: (
    <>
      <path {...stroke} d="M8.5 13.4a5 5 0 1 1 7 0c-.8.9-1.2 1.7-1.3 2.6h-4.4c-.1-.9-.5-1.7-1.3-2.6z" />
      <path {...stroke} d="M9.9 18.2h4.2M10.9 20.6h2.2" />
    </>
  ),
  // A box with the beam of `BeamMark` leaving it: unknown, but still a thing that takes a code.
  other: (
    <>
      <rect {...stroke} x="2.5" y="7" width="11" height="10" rx="1.6" />
      <path {...stroke} d="M16.6 9.4a4.2 4.2 0 0 1 0 5.2" opacity="0.85" />
      <path {...stroke} d="M19.6 7.2a7.6 7.6 0 0 1 0 9.6" opacity="0.45" />
    </>
  ),
};

/**
 * The handful of small drawings this interface needs, as inline SVG.
 *
 * Inline rather than an icon package, and that is a dependency decision rather than a stylistic one:
 * this application needs a few glyphs, and the smallest icon library is thousands of them plus a build
 * step. Inline SVG also costs nothing in the content security policy, where a sprite file or an icon
 * font would each need a directive of their own.
 *
 * Every one of them strokes in `currentColor` and states no colour of its own, so colour stays in the
 * stylesheets where the agreement puts it. A size is a layout property and is passed in.
 */

// `| undefined` is written out because `exactOptionalPropertyTypes` is on and a class name read out of
// a CSS module is `string | undefined`: the compiler will not let that reach an optional property that
// has not said it accepts one. Stating it is the honest fix, since a caller genuinely may pass none.
interface GlyphProps {
  readonly size?: number | undefined;
  readonly className?: string | undefined;
}

/**
 * How every line in every drawing here is struck.
 *
 * Exported because `KindGlyph.tsx` draws in the same hand and a second copy of these five numbers is a
 * second copy of a derivation, which is the one thing this project's oldest rule forbids. A stroke width
 * of 1.6 against a stroke width of 1.5 is not a bug anything can catch: it is one set of pictures that
 * quietly looks lighter than the other.
 */
export const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/**
 * The mark: an emitter with three arcs leaving it.
 *
 * A remote is a thing that sends infrared, and every alternative was worse. A musical note would be
 * about the name and not the thing, and a picture of a remote would have to be a **particular** model,
 * which is wrong for a mark that stands for the whole application.
 *
 * **It is not in the bar any more**, taken out on 22 August 2026: beside the wordmark at 26 pixels it
 * read as a wireless status indicator rather than as a mark, which is a thing an application has and not
 * a thing it is. Kept because it is still the right drawing for a window icon or an About box, and
 * because `KindGlyph`'s "something else" is the same beam leaving a box.
 *
 * Where a particular model does have to be drawn, `@harmony/silhouettes` draws it. Nothing here
 * duplicates that: it is a library next door with a key addressable by name and every fill reading a
 * custom property, so the interface colours a drawing rather than keeping a second one.
 */
export function BeamMark({ size = 28, className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="6.5" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path {...stroke} d="M11 8.4a5 5 0 0 1 0 7.2" opacity="0.9" />
      <path {...stroke} d="M14.6 5.6a9 9 0 0 1 0 12.8" opacity="0.6" />
      <path {...stroke} d="M18.2 2.8a13 13 0 0 1 0 18.4" opacity="0.3" />
    </svg>
  );
}

/**
 * A collection of things, for a tile standing for a list rather than for one item.
 *
 * Three stacked rounded bars, which is the shape everything from a settings list to a table of contents
 * uses, so it needs no learning. It is deliberately **generic**: the tiles on a remote's page are Devices,
 * Activities and Settings, and a drawing per tile would be three pictures competing with the badge that
 * carries the actual number.
 */
export function StackGlyph({ size = 26, className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <rect {...stroke} x="3.5" y="4.5" width="17" height="4" rx="2" />
      <rect {...stroke} x="3.5" y="10" width="17" height="4" rx="2" />
      <rect {...stroke} x="3.5" y="15.5" width="17" height="4" rx="2" />
    </svg>
  );
}

/**
 * A pencil, for the control that opens a name for typing.
 *
 * The body is one stroked outline and the nib is a filled triangle, which is what keeps it a pencil at
 * fifteen pixels: an outlined nib at that size closes up into a grey blob.
 */
export function PencilGlyph({ size = 18, className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path {...stroke} strokeLinejoin="round" d="M16.2 3.6l4.2 4.2L9.1 19.1l-5.2 1 1-5.2z" />
      <path {...stroke} d="M14.1 5.7l4.2 4.2" />
      <path d="M3.9 20.1l1-5.2 4.2 4.2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * A cog, for the tile that is about the thing itself rather than about what is in it.
 *
 * The one place a drawing here is a convention rather than a picture of anything: nothing about a cog says
 * "rename, copy or remove a document", and everybody knows it anyway.
 *
 * **The teeth are one closed outline and not eight spokes.** Eight short strokes radiating from a ring was
 * the first attempt and it drew a sun at tile size, which is exactly the wrong word. The outline is
 * generated from eight teeth at radius 9.4 and eight roots at 6.3, written out here as numbers because a
 * drawing is data and this file states drawings rather than computing them.
 */
export function CogGlyph({ size = 26, className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path
        {...stroke}
        strokeLinejoin="round"
        d="M 9.90 6.06 L 10.21 2.77 L 13.79 2.77 L 14.10 6.06 L 14.71 6.31 L 17.26 4.21 L 19.79 6.74
           L 17.69 9.29 L 17.94 9.90 L 21.23 10.21 L 21.23 13.79 L 17.94 14.10 L 17.69 14.71
           L 19.79 17.26 L 17.26 19.79 L 14.71 17.69 L 14.10 17.94 L 13.79 21.23 L 10.21 21.23
           L 9.90 17.94 L 9.29 17.69 L 6.74 19.79 L 4.21 17.26 L 6.31 14.71 L 6.06 14.10
           L 2.77 13.79 L 2.77 10.21 L 6.06 9.90 L 6.31 9.29 L 4.21 6.74 L 6.74 4.21 L 9.29 6.31 Z"
      />
      <circle {...stroke} cx="12" cy="12" r="3.1" />
    </svg>
  );
}

/** Add. */
export function PlusGlyph({ size = 16, className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path {...stroke} strokeWidth={2} d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

/** Attach: a cable end going in, which is what connecting a remote looks like. */
export function PlugGlyph({ size = 16, className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path {...stroke} d="M9.5 2.8v4.2M14.5 2.8v4.2" />
      <path {...stroke} d="M6.8 7h10.4v3.1a5.2 5.2 0 0 1-10.4 0z" />
      <path {...stroke} d="M12 15.3V21" />
    </svg>
  );
}

/**
 * A chevron, pointing where it is told.
 *
 * One glyph for three jobs, the two carousel arrows and the way back, because they are the same shape
 * and three near identical paths would be three things to keep in step. Rotation is a transform on the
 * whole drawing rather than a second path, which is also why it stays crisp at any size.
 */
export function ChevronGlyph({ towards, size = 20, className }: GlyphProps & {
  readonly towards: 'left' | 'right';
}) {
  const turn = towards === 'left' ? 180 : 0;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path {...stroke} strokeWidth={2} d="M9.5 4.5 17 12l-7.5 7.5" transform={`rotate(${turn} 12 12)`} />
    </svg>
  );
}

/** More: the menu a row hides its less common actions behind. */
export function DotsGlyph({ size = 18, className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The decorative pulse train behind the top bar.
 *
 * **It is drawn, not read.** The shape is a plausible infrared frame, a long header pulse and then a
 * run of bits, and it is written out here rather than taken from a config, because a config cannot
 * come into this repository and a picture that implied it had would be a small lie. When the
 * application can show a real code, that will be a chart in a view and not a background.
 */
export function PulseTrain({ className }: { readonly className?: string | undefined }) {
  // Widths in the viewBox: a header mark and space, then bits, wide for a one and narrow for a zero.
  const widths = [26, 13, 4, 4, 4, 4, 9, 4, 4, 4, 9, 4, 4, 4, 4, 4, 9, 4, 9, 4, 4, 4, 4, 4, 9, 4, 4, 4];
  const top = 6;
  const bottom = 34;

  let x = 0;
  let high = true;
  let path = `M ${x} ${bottom}`;
  for (const width of widths) {
    path += ` V ${high ? top : bottom} h ${width}`;
    high = !high;
    x += width;
  }
  path += ` V ${bottom}`;

  return (
    <svg viewBox={`0 0 ${x} 40`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

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

const stroke = {
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

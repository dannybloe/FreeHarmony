/**
 * The theme, which is the one place a colour, a radius or a font is decided.
 *
 * Mantine turns this object into CSS variables, `--mantine-color-*`, `--mantine-spacing-*` and the
 * rest, and every stylesheet in this application reaches for those rather than writing a value.
 * That is what makes the styling agreement enforceable: a component says which role a colour plays
 * and this file says what the role looks like, so changing the look is one edit here rather than a
 * search through the interface.
 *
 * It is deliberately small. There is nothing to design against yet, so this sets a starting point
 * that is recognisably not the default and leaves the rest alone. The visual language is a job for
 * whoever draws the first real screens, and a theme invented in advance would be a guess with the
 * authority of a committed file.
 */
import { createTheme } from '@mantine/core';

export const theme = createTheme({
  // Mantine's own palettes, chosen rather than defaulted. `primaryColor` names the role and
  // `primaryShade` says which step of it, as one number rather than one per colour scheme: the
  // application is light only for now and `main.tsx` is where that is decided.
  primaryColor: 'indigo',
  primaryShade: 6,

  // Rounded a little more than the default, which is the cheapest way for an interface to stop
  // looking like the framework it was built with.
  defaultRadius: 'md',

  // The system font, so text looks native on each platform rather than importing a face. That also
  // keeps the content security policy free of a `font-src` exception, which is a real consideration
  // for an application that promises to work with the network unplugged.
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',

  headings: {
    // Headings sit closer to body weight than Mantine's default. The application is dense and
    // informational rather than promotional, so a heading needs to mark a boundary, not shout.
    fontWeight: '600',
  },
});

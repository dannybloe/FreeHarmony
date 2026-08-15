/**
 * The two content security policies, in a module of their own so that a test can read them.
 *
 * They started out as constants inside `electron.vite.config.ts`, which is the natural place until
 * you notice that the one thing worth checking about them cannot be checked there: that the policy
 * a release carries has not quietly been loosened to whatever made a development problem go away.
 * The development policy exists precisely because such loosenings are needed, so the two living
 * side by side with nothing between them is an accident waiting for a deadline.
 */

/**
 * What the shipped application is allowed to load. `default-src 'none'` means every kind of
 * resource has to be named explicitly, so anything the page grows later fails loudly rather than
 * quietly reaching the network.
 *
 * The sibling repository learned this the expensive way: its bench page served broken images while
 * `curl` fetched them happily and every server test passed, because the policy listed scripts,
 * styles and connections and no `img-src`. A policy is enforced by the browser and by nothing else,
 * so no amount of asking the server anything can test it.
 *
 * `data:` is allowed for images on purpose. A remote's screens are drawn by the codec and handed
 * over as PNG bytes, and a data URI is how those reach an `<img>` without inventing a local server.
 */
export const PRODUCTION_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
].join('; ');

/**
 * The same policy with the holes the development server needs, and only those.
 *
 * Vite's reload client injects an inline script and React's fast refresh evaluates the modules it
 * swaps in, so `script-src` has to be loosened while developing, and the reload socket needs `ws:`.
 * That is exactly the loosening that must never ship, which is why the two are written out in full
 * rather than one being derived from the other: a diff between two literals is readable, and a
 * policy assembled at runtime from a list of exceptions is not.
 */
export const DEVELOPMENT_POLICY = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' ws:",
].join('; ');

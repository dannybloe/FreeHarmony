/**
 * The content security policy, as a check rather than an intention.
 *
 * There are two policies here on purpose: a strict one for a release and a looser one that lets the
 * development server inject the scripts it needs. That arrangement is only safe while the two stay
 * apart, and the way it fails is not by somebody deciding to weaken a release. It fails by a
 * development problem being solved in the wrong constant late in the day, which then ships and
 * nothing anywhere notices, because a policy that is too permissive breaks nothing.
 *
 * So these assert the shape of the strict one directly, and they assert that the loose one is loose
 * in exactly the ways it is allowed to be. A browser test that loads the built page belongs with the
 * checks that run in CI; this one needs no build and no browser, which is why it can run on every
 * change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEVELOPMENT_POLICY, PRODUCTION_POLICY } from '../build/csp.ts';

/** `default-src 'none'` is the whole design: everything else in the policy is an exception to it. */
test('the shipped policy denies everything it has not been asked about', () => {
  assert.ok(PRODUCTION_POLICY.startsWith("default-src 'none'"), PRODUCTION_POLICY);
});

test('the shipped policy lets nothing execute, whatever it lets look different', () => {
  // `script-src` is the directive that decides whether an injected string can run, so it carries no
  // exception at all and neither does anything else. `style-src` is the single exception in this
  // policy, and it is named here rather than tolerated by a looser test: Mantine writes a theme's
  // overrides into a `<style>` element it creates at run time, and under `style-src 'self'` the
  // application renders and silently ignores its own theme. `build/csp.ts` carries the measurement.
  //
  // **This assertion was rewritten rather than relaxed**, and the distinction is the whole reason
  // the test exists. Its first version refused `unsafe-inline` anywhere, which is what caught this,
  // and the wrong response would have been to widen it until it passed again. So the exception is
  // stated as one directive with a reason, and every other directive is still held to the original
  // claim, which means the next loosening fails here too.
  const withAnException = new Set(['style-src']);
  for (const directive of PRODUCTION_POLICY.split('; ')) {
    const name = directive.split(' ')[0] ?? '';
    if (withAnException.has(name)) continue;
    assert.ok(!directive.includes('unsafe-'), `${directive} allows something unsafe`);
  }
  assert.ok(!PRODUCTION_POLICY.includes('unsafe-eval'), 'nothing may evaluate a string, anywhere');
});

test('the shipped policy reaches no network host of any kind', () => {
  // FreeHarmony is offline by design, and this is the line that makes that a property of the page
  // rather than a promise in a document. `'self'` is the built page and the assets beside it.
  // A quoted source is a keyword and never a place: `'self'`, `'none'`, `'unsafe-inline'`. Which of
  // those are acceptable is the previous test's business, and repeating it here would mean widening
  // two tests for one decision. What this one refuses is anything unquoted, which is exactly the
  // shape of a host, a wildcard or a scheme such as `https:` or `ws:`. `data:` is the one exception,
  // and it names bytes the application already has rather than somewhere to fetch them from.
  for (const directive of PRODUCTION_POLICY.split('; ')) {
    for (const source of directive.split(' ').slice(1)) {
      const isAKeyword = source.startsWith("'") && source.endsWith("'");
      assert.ok(isAKeyword || source === 'data:', `${directive} names somewhere to fetch from`);
    }
  }
});

test('the development policy differs only where developing needs it to', () => {
  // Named directives rather than a count, so that adding one to both policies does not quietly
  // satisfy this test. Anything outside this set having been loosened is the failure worth catching.
  const mayDiffer = new Set(['script-src', 'style-src', 'connect-src']);

  const production = new Map(PRODUCTION_POLICY.split('; ').map((d) => [d.split(' ')[0], d]));
  const development = new Map(DEVELOPMENT_POLICY.split('; ').map((d) => [d.split(' ')[0], d]));

  assert.deepEqual([...development.keys()], [...production.keys()], 'the same directives, in order');
  for (const [name, strict] of production) {
    if (mayDiffer.has(name ?? '')) continue;
    assert.equal(development.get(name), strict, `${name} is loosened for development and should not be`);
  }
});

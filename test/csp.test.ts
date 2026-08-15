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

test('the shipped policy allows nothing unsafe, which is what a development fix would break', () => {
  // Both spellings, because they are separate keywords and allowing either would be enough to make
  // an injected string executable in a release.
  assert.ok(!PRODUCTION_POLICY.includes('unsafe-inline'), PRODUCTION_POLICY);
  assert.ok(!PRODUCTION_POLICY.includes('unsafe-eval'), PRODUCTION_POLICY);
});

test('the shipped policy reaches no network host of any kind', () => {
  // FreeHarmony is offline by design, and this is the line that makes that a property of the page
  // rather than a promise in a document. `'self'` is the built page and the assets beside it.
  for (const directive of PRODUCTION_POLICY.split('; ')) {
    const sources = directive.split(' ').slice(1);
    for (const source of sources) {
      const allowed = source === "'none'" || source === "'self'" || source === 'data:';
      assert.ok(allowed, `${directive} names a source that is neither the page itself nor a data URI`);
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

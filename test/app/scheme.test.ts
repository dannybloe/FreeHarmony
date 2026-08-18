/**
 * The application is light only for now, and this is what says so where it can be measured.
 *
 * Decided on 18 August 2026: a dark theme is not important yet, and half of one is worse than none.
 * So `main.tsx` forces the light scheme rather than following the system, every stylesheet of ours
 * carries one value per property, and the `light` and `dark` mixins are gone from `_mantine.scss`
 * because a block that can never fire reads as covered.
 *
 * **The claim needs a running window and it needs the page to be reloaded**, and both halves of that
 * were learned by controlling this test rather than by reasoning. Whether a page follows the system
 * preference depends on Mantine's behaviour and on what the machine says that day, so nothing in the
 * source or in a unit test can answer it. And telling a **running** page that the system now prefers
 * dark changes nothing even when the scheme is not forced at all: measured with
 * `defaultColorScheme="auto"`, `matchMedia` flips to dark and the scheme stays light, because the
 * preference is read when the page mounts. So the first version of this test passed against exactly
 * the code it was meant to refuse.
 *
 * With the emulation in place before the page mounts, the control bites and its magnitude is worth
 * recording: under `auto` the same run reports the dark scheme and draws the body as
 * `rgb(201, 201, 201)` on `rgb(36, 36, 36)` instead of black on white.
 *
 * When a dark theme arrives this test fails first, and that is the intent. It states a decision, so it
 * should have to be rewritten when the decision changes rather than quietly passing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { launch } from './electron.ts';

/**
 * What the page reports about the scheme, and two colours it actually drew.
 *
 * The colours are the body's rather than our own shell's, and that is not a detail: our shell has one
 * background now, so it looks the same under either scheme and can prove nothing. What moves is what
 * Mantine paints from the scheme, which is the thing being held still.
 */
const OBSERVED = `(() => ({
  stated: document.documentElement.dataset.mantineColorScheme,
  systemPrefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  background: getComputedStyle(document.body).backgroundColor,
  text: getComputedStyle(document.body).color,
}))()`;

interface Observed {
  stated: string;
  systemPrefersDark: boolean;
  background: string;
  text: string;
}

test('the window is light, and a system that prefers dark does not change it', async (t) => {
  const app = await launch();
  t.after(() => app.close());

  const asStarted = await app.evaluate<Observed>(OBSERVED);
  assert.deepEqual(asStarted, {
    stated: 'light',
    systemPrefersDark: false,
    background: 'rgb(255, 255, 255)',
    text: 'rgb(0, 0, 0)',
  }, 'the light scheme, stated by Mantine and drawn by it');

  // The control, and the reason this test is in a window at all: the page is reloaded with the system
  // preferring dark, which is the situation of somebody who starts the application on such a machine.
  await app.send('Emulation.setEmulatedMedia',
                 { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await app.reload();
  const withADarkSystem = await app.evaluate<Observed>(OBSERVED);

  assert.equal(withADarkSystem.systemPrefersDark, true, 'the emulation took, so the control is live');
  assert.deepEqual(withADarkSystem, { ...asStarted, systemPrefersDark: true },
                   'and nothing else about the page moved');
});

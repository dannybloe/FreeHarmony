/**
 * Where the window's contents start: the mount, and the one provider everything is drawn inside.
 *
 * `@mantine/core/styles.css` is imported once, here, and never per component. Mantine ships its own
 * stylesheet rather than injecting styles from JavaScript, which is the property that lets this
 * application keep a strict content security policy.
 *
 * **The colour scheme is light and it is forced**, decided on 18 August 2026. A dark theme is not
 * important yet and half of one is worse than none, so rather than following the operating system and
 * hoping every stylesheet has a second value, the scheme is stated here and every stylesheet carries
 * exactly one value per property. `forceColorScheme` is Mantine's own way of saying it, so nothing is
 * invented and the system preference is ignored rather than fought.
 *
 * This is the whole of the decision. Bringing a dark theme back is this line, plus a second value in
 * each stylesheet that needs one, and `test/app/scheme.test.ts` is what will fail first and say so.
 */
import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';

import { App } from './App.tsx';
import { theme } from './theme.ts';

const root = document.getElementById('root');
if (root === null) throw new Error('the page has no root element to mount into');

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} forceColorScheme="light">
      <App />
    </MantineProvider>
  </StrictMode>,
);

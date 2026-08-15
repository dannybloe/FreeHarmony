/**
 * Where the window's contents start: the mount, and the one provider everything is drawn inside.
 *
 * `@mantine/core/styles.css` is imported once, here, and never per component. Mantine ships its own
 * stylesheet rather than injecting styles from JavaScript, which is the property that lets this
 * application keep a strict content security policy.
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
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </StrictMode>,
);

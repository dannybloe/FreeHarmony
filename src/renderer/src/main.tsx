/**
 * Where the window's contents start. Nothing but the mount, on purpose: what is drawn belongs in a
 * component, and the styling foundation that decides how it looks arrives with Mantine and Sass.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';

const root = document.getElementById('root');
if (root === null) throw new Error('the page has no root element to mount into');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

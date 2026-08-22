/**
 * The remote, drawn, with its keys clickable and coloured by what they are doing.
 *
 * **Why this is a component and not a prop on `Silhouette`.** That one has exactly one job, injecting the
 * markup, and it is the only place in the application that does. This one knows what a key means, which is
 * document knowledge and has no business inside a drawing. So the drawing stays a picture and this decides
 * how the picture behaves.
 *
 * **The states are painted by attribute and not by class**, and that is the mechanism worth stating: the
 * drawing gives every key a group carrying its name, its kind and its scan code, and every fill inside that
 * group reads a custom property. So setting `--key-fill` on one group colours that key and nothing else,
 * which is what makes a legend possible in plain CSS. The attribute is written by an effect because React
 * does not own these nodes: the markup arrived as a string.
 *
 * The click is one listener on the wrapper rather than one per key, because there are up to 54 of them and
 * the drawing is replaced whole whenever the model changes. `closest` finds the group from whatever part of
 * the key was actually hit, which matters: a press usually lands on a symbol or a printed word inside it.
 */
import { useEffect, useRef, type ReactNode } from 'react';

import type { Model } from '@harmony/silhouettes';

import type { KeyOnScreen } from '../viewmodels/keypad.model.ts';
import { Silhouette } from './Silhouette.tsx';
import classes from './Keypad.module.scss';

interface KeypadProps {
  readonly drawing: Model;
  readonly keys: readonly KeyOnScreen[];
  /** Which key is being looked at, by name, or none. */
  readonly picked: string | undefined;
  readonly onPick: (name: string) => void;
}

export function Keypad({ drawing, keys, picked, onPick }: KeypadProps) {
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = frame.current;
    if (root === null) return;
    const byName = new Map(keys.map((one) => [one.name, one]));
    for (const group of root.querySelectorAll<SVGGElement>('.key-group')) {
      const name = group.getAttribute('data-name');
      const key = name === null ? undefined : byName.get(name);
      if (key === undefined) continue;
      group.setAttribute('data-state', key.state);
      if (name === picked) group.setAttribute('data-picked', '');
      else group.removeAttribute('data-picked');
      // Reachable without a pointer, and announced. 54 tab stops is a lot, and the alternative was a
      // keypad no keyboard could touch at all; a landmark and a name each is what makes it navigable.
      if (key.state === 'unmeasured') {
        group.removeAttribute('tabindex');
        group.removeAttribute('role');
      } else {
        group.setAttribute('tabindex', '0');
        group.setAttribute('role', 'button');
        group.setAttribute('aria-label', name ?? '');
        group.setAttribute('aria-pressed', name === picked ? 'true' : 'false');
      }
    }
  }, [keys, picked, drawing]);

  const pickFrom = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const group = target.closest('.key-group');
    const name = group?.getAttribute('data-name');
    if (name !== null && name !== undefined) onPick(name);
  };

  return (
    <div
      ref={frame}
      className={classes.keypad}
      onClick={(event) => pickFrom(event.target)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        // Space scrolls a page by default, and the page behind this one is long enough to notice.
        event.preventDefault();
        pickFrom(event.target);
      }}
    >
      <Silhouette drawing={drawing} detail="full" />
    </div>
  );
}

/** The colour key, so the five states are readable without pressing anything. */
export function KeypadLegend({ children }: { readonly children: ReactNode }) {
  return <div className={classes.legend}>{children}</div>;
}

export function LegendItem({ state, children }: {
  readonly state: KeyOnScreen['state'];
  readonly children: ReactNode;
}) {
  return (
    <span className={classes.legendItem}>
      <span className={classes.swatch} data-state={state} />
      {children}
    </span>
  );
}

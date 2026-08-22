/**
 * The trail in the bar: where you are, and every step above you a way there.
 *
 * **It is the whole of the navigation**, since the back arrows went on 22 August 2026, which is why the
 * first crumb is the root and why every crumb but the last is a button. Before that it was a second line
 * under a title and could afford to be quiet; now it is the only control in the bar and is sized to say so.
 *
 * It draws what `trail.model.ts` computed and decides nothing. The last crumb is plain text rather than a
 * dead button, because a control that puts you where you already are teaches somebody that the trail is
 * decoration.
 *
 * The separator is a chevron rather than a slash, which is Danny's own way of writing these out and reads
 * as a direction rather than as a path on a disk.
 */
import type { ReactNode } from 'react';

import { ChevronGlyph } from './Glyphs.tsx';
import classes from './Breadcrumbs.module.scss';

interface BreadcrumbsProps {
  readonly crumbs: readonly { readonly label: string; readonly onClick?: (() => void) | undefined }[];
  /** Drawn instead of the first crumb's words, for the application's wordmark. */
  readonly root?: ReactNode;
}

export function Breadcrumbs({ crumbs, root }: BreadcrumbsProps) {
  return (
    <nav className={classes.trail} aria-label="Where you are">
      {crumbs.map((crumb, at) => {
        // The root is drawn larger and in its own colour, because it is the name of the thing you are in.
        // Its content may be a node, and then the label still has to reach the accessibility tree, which
        // is what the title is for: a wordmark drawn as two spans reads as two words otherwise.
        const inside = at === 0 && root !== undefined ? root : crumb.label;
        const shape = at === 0 ? classes.root : '';
        return (
          <span key={`${at}-${crumb.label}`} className={classes.step}>
            {at > 0 && (
              <span className={classes.divider} aria-hidden="true">
                <ChevronGlyph towards="right" size={14} />
              </span>
            )}
            {crumb.onClick === undefined
              ? (
                <span className={`${classes.here} ${shape}`} aria-current="page" title={crumb.label}>
                  {inside}
                </span>
                )
              : (
                <button
                  type="button"
                  className={`${classes.link} ${shape}`}
                  onClick={crumb.onClick}
                  title={crumb.label}
                >
                  {inside}
                </button>
                )}
          </span>
        );
      })}
    </nav>
  );
}

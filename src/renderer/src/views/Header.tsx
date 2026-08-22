/**
 * The shape of a header bar: the trail on the left, whatever belongs on the right.
 *
 * **One shape used twice**, which is the point of the file existing. The application has a bar and the
 * device library panel has one, and Danny asked for them to look alike. Two components that are supposed
 * to look alike are two components that stop looking alike the day one of them is touched, and no test can
 * see it: both would render.
 *
 * **There is no title and no arrow, and that is the shape now**, decided on 22 August 2026. It carried
 * three things for a day: a way back, a title, and the trail under the title. The trail says everything the
 * title said, since its first crumb is the root, and it says it as a place you can press. So the arrow went,
 * because navigation is the trail and nothing else, and the title went because it would be the first crumb
 * written twice. The bar is one line again as a result.
 *
 * It holds nothing and decides nothing. What the trail says and what sits on the right are questions
 * somebody else has answered.
 */
import type { ReactNode } from 'react';

import { Breadcrumbs } from './Breadcrumbs.tsx';
import classes from './Header.module.scss';

export interface HeaderProps {
  readonly crumbs: readonly { readonly label: string; readonly onClick?: (() => void) | undefined }[];
  /**
   * What to draw in place of the first crumb's words.
   *
   * For one caller: the application's root crumb is its wordmark, two shades of one word, and that is a
   * drawing decision rather than a trail one. The crumb is still a crumb, still pressable and still where
   * the trail says it is.
   */
  readonly root?: ReactNode;
  /** Buttons on the right: the library on the application's bar, closing on the panel's. */
  readonly right?: ReactNode;
  /** Drawn behind everything, and only the application has one. */
  readonly behind?: ReactNode;
  /**
   * What the bar looks like, which is the caller's and not this file's.
   *
   * The application's bar is glass over a page that scrolls under it; the panel's sits inside an opaque
   * sheet and must not be sticky or translucent. Layout is shared, appearance is not, and putting both
   * here would need a flag that means "am I the application", which is the wrong question for a shape.
   */
  readonly className?: string | undefined;
}

export function Header({ crumbs, root, right, behind, className }: HeaderProps) {
  return (
    <header className={`${classes.bar} ${className ?? ''}`}>
      {behind}

      <div className={classes.left}>
        <Breadcrumbs crumbs={crumbs} root={root} />
      </div>

      {right !== undefined && <div className={classes.right}>{right}</div>}
    </header>
  );
}

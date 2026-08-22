/**
 * A horizontal strip with an arrow at each end, built out of CSS and one scroll listener.
 *
 * Mantine's carousel is a separate package with `embla` underneath it, which is three dependencies for
 * a row that scrolls. This is a flex row with `scroll-snap`, so the browser does the physics, the
 * pointer and the trackpad work without being told to, and a keyboard reaches the tiles because they
 * are still just elements in the document.
 *
 * The arrows disable themselves at each end, which is the one thing that needs JavaScript: nothing in
 * CSS can say "there is more to the right". Measured on scroll rather than counted from the number of
 * tiles, because a tile's width depends on the model in it.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { ChevronGlyph } from './Glyphs.tsx';
import classes from './Carousel.module.scss';

interface CarouselProps {
  readonly children: ReactNode;
  /** What the arrows are for, for anybody not looking at the screen. */
  readonly label: string;
}

export function Carousel({ children, label }: CarouselProps) {
  const strip = useRef<HTMLDivElement>(null);
  const [reach, setReach] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const it = strip.current;
    if (it === null) return;
    // A pixel of slack: a fractional scroll width is normal after a zoom or a scale, and without it
    // the right arrow stays enabled at the end forever.
    setReach({
      left: it.scrollLeft > 1,
      right: it.scrollLeft + it.clientWidth < it.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    measure();
    const it = strip.current;
    if (it === null) return undefined;
    const watch = new ResizeObserver(measure);
    watch.observe(it);
    for (const child of it.children) watch.observe(child);
    return () => watch.disconnect();
  }, [measure, children]);

  const nudge = (towards: 'left' | 'right') => {
    const it = strip.current;
    if (it === null) return;
    // By one tile where there is one, so a press moves a whole card rather than an arbitrary distance.
    const tile = it.firstElementChild?.getBoundingClientRect().width ?? it.clientWidth;
    const gap = Number.parseFloat(getComputedStyle(it).columnGap) || 0;
    it.scrollBy({ left: (towards === 'left' ? -1 : 1) * (tile + gap), behavior: 'smooth' });
  };

  // No arrows at all where everything fits, rather than two greyed circles. A disabled control says
  // "not now"; an absent one says "there is nothing here", and with three tiles on a wide window the
  // second is the truth.
  const scrollable = reach.left || reach.right;

  return (
    <div className={scrollable ? classes.frame : classes.frameStill}>
      {scrollable && (
        <button
          type="button"
          className={classes.arrow}
          aria-label={`${label}, back`}
          disabled={!reach.left}
          onClick={() => nudge('left')}
        >
          <ChevronGlyph towards="left" size={22} />
        </button>
      )}

      <div
        className={scrollable ? classes.strip : `${classes.strip} ${classes.stripStill}`}
        ref={strip}
        onScroll={measure}
        role="group"
        aria-label={label}
      >
        {children}
      </div>

      {scrollable && (
        <button
          type="button"
          className={classes.arrow}
          aria-label={`${label}, forward`}
          disabled={!reach.right}
          onClick={() => nudge('right')}
        >
          <ChevronGlyph towards="right" size={22} />
        </button>
      )}
    </div>
  );
}

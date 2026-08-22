/**
 * The bar across the top of the application: the trail, and the way in to the device library.
 *
 * Its layout is `Header.tsx`, shared with the library panel's own bar so the two cannot drift apart. What
 * is here is what only this bar has: the wordmark that stands in for the trail's first crumb, the
 * decorative pulse behind it, and the one action.
 *
 * **The wordmark is a crumb now**, which is the change of 22 August 2026: pressing it is how you get Home,
 * because the back arrow is gone and the trail is the whole of the navigation. It reads as a title and
 * behaves as a link, which is what a root crumb is.
 *
 * **The beam mark went with the arrow.** It was a small drawing of a signal leaving a remote, sitting to
 * the left of the word, and at that size it read as a wireless indicator, which is a thing an application
 * has rather than a thing it is. The pulse train across the right of the bar says the same thing without
 * pretending to be a status.
 *
 * **That action is the only one, and it earned its place.** The two buttons this bar used to carry were
 * removed, because a permanent toolbar of actions is what a bar becomes when nobody decides where an action
 * lives. The library is different in kind: it is not an action on what you are looking at, it is a place
 * that belongs to no screen, so there is nowhere else it could sit.
 *
 * **It says what it is, and carries no count.** The words are Danny's, on the ground that a drawing alone
 * has to be learned; the absence of a number is his too, and it is right for what the button is: a way in,
 * not a report. A number on it would make the bar say something that changes while you are not looking.
 */
import { CogGlyph, PulseTrain } from './Glyphs.tsx';
import { Header } from './Header.tsx';
import { KindGlyph } from './KindGlyph.tsx';
import classes from './AppBar.module.scss';

interface AppBarProps {
  readonly crumbs: readonly { readonly label: string; readonly onClick?: (() => void) | undefined }[];
  readonly onLibrary: () => void;
  readonly onPreferences: () => void;
}

export function AppBar({ crumbs, onLibrary, onPreferences }: AppBarProps) {
  return (
    <Header
      className={classes.bar}
      behind={<PulseTrain className={classes.pulse} />}
      crumbs={crumbs}
      root={(
        // Two spans, each with its own colour, so the wordmark looks the same whether its crumb is a link
        // or the page you are on: a child's colour beats the one it would inherit from the crumb.
        <span className={classes.wordmark}>
          Free<span className={classes.wordmarkTail}>Harmony</span>
        </span>
      )}
      right={(
        <>
          <button
            type="button"
            className={classes.action}
            onClick={onLibrary}
            aria-label="Device library"
          >
            {/* The television, because it is the one category everybody has and the drawing reads at this
                size. A stack of shapes standing for "a collection" was tried and read as a menu. */}
            <KindGlyph kind="television" size={18} />
            <span>Device library</span>
          </button>
          {/* Preferences, and it is icon only on purpose: it is the one thing in the bar somebody visits
              twice and then never again, so it should not compete with the library for width. */}
          <button
            type="button"
            className={`${classes.action} ${classes.iconOnly}`}
            onClick={onPreferences}
            aria-label="Preferences"
          >
            <CogGlyph size={18} />
          </button>
        </>
      )}
    />
  );
}

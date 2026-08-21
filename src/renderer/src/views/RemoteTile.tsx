/**
 * One remote or one model, as a tile: a picture, a name, and something underneath it.
 *
 * Both carousels use this, which is deliberate. On Home a tile is a remote somebody owns and the
 * caption is when it was added; in the chooser it is a model and the caption is what the hardware has.
 * Making them one component is what keeps the two rows looking like the same application, and it is
 * where the tile's one real rule lives: **a tile without a drawing still has to look like a tile.**
 * Three of the forty models Logitech retired are drawn, so a remote with no picture is ordinary.
 */
import { type Model } from '@harmony/silhouettes';

import { Silhouette } from './Silhouette.tsx';
import classes from './RemoteTile.module.scss';

interface RemoteTileProps {
  readonly title: string;
  /** The line under the name. One line, and it may be empty. */
  readonly caption?: string;
  readonly drawing: Model | undefined;
  readonly selected?: boolean;
  readonly onClick: () => void;
}

export function RemoteTile({ title, caption, drawing, selected = false, onClick }: RemoteTileProps) {
  return (
    <button
      type="button"
      className={`${classes.tile} ${selected ? classes.selected : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className={classes.stage}>
        {drawing === undefined
          ? (
            // No picture, so the initial stands in for one. It is a shape at the size of a drawing
            // rather than an apology in small print, because most models will land here.
            <span className={classes.unknown} aria-hidden="true">{title.slice(0, 1).toUpperCase()}</span>
            )
          : <Silhouette drawing={drawing} detail="tile" />}
      </span>
      <span className={classes.title}>{title}</span>
      {caption !== undefined && <span className={classes.caption}>{caption}</span>}
    </button>
  );
}

/** The tile that is not a remote: the one that adds one. Same size, so the row keeps its rhythm. */
export function AddTile({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <button type="button" className={`${classes.tile} ${classes.add}`} onClick={onClick}>
      <span className={classes.stage}>
        <span className={classes.plus} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.7"
                  strokeLinecap="round" />
          </svg>
        </span>
      </span>
      <span className={classes.title}>{label}</span>
    </button>
  );
}

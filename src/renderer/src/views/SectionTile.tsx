/**
 * A compact tile: a number, what it is a number of, and one line underneath.
 *
 * **Not `RemoteTile`, and the difference is the picture.** That one is built around a drawing at two
 * hundred pixels, which is right for choosing between remotes on a shelf and wrong for everything else:
 * a row of three of them for Devices, Activities and Settings would be a row of three empty stages.
 *
 * The number is the tile's whole point. "Devices" on its own is a word somebody has to press to learn
 * anything; "4" above it answers the question the press was going to ask. Where there is no number,
 * Settings being the case, the tile is the title and the line, and it still lines up because the height
 * is fixed rather than derived from what is in it.
 *
 * **`data-tile` is there so the interface can be checked**, and it is worth a line because it is the one
 * thing here that exists for a test. Class names are hashed by the bundler, so a test cannot ask for a
 * tile by class: `test/styles.test.ts` records that a pattern over them matched Mantine's own. Counting
 * tiles by shape instead nearly passed for the wrong reason, because the grid holding them is a `div`
 * whose text begins with the first tile's number. One attribute makes the question exact, and it also
 * says in the markup what these elements are, which no class name of ours can.
 */
import classes from './SectionTile.module.scss';

interface SectionTileProps {
  /** The big figure. Absent where the tile is not about a count. */
  readonly value?: string | number;
  readonly title: string;
  /** One line under the title. It may be empty and the tile keeps its shape. */
  readonly caption?: string;
  /**
   * What pressing it does, or absent because there is nowhere to go yet.
   *
   * **Absent renders a plain tile and not a dead button**, which is the point of the option existing. The
   * activities page shows what a remote can be switched into and has nothing to open behind it, and a
   * tile that lifts under the pointer and then does nothing is worse than one that never offered: it
   * makes somebody press twice to find out.
   */
  readonly onClick?: () => void;
  /** Drawn with a ring, for a tile that is one of a set being chosen from. */
  readonly selected?: boolean;
}

export function SectionTile({ value, title, caption, onClick, selected = false }: SectionTileProps) {
  const inside = (
    <>
      {value !== undefined && <span className={classes.value}>{value}</span>}
      <span className={classes.title}>{title}</span>
      {caption !== undefined && caption !== '' && <span className={classes.caption}>{caption}</span>}
    </>
  );
  return onClick === undefined
    ? <div data-tile="" className={`${classes.tile} ${classes.flat}`}>{inside}</div>
    : (
      <button
        data-tile=""
        type="button"
        className={`${classes.tile} ${selected ? classes.selected : ''}`}
        aria-pressed={selected}
        onClick={onClick}
      >
        {inside}
      </button>
      );
}

/** The tile that adds one. Dashed, same size, so the row keeps its rhythm. */
export function AddSectionTile({ label, onClick }: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button data-tile="add" type="button" className={`${classes.tile} ${classes.add}`} onClick={onClick}>
      <span className={classes.plus} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.7"
                strokeLinecap="round" />
        </svg>
      </span>
      <span className={classes.title}>{label}</span>
    </button>
  );
}

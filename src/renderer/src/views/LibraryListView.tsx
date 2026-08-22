/**
 * Every device this machine has a description of, as a grid.
 *
 * A grid and not a carousel, decided on 22 August 2026 after looking at the carousel: a row that scrolls
 * sideways is right for choosing between a handful of remotes and wrong here, where the whole point is to
 * see what you have. The add tile comes first, so the one thing you can always do is in the one place that
 * does not move when the collection grows.
 *
 * **Nearly everything on it has no name, and that is the truth about a fresh import rather than a gap.** A
 * configuration states codes and positions and no words at all: no manufacturer, no model, nothing saying
 * a device is a television. `nameFor` next door is the order of how much anybody actually knows.
 */
import { Text } from '@mantine/core';

import type { LibraryState } from '../viewmodels/library.model.ts';
import { captionFor, listed, nameFor, usedByCount } from '../viewmodels/library.model.ts';
import { KindGlyph } from './KindGlyph.tsx';
import { AddSectionTile, SectionTile } from './SectionTile.tsx';
import classes from './LibraryListView.module.scss';

interface LibraryListViewProps {
  readonly state: LibraryState;
  readonly onOpen: (id: string) => void;
  readonly onAdd: () => void;
}

export function LibraryListView({ state, onOpen, onAdd }: LibraryListViewProps) {
  const definitions = listed(state);

  return (
    <section className={classes.library}>
      <div className={classes.heading}>
        {/* No heading of its own. The panel's bar says "Device library" two rows above this, and a page
            that repeats its own chrome is exactly what the trail rule refuses. The sentence is the page's
            voice; the title is the panel's. */}
        <Text className={classes.lead}>
          The device library shows all known devices in your household that can be used in your remotes.
        </Text>
      </div>

      {state.status === 'failed' && <Text c="red" size="sm">{state.error}</Text>}

      <div className={classes.grid}>
        <AddSectionTile label="Add..." onClick={onAdd} />
        {definitions.map((definition) => (
          <SectionTile
            key={definition.id}
            glyph={<KindGlyph kind={definition.kind} size={34} />}
            title={nameFor(definition, state)}
            caption={captionFor(definition, state)}
            // How many remotes use it, and nothing when that is none: a badge is a positive signal, so a
            // zero on one would draw the eye to the absence of news.
            badge={usedByCount(state, definition.id) || undefined}
            onClick={() => onOpen(definition.id)}
          />
        ))}
      </div>
    </section>
  );
}

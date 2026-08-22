/**
 * The devices on one remote: a tile per position, and one that adds another.
 *
 * **A tile is a position on this remote and not an appliance.** That distinction is the model's, decided
 * on 22 August 2026, and it is the whole reason the page reads the way it does: the same television
 * belongs to every remote that drives it, so it is described once in a library beside the remotes, and
 * what sits here is the **use** of one, with the name its owner gave it on this particular remote. Four
 * copies of one LG is one description and four uses.
 *
 * So a tile shows the category's own drawing, what you call it here, and the make and model **only where
 * those are not already the title**. Danny's, on 22 August 2026, and the third clause is the point: a
 * tile that said `Sony KD-43` with `Sony KD-43` under it was the same words twice, and the command count
 * that used to sit where the drawing is now was a number about the description rather than about this
 * remote.
 *
 * The drawing is the same one the library uses for the same appliance, which is what makes a device
 * recognisable in two places rather than readable in two places.
 */
import { Text, Title } from '@mantine/core';

import type { DocumentContents } from '../../../shared/content.ts';
import { headingOnRemote } from '../../../shared/library.ts';
import { definitionIn, type LibraryState } from '../viewmodels/library.model.ts';
import { KindGlyph } from './KindGlyph.tsx';
import { AddSectionTile, SectionTile } from './SectionTile.tsx';
import classes from './DevicesView.module.scss';

interface DevicesViewProps {
  readonly remote: string;
  readonly contents: DocumentContents | undefined;
  readonly library: LibraryState;
  readonly onOpen: (slot: number) => void;
  readonly onAdd: () => void;
}

export function DevicesView({ remote, contents, library, onOpen, onAdd }: DevicesViewProps) {
  const devices = contents?.content.devices ?? [];

  return (
    <section className={classes.devices}>
      <div className={classes.heading}>
        <Title order={2} className={classes.title}>Devices</Title>
        <Text className={classes.lead}>
          {devices.length === 0
            // Two different absences and the page says which. Nothing imported is not the same as a
            // remote that drives nothing.
            //
            // **Neither of them is a dead end**, and the first version of this said it was: "there is
            // nothing here to drive". A remote with no configuration can still be told what it drives,
            // which is the case the shared library exists for, and the wording was following a refusal
            // two layers down that turned out to be wrong.
            ? contents === undefined
              ? `Nothing has been imported into ${remote} yet. You can still say what it drives: `
                + 'pick an appliance this machine already describes.'
              : `${remote} does not drive anything yet.`
            : `What ${remote} drives. Each one is described once and shared with every other remote `
              + 'that uses it.'}
        </Text>
      </div>

      <div className={classes.grid}>
        {devices.map((use) => {
          const definition = definitionIn(library, use.definition);
          const heading = headingOnRemote(use.label, definition, use.slot);
          return (
            <SectionTile
              key={use.slot}
              // The category's drawing, in place of the command count this used to lead with. A number of
              // commands is a fact about the description, and it is on the description's own page; what a
              // person scanning this grid is looking for is which of their appliances this one is.
              //
              // `other` where the description is on another machine, which is the one case with nothing to
              // draw from. It is said in words at the foot of the page rather than guessed at here.
              glyph={<KindGlyph kind={definition?.kind ?? 'other'} size={34} />}
              title={heading.title}
              caption={heading.under ?? (definition === undefined ? 'not on this machine' : '')}
              onClick={() => onOpen(use.slot)}
            />
          );
        })}
        <AddSectionTile label="Add a device" onClick={onAdd} />
      </div>

      {contents !== undefined && contents.missing.length > 0 && (
        // The cost of the library sitting outside the document, answered rather than discovered. A page
        // with holes in it and no explanation is the failure this replaces.
        <Text className={classes.missing}>
          {contents.missing.length === 1
            ? 'One of these is described on another machine and not on this one.'
            : `${contents.missing.length} of these are described on another machine and not on this one.`}
        </Text>
      )}
    </section>
  );
}

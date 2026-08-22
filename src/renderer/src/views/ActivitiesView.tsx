/**
 * The activities on one remote: what it can be switched into, and what each one drives.
 *
 * **Deliberately thin, and it says what it cannot do.** An activity is the piece of the model with the
 * most in it that a configuration does not state: their names are read off the pixels their own screens
 * draw, and what kind of activity each one is, and what it wants every appliance to be doing, were
 * discarded by the compiler that built the file. So this lists what is known and does not offer to edit
 * it yet.
 *
 * Making one is next and needs nothing from the format: the document is ours, and only compiling a
 * configuration out of it is out of reach.
 */
import { Text, Title } from '@mantine/core';

import type { DocumentContents } from '../../../shared/content.ts';
import { SectionTile } from './SectionTile.tsx';
import classes from './DevicesView.module.scss';

interface ActivitiesViewProps {
  readonly remote: string;
  readonly contents: DocumentContents | undefined;
}

export function ActivitiesView({ remote, contents }: ActivitiesViewProps) {
  const activities = contents?.content.activities ?? [];
  const devices = contents?.content.devices ?? [];

  /** The appliances an activity drives, by the names their owner gave them on this remote. */
  const drives = (slots: readonly number[]): string =>
    slots
      .map((slot) => devices.find((one) => one.slot === slot)?.label ?? `position ${slot + 1}`)
      .join(', ');

  return (
    <section className={classes.devices}>
      <div className={classes.heading}>
        <Title order={2} className={classes.title}>Activities</Title>
        <Text className={classes.lead}>
          {activities.length === 0
            ? contents === undefined
              ? `Nothing has been imported into ${remote} yet.`
              : `${remote} has no activities set up.`
            : `What ${remote} can be switched into. The names are the words the remote draws on its own `
              + 'screen, since nothing in a configuration states them.'}
        </Text>
      </div>

      <div className={classes.grid}>
        {activities.map((activity) => (
          <SectionTile
            key={activity.slot}
            value={activity.devices.length}
            title={activity.name ?? `Activity ${activity.slot + 1}`}
            caption={drives(activity.devices)}
            // No `onClick`, so it draws as a plain tile. There is nothing to open behind it yet, and a
            // tile that lifts under the pointer and does nothing makes somebody press twice to find out.
          />
        ))}
      </div>
    </section>
  );
}

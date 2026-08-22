/**
 * One device position on one remote: what you call it, what it is, and what it can do.
 *
 * **A position and not an appliance**, which is the model's own split: the description lives in a library
 * beside the remotes because the same television belongs to every remote that drives it, and what sits
 * here is the use of one. So the name at the top is yours and the facts under it are the appliance's.
 *
 * **Read only for now, and the reason is not shyness.** Pointing this position at a different description
 * is the one edit in the model that can go wrong silently, because a button names *the hundred and
 * twelfth* command of whatever sits here. `src/shared/relink.ts` is the rewrite that makes it safe and it
 * refuses to guess, so where two descriptions are not the same set of codes somebody has to be told what
 * would not carry over. That belongs with the device manager, where the descriptions are.
 *
 * The command list is the honest picture of what an import gives you: codes, and almost never a word.
 * Nothing in a configuration names a command, so `Command 12` is not a placeholder, it is the fact.
 */
import { Text, Title } from '@mantine/core';

import type { DocumentContents } from '../../../shared/content.ts';
import { describeDefinition, type DeviceDefinition } from '../../../shared/library.ts';
import classes from './DeviceView.module.scss';

interface DeviceViewProps {
  readonly remote: string;
  readonly slot: number;
  readonly contents: DocumentContents | undefined;
  readonly definition: DeviceDefinition | undefined;
}

export function DeviceView({ remote, slot, contents, definition }: DeviceViewProps) {
  const use = contents?.content.devices.find((one) => one.slot === slot);
  if (use === undefined) {
    return <Text size="sm">{remote} has nothing at position {slot + 1}.</Text>;
  }

  // Every button that sends to this position, which is the fact that makes a device more than a list of
  // codes: how much of the remote is pointed at it.
  const buttons = (contents?.content.buttons ?? [])
    .filter((one) => one.sends.some((step) => step.device === slot));
  const activities = (contents?.content.activities ?? [])
    .filter((one) => one.devices.includes(slot));

  return (
    <section className={classes.device}>
      <div className={classes.heading}>
        <Title order={2} className={classes.title}>{use.label ?? `Position ${slot + 1}`}</Title>
        <Text className={classes.lead}>
          {definition === undefined
            ? 'This appliance is described on another machine and not on this one.'
            : describeDefinition(definition)
              ?? 'Nothing here says what this is yet. A configuration states no manufacturer and no model.'}
        </Text>
      </div>

      <dl className={classes.facts}>
        <dt>Commands</dt>
        <dd>{definition?.commands.length ?? 0}</dd>
        <dt>Buttons that use it</dt>
        <dd>{buttons.length}</dd>
        <dt>Activities that drive it</dt>
        <dd>
          {activities.length === 0
            ? 'none'
            : activities.map((one) => one.name ?? `activity ${one.slot + 1}`).join(', ')}
        </dd>
        <dt>Where it came from</dt>
        <dd>{definition === undefined ? 'unknown' : ORIGIN[definition.origin]}</dd>
      </dl>

      {definition !== undefined && definition.commands.length > 0 && (
        <div className={classes.commands}>
          {definition.commands.map((command) => (
            <span key={command.slot} className={classes.command}>
              {/* The name where there is one, and the position where there is not, which is nearly
                  always: naming these is what the Logitech catalogue is for. */}
              {command.name ?? `Command ${command.slot + 1}`}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** Where a description came from, which is what decides whether it may ever be shared. */
const ORIGIN: Readonly<Record<DeviceDefinition['origin'], string>> = {
  'learned-here': 'taught to this application from a real remote',
  'from-logitech': "fetched from Logitech's own catalogue",
  'from-a-configuration': 'read out of a configuration that was already on a remote',
};

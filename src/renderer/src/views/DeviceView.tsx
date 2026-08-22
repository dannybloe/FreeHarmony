/**
 * One device position on one remote: what you call it, and which of this remote's keys drive it.
 *
 * **A position and not an appliance**, which is the model's own split: the description lives in a library
 * beside the remotes because the same television belongs to every remote that drives it, and what sits
 * here is the use of one. So the name at the top is yours and the facts under it are the appliance's.
 *
 * **The page is the remote itself now**, which is Danny's layout of 22 August 2026 and a change of subject
 * rather than of decoration. It used to lead with "Position 1" and a list of command chips, which says
 * what the description holds; what somebody opening this page wants is which button does what. So the
 * remote is drawn down the left with its keys coloured by what they are doing, and pressing one offers the
 * commands this device has.
 *
 * **The keypad is shown one activity at a time**, because every keypad binding in the corpus has an
 * activity, all 1122 of them, which follows from what a remote is for: the volume key sends to the amplifier
 * while you are listening to music and to the television while you are watching it. The first version of
 * this page read the bindings with no context instead and showed nothing at all on a configuration holding
 * 220, which is how the measurement came to be made.
 *
 * **A device mode would be the exception and this page does not offer one**, which is a gap rather than a
 * decision. A Harmony can be put into device mode, where the keypad drives one device with nothing running;
 * none of these configurations carries a keypad map for that, so there is nothing to show and nothing to
 * check the writing against. `test/import.test.ts` states the population it was measured over.
 *
 * Two things it deliberately does not do.
 *
 * It does not bind the **screen** keys. A remote with a display speaks for a second population that shares
 * no scan code with the keypad on three of the four architectures, and it is a later round.
 *
 * And it does not point this position at a **different description**. That is the one edit in the model
 * that can go wrong silently, because a binding names *the hundred and twelfth* command of whatever sits
 * here; `src/shared/relink.ts` is the rewrite that makes it safe and it belongs with the library.
 */
import { SegmentedControl, Select, Text } from '@mantine/core';
import { useState } from 'react';

import type { DocumentContents } from '../../../shared/content.ts';
import type { DeviceDefinition } from '../../../shared/library.ts';
import { headingOnRemote } from '../../../shared/library.ts';
import type { RemoteModel } from '../../../shared/remote.ts';
import { drawingFor } from '../catalogue.ts';
import { keypadFor, measuredKeys, spelledOut, type KeyOnScreen } from '../viewmodels/keypad.model.ts';
import { EditableTitle } from './EditableTitle.tsx';
import { Keypad, KeypadLegend, LegendItem } from './Keypad.tsx';
import classes from './DeviceView.module.scss';

interface DeviceViewProps {
  readonly remote: string;
  readonly model: RemoteModel | undefined;
  readonly slot: number;
  readonly contents: DocumentContents | undefined;
  readonly definition: DeviceDefinition | undefined;
  readonly busy: boolean;
  /** The empty string takes the label away, which is a real thing to want: the library then names it. */
  readonly onLabel: (label: string) => void;
  /** `undefined` clears the key. The activity is not optional, per this file's own docstring. */
  readonly onAssign: (scan: number, activity: number, command?: number) => void;
}

export function DeviceView({
  remote, model, slot, contents, definition, busy, onLabel, onAssign,
}: DeviceViewProps) {
  const [picked, setPicked] = useState<string | undefined>(undefined);
  // Which activity's keypad is being looked at. View state and not navigation: coming back to this page
  // should not remember which activity somebody was last looking through.
  const [within, setWithin] = useState<number | undefined>(undefined);

  const use = contents?.content.devices.find((one) => one.slot === slot);
  if (use === undefined) {
    return <Text size="sm">{remote} has nothing at position {slot + 1}.</Text>;
  }

  const heading = headingOnRemote(use.label, definition, slot);
  const drawing = drawingFor(model);
  const buttons = contents?.content.buttons ?? [];

  // The activities that drive this position, which is both the line Danny asked for under the title and the
  // thing the keypad has to be seen through. Named where the configuration names them and numbered where it
  // does not: an activity's name is drawn on a screen and reading it back is the library's job.
  const activities = (contents?.content.activities ?? []).filter((one) => one.devices.includes(slot));
  const named = (slot_: number) => activities.find((one) => one.slot === slot_)?.name
    ?? `activity ${slot_ + 1}`;
  // The first one, until somebody chooses another. `in_` is checked against the list rather than trusted,
  // so a chosen activity that goes away with a reload falls back rather than showing an empty keypad.
  const inActivity = activities.some((one) => one.slot === within) ? within : activities[0]?.slot;

  const keys = drawing === undefined || inActivity === undefined
    ? []
    : keypadFor(drawing, buttons, slot, inActivity);
  const chosen = keys.find((one) => one.name === picked);

  return (
    <section className={classes.device}>
      <div className={classes.heading}>
        <EditableTitle
          value={heading.title}
          // Empty rather than the shown name, so typing does not silently turn the library's name for the
          // appliance into your own label for this position. The placeholder says what it will keep saying.
          draft={use.label ?? ''}
          placeholder={heading.title}
          onCommit={onLabel}
          className={classes.title}
        />
        {heading.under !== undefined && <span className={classes.under}>{heading.under}</span>}
        <Text className={classes.activities}>
          {activities.length === 0
            ? 'No activity drives this yet.'
            : `Used by ${activities.map((one) => named(one.slot)).join(', ')}.`}
        </Text>
      </div>

      {drawing === undefined
        ? (
          <Text size="sm" c="dimmed">
            {/* No drawing for most of the forty models, and then there is no keypad to press. Stated
                plainly: the alternative was a list of scan numbers, which is a worse answer than none. */}
            Buttons can be assigned on a remote this application has a drawing of. {remote} is
            a {model?.name ?? 'model nobody has drawn'}.
          </Text>
          )
        : inActivity === undefined
          ? (
            <Text size="sm" c="dimmed">
              {/* No activity drives this, so there is no context in which one of its buttons could mean
                  anything. Not a caveat: it is the one thing to do next, and creating an activity is a
                  round of its own. */}
              A button sends a command while an activity is running, and no activity drives this device
              yet. That is what has to come first.
            </Text>
            )
          : (
          <div className={classes.board}>
            <div className={classes.left}>
              {/* One activity at a time, because a key means something different in each of them. A single
                  activity gets no chooser: a control with one option is a control that does nothing. */}
              {activities.length > 1 && (
                <SegmentedControl
                  size="xs"
                  value={String(inActivity)}
                  data={activities.map((one) => ({ value: String(one.slot), label: named(one.slot) }))}
                  onChange={(value) => { setWithin(Number(value)); setPicked(undefined); }}
                />
              )}
              <Keypad
                drawing={drawing}
                keys={keys}
                picked={picked}
                onPick={(name) => setPicked(name)}
              />
              <KeypadLegend>
                <LegendItem state="mine">drives this device</LegendItem>
                <LegendItem state="taken">another device</LegendItem>
                <LegendItem state="free">free</LegendItem>
                <LegendItem state="unmeasured">code not measured</LegendItem>
              </KeypadLegend>
            </div>

            <div className={classes.right}>
              <Chosen
                key={`${inActivity}:${chosen?.name ?? 'none'}`}
                chosen={chosen}
                definition={definition}
                inActivity={named(inActivity)}
                model={model}
                keys={keys}
                busy={busy}
                onAssign={(scan, command) => onAssign(scan, inActivity, command)}
              />
            </div>
          </div>
          )}
    </section>
  );
}

/**
 * The key that is being looked at, and what it can be pointed at.
 *
 * Keyed on the key's name where it is used, so choosing a different key resets the chooser rather than
 * carrying the previous key's selection into it. That is the bug the `key` prop exists for and it is
 * cheaper than an effect.
 */
function Chosen({ chosen, definition, inActivity, model, keys, busy, onAssign }: {
  readonly chosen: KeyOnScreen | undefined;
  readonly definition: DeviceDefinition | undefined;
  /** What the activity being looked through is called, for the sentences that have to name it. */
  readonly inActivity: string;
  readonly model: RemoteModel | undefined;
  readonly keys: readonly KeyOnScreen[];
  readonly busy: boolean;
  readonly onAssign: (scan: number, command?: number) => void;
}) {
  const counted = measuredKeys(keys);

  if (chosen === undefined) {
    return (
      <div className={classes.chosen}>
        <h3 className={classes.chosenTitle}>Press a button</h3>
        <Text size="sm" c="dimmed">
          What a button does while {inActivity} is running.{' '}
          {/* Both counts and never a share, which is this project's rule about a number on a screen: "36
              of 54" can be checked against the drawing beside it. */}
          {counted.measured} of {counted.total} buttons on a {model?.name ?? 'remote'} have a code this
          application knows, and those are the ones that can be pointed at something.
        </Text>
      </div>
    );
  }

  const name = spelledOut(chosen.name);

  if (chosen.state === 'unmeasured') {
    return (
      <div className={classes.chosen}>
        <h3 className={classes.chosenTitle}>{name}</h3>
        <Text size="sm" c="dimmed">
          {/* Said here rather than as a warning on the page, and only when somebody presses one: nobody
              needs to be told at the top of the page what a fifth of the keys cannot do. */}
          What this button sends has never been measured on a {model?.name ?? 'remote of this model'}, so
          it cannot be pointed at anything yet.
        </Text>
      </div>
    );
  }

  if (chosen.state === 'taken') {
    return (
      <div className={classes.chosen}>
        <h3 className={classes.chosenTitle}>{name}</h3>
        <Text size="sm" c="dimmed">
          In {inActivity} this button drives position {(chosen.ownedBy ?? 0) + 1}. Within one activity a
          button sends to one device, so freeing it there is what makes it available here.
        </Text>
      </div>
    );
  }

  const commands = definition?.commands ?? [];
  const held = chosen.sends[0];
  const scan = chosen.scan!;

  return (
    <div className={classes.chosen}>
      <h3 className={classes.chosenTitle}>{name}</h3>
      {commands.length === 0
        ? (
          <Text size="sm" c="dimmed">
            This device has no commands yet, so there is nothing to point a button at. Importing from a
            remote or fetching it from Logitech is what fills that in.
          </Text>
          )
        : (
          <Select
            label={`Sends, in ${inActivity}`}
            placeholder="nothing"
            data={commands.map((command) => ({
              value: String(command.slot),
              // The name where there is one, and the position where there is not, which is nearly always:
              // a configuration states codes and no words at all, so `Command 12` is the fact rather than
              // a placeholder.
              label: command.name ?? `Command ${command.slot + 1}`,
            }))}
            value={held === undefined ? null : String(held)}
            disabled={busy}
            // Clearable, because taking a binding away is as ordinary as making one and there is no other
            // control for it.
            clearable
            searchable
            onChange={(value) => onAssign(scan, value === null ? undefined : Number(value))}
            comboboxProps={{ withinPortal: false }}
          />
          )}
    </div>
  );
}

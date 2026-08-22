/**
 * One device on one remote: what you call it, and what each key on the keypad does for it.
 *
 * **A position and not an appliance**, which is the model's own split: the description lives in a library
 * beside the remotes because the same television belongs to every remote that drives it, and what sits
 * here is the use of one. So the name at the top is yours and the facts under it are the appliance's.
 *
 * **The keypad this shows is device mode**, and Danny's picture of it is the one to build from: switching
 * to a device is like reaching for the old remote that came with that appliance. On that old remote there
 * is nothing but that appliance, so a key here sends one of its commands or it sends nothing. That is the
 * whole page.
 *
 * **Activities are not on it, and two earlier versions put them there.** The first showed one activity's
 * map with a chooser above it. The second showed the device's map and then annotated every key with which
 * activities carried it and which other device held it elsewhere, and reported per activity what a save had
 * reached. All of that is about the **activity** map, which is the mixed one: in an activity any key may
 * carry a command of any appliance you own. It is a different page and a later round. Here there is one
 * appliance, so nothing can be in the way and nothing can disagree.
 *
 * The line under the title does name the activities, and that is not the same thing: it says where this
 * **appliance** is used on this remote, which is a fact about the appliance. Nothing about a key comes from
 * it.
 *
 * **A configuration read off a remote holds no device map at all**, measured next door, so an import seeds
 * one from the activity maps and `shared/buttonmap.ts` says how and why.
 *
 * Two things it deliberately does not do.
 *
 * It does not bind the **screen** keys, and that is the largest thing still missing rather than a detail.
 * An old remote has far more buttons than a Harmony, so in device mode what people build is pages on the
 * screen: a screenful of commands at a time, for the functions the keypad has no room for. The keypad below
 * is the smaller half. The screen keys are a separate population that shares no scan code with the keypad on
 * three of the four architectures, and they are a round of their own.
 *
 * And it does not point this position at a **different description**. That is the one edit in the model
 * that can go wrong silently, because a binding names *the hundred and twelfth* command of whatever sits
 * here; `src/shared/relink.ts` is the rewrite that makes it safe and it belongs with the library.
 */
import { Select, Text } from '@mantine/core';
import { useState } from 'react';

import type { DocumentContents } from '../../../shared/content.ts';
import type { DeviceDefinition } from '../../../shared/library.ts';
import { commandLabel, headingOnRemote } from '../../../shared/library.ts';
import type { RemoteModel } from '../../../shared/remote.ts';
import { drawingFor } from '../catalogue.ts';
import { activitiesUsing, boundKeys, keypadFor, measuredKeys, spelledOut, type KeyOnScreen }
  from '../viewmodels/keypad.model.ts';
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
  /** Point a key at one of this device's commands, or clear it with `undefined`. */
  readonly onAssign: (scan: number, command?: number) => void;
}

export function DeviceView({
  remote, model, slot, contents, definition, busy, onLabel, onAssign,
}: DeviceViewProps) {
  const [picked, setPicked] = useState<string | undefined>(undefined);

  const use = contents?.content.devices.find((one) => one.slot === slot);
  if (use === undefined) {
    return <Text size="sm">{remote} has nothing at position {slot + 1}.</Text>;
  }

  const heading = headingOnRemote(use.label, definition, slot);
  const drawing = drawingFor(model);
  const buttons = contents?.content.buttons ?? [];
  const allActivities = contents?.content.activities ?? [];

  // Where this **appliance** is used on this remote, which is the one thing on this page that mentions an
  // activity and is a fact about the appliance rather than about a key.
  const using = activitiesUsing(allActivities, slot);
  const named = (at: number) => allActivities.find((one) => one.slot === at)?.name
    ?? `activity ${at + 1}`;

  const keys = drawing === undefined ? [] : keypadFor(drawing, buttons, slot);
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
          {using.length === 0
            ? 'No activity uses this yet.'
            : `Used by ${using.map(named).join(', ')}.`}
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
        : (
          <div className={classes.board}>
            <div className={classes.left}>
              <Keypad
                drawing={drawing}
                keys={keys}
                picked={picked}
                onPick={(name) => setPicked(name)}
              />
            </div>

            <div className={classes.right}>
              {/* The colour key beside the panel rather than under the drawing, which is where it was
                  first put. It is wider than a remote, so under the drawing it stretched the left column
                  and left the remote small and floating in the middle of it. Here the drawing decides the
                  column's width, and the words explaining the colours sit next to the words about the key
                  somebody pressed. */}
              <KeypadLegend>
                <LegendItem state="mine">sends a command</LegendItem>
                <LegendItem state="free">free</LegendItem>
                <LegendItem state="unmeasured">code not measured</LegendItem>
              </KeypadLegend>
              <Chosen
                key={chosen?.name ?? 'none'}
                chosen={chosen}
                definition={definition}
                model={model}
                keys={keys}
                busy={busy}
                onAssign={onAssign}
              />
            </div>
          </div>
          )}
    </section>
  );
}

/**
 * The key that is being looked at, and which of this device's commands it can send.
 *
 * Keyed on the key's name where it is used, so choosing a different key resets the chooser rather than
 * carrying the previous key's selection into it. That is the bug the `key` prop exists for and it is
 * cheaper than an effect.
 */
function Chosen({ chosen, definition, model, keys, busy, onAssign }: {
  readonly chosen: KeyOnScreen | undefined;
  readonly definition: DeviceDefinition | undefined;
  readonly model: RemoteModel | undefined;
  readonly keys: readonly KeyOnScreen[];
  readonly busy: boolean;
  readonly onAssign: (scan: number, command?: number) => void;
}) {
  if (chosen === undefined) {
    const counted = measuredKeys(keys);
    return (
      <div className={classes.chosen}>
        <h3 className={classes.chosenTitle}>Press a button</h3>
        <Text size="sm" c="dimmed">
          {/* Both counts and never a share, which is this project's rule about a number on a screen: "36
              of 54" can be checked against the drawing beside it. */}
          {boundKeys(keys)} of {counted.measured} usable buttons on a {model?.name ?? 'remote'} send
          something for this device. The other {counted.total - counted.measured} have no measured code, so
          nothing can be put on them yet.
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

  const commands = definition?.commands ?? [];
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
            label="Sends"
            placeholder="nothing"
            data={commands.map((command) => ({
              value: String(command.slot),
              // The name where there is one, and the position where there is not, which is nearly always.
              // The rule is `commandLabel` in the shared model, shared with the commands page in the
              // library: this had its own copy of it until 22 August 2026, and two copies of one
              // derivation is the thing this project has been bitten by twice.
              label: commandLabel(command),
            }))}
            value={chosen.command === undefined ? null : String(chosen.command)}
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

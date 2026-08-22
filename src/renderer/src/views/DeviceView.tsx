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
 * **The keypad it shows is the device's own map, which is what device mode is on a Harmony.** Press
 * Devices, pick the television, and every key drives the television; that is the ordinary way to reach a
 * command an activity does not carry, and it is the whole subject of this page. `CLAUDE.md`'s first
 * section is the operating concept and it comes before this file.
 *
 * A configuration does not state that map. It states one keypad map per activity, so the page derives it
 * from the activities that drive this device, shows a key those disagree about as a disagreement rather
 * than picking one of the answers, and writes a change into the activities that have room for it. Writing
 * one only would leave the remote behaving exactly as before in the activity somebody is sitting in;
 * writing all of them would take a key away from another device in the activities where it is that
 * device's key, which on the Harmony One in the lab is 27 of the first device's 30 keys.
 * `shared/buttonmap.ts` is that derivation and it is shared with the writer, so the sentence this page
 * shows before a change and the change itself cannot disagree.
 *
 * **The first version of this page showed one activity at a time**, with a chooser, which was the wrong
 * question on a page about a device. It was built from a corpus measurement, which can say what these files
 * contain and can never say what the product does.
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
import { Select, Text } from '@mantine/core';
import { useState } from 'react';

import type { DocumentContents } from '../../../shared/content.ts';
import type { KeyInActivity } from '../../../shared/buttonmap.ts';
import type { DeviceDefinition } from '../../../shared/library.ts';
import { headingOnRemote } from '../../../shared/library.ts';
import type { RemoteModel } from '../../../shared/remote.ts';
import { drawingFor } from '../catalogue.ts';
import { drivingActivities, keypadFor, measuredKeys, spelledOut, type KeyOnScreen }
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
  /** What every position on this remote is called, so a key another device holds can be named. */
  readonly names: ReadonlyMap<number, string> | undefined;
  /** The empty string takes the label away, which is a real thing to want: the library then names it. */
  readonly onLabel: (label: string) => void;
  /**
   * Point a key at a command of this device, or clear it with `undefined`.
   *
   * It writes every activity that drives the device, which is the rail: the map belongs to the device and
   * the file stores it per activity. The handler answers with how many it wrote, so the page can say so.
   */
  readonly onAssign: (scan: number, command?: number) => void;
}

export function DeviceView({
  remote, model, slot, contents, definition, names, busy, onLabel, onAssign,
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

  // The activities that drive this position, which is both the line under the title and what decides
  // whether a button can be set at all: a keypad map belongs to an activity in every configuration here,
  // so a device nothing runs for has nowhere for a binding to live. The activity's own declared device
  // list and not its bindings, since an activity that drives the television and has no key for it yet is
  // exactly the case a first assignment is for.
  const driving = drivingActivities(allActivities, slot);
  const named = (at: number) => allActivities.find((one) => one.slot === at)?.name
    ?? `activity ${at + 1}`;
  // What another position on this remote is called, which comes up whenever a key is somebody else's. It
  // is a prop rather than worked out here, because the answer needs the library: a position's own label is
  // usually absent and the name then comes from the description it points at, which this page holds for
  // one position only. `headingOnRemote` is the same function the tiles use, so the word here and the word
  // on the page you came from are the same word.
  const calls = (at: number) => names?.get(at) ?? `position ${at + 1}`;

  const keys = drawing === undefined ? [] : keypadFor(drawing, buttons, slot, allActivities);
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
          {driving.length === 0
            ? 'No activity drives this yet.'
            : `Used by ${driving.map(named).join(', ')}.`}
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
                <LegendItem state="mine">drives this device</LegendItem>
                <LegendItem state="contested">two commands</LegendItem>
                <LegendItem state="taken">another device</LegendItem>
                <LegendItem state="free">free</LegendItem>
                <LegendItem state="unmeasured">code not measured</LegendItem>
              </KeypadLegend>
              <Chosen
                key={chosen?.name ?? 'none'}
                chosen={chosen}
                definition={definition}
                remote={remote}
                model={model}
                keys={keys}
                driving={driving}
                named={named}
                calls={calls}
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
 * The key that is being looked at, and what it can be pointed at for this device.
 *
 * Keyed on the key's name where it is used, so choosing a different key resets the chooser rather than
 * carrying the previous key's selection into it. That is the bug the `key` prop exists for and it is
 * cheaper than an effect.
 */
function Chosen({ chosen, definition, remote, model, keys, driving, named, calls, busy, onAssign }: {
  readonly chosen: KeyOnScreen | undefined;
  readonly definition: DeviceDefinition | undefined;
  readonly remote: string;
  readonly model: RemoteModel | undefined;
  readonly keys: readonly KeyOnScreen[];
  /** The activities that drive this device, by their own position. Empty means nowhere to write. */
  readonly driving: readonly number[];
  readonly named: (activity: number) => string;
  /** What another position on this remote is called, since a key is often somebody else's. */
  readonly calls: (device: number) => string;
  readonly busy: boolean;
  readonly onAssign: (scan: number, command?: number) => void;
}) {
  const counted = measuredKeys(keys);

  if (driving.length === 0) {
    return (
      <div className={classes.chosen}>
        <h3 className={classes.chosenTitle}>No activity uses this yet</h3>
        <Text size="sm" c="dimmed">
          {/* The refusal a person will actually hit, said where they are rather than after a press. A
              keypad map belongs to an activity in every configuration here, so a device nothing runs for
              has nowhere for a button to live. Creating an activity is a round of its own. */}
          A button drives a device while an activity is running, and no activity on {remote} uses this one.
          That is what has to come first.
        </Text>
      </div>
    );
  }

  if (chosen === undefined) {
    return (
      <div className={classes.chosen}>
        <h3 className={classes.chosenTitle}>Press a button</h3>
        <Text size="sm" c="dimmed">
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
          {/* Within one activity a button drives one device, and here every activity that could carry it
              has already given it to another one. So the honest answer names who has it rather than
              offering a chooser that would then refuse. */}
          {chosen.ownedBy === undefined ? 'Another device' : calls(chosen.ownedBy)} has this button in
          every activity that drives this device. Freeing it there is what makes it available here.
        </Text>
      </div>
    );
  }

  const commands = definition?.commands ?? [];
  const nameOf = (command: number) =>
    commands.find((one) => one.slot === command)?.name ?? `Command ${command + 1}`;
  const scan = chosen.scan!;

  // What one activity does with this key, in words. Three answers, and `nothing` is a real one: a key an
  // activity leaves unbound does nothing while that activity is running.
  const says = (one: KeyInActivity) => one.command !== undefined
    ? nameOf(one.command)
    : one.heldBy !== undefined ? `${calls(one.heldBy)} has it` : 'nothing';
  // Shown when the activities do not all do the same thing, which is the honest trigger: it catches all
  // three ways they can differ without naming them, and stays quiet on the ordinary uniform key.
  const uneven = chosen.perActivity.length > 1
    && new Set(chosen.perActivity.map(says)).size > 1;

  return (
    <div className={classes.chosen}>
      <h3 className={classes.chosenTitle}>{name}</h3>

      {/* **What the key does in each activity, whenever they do not all do the same thing.** A device's map
          is what its activities agree on, and they can differ three ways: two commands, another device
          holding the key, or nothing holding it. Only the first leaves the map without an answer, which is
          why only that one is a colour on the drawing; all three are worth seeing when somebody is looking
          at one key, and none of them may be quietly resolved by picking a side. */}
      {uneven && (
        <div className={classes.contested}>
          <Text size="sm">
            {chosen.state === 'contested'
              ? 'This button sends a different command depending on the activity:'
              : 'This button is not the same in every activity that uses this device:'}
          </Text>
          <ul className={classes.perActivity}>
            {chosen.perActivity.map((one) => (
              <li key={one.activity}>
                <span>{named(one.activity)}</span>
                <span>{says(one)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {commands.length === 0
        ? (
          <Text size="sm" c="dimmed">
            This device has no commands yet, so there is nothing to point a button at. Importing from a
            remote or fetching it from Logitech is what fills that in.
          </Text>
          )
        : (
          <>
            <Select
              label="Sends"
              placeholder="nothing"
              data={commands.map((command) => ({
                value: String(command.slot),
                // The name where there is one, and the position where there is not, which is nearly
                // always: a configuration states codes and no words at all, so `Command 12` is the fact
                // rather than a placeholder.
                label: command.name ?? `Command ${command.slot + 1}`,
              }))}
              value={chosen.command === undefined ? null : String(chosen.command)}
              disabled={busy}
              // Clearable, because taking a binding away is as ordinary as making one and there is no
              // other control for it.
              clearable
              searchable
              onChange={(value) => onAssign(scan, value === null ? undefined : Number(value))}
              comboboxProps={{ withinPortal: false }}
            />
            {/* Where the change lands, said before it is made and not after. The map belongs to the device
                and the file stores it per activity, so one choice writes several places; and the places
                another device holds this key are left exactly as they are, which somebody has to be told
                or they will read an unchanged activity as a failed save. */}
            <Text size="xs" c="dimmed">
              Saved into {chosen.writable.length === driving.length && driving.length > 1
                ? `all ${driving.length} activities that use this device`
                : chosen.writable.map(named).join(', ')}
              {chosen.held.length === 0
                ? '.'
                : `. Left alone in ${chosen.held.map(named).join(', ')}, where another device has this `
                  + 'button.'}
            </Text>
          </>
          )}
    </div>
  );
}

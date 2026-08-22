/**
 * One appliance's commands: what each is called, and what its own remote already calls it.
 *
 * **The page is a form, not a table with an edit mode.** Every row's name is an open field, because the job
 * somebody comes here to do is typing eighty of them: tab, type, tab, type. An interaction that needed a
 * click to open each row and a click to close it would triple the work on the one page where the work is
 * the point. A name is written when the field is left or Enter is pressed, and only when it changed.
 *
 * **Beside the field is a word, never a waveform**, and getting that wrong was the first version of this
 * page: it showed the carrier frequency, the number of marks and gaps, and the code in hexadecimal. All
 * three are true and all three are this project's own vocabulary. What goes there is what their own remote
 * already calls the command, which the configuration mostly knows: a screen key carries the word printed
 * beside it on the display, in their language, and a keypad key has a name printed on the plastic.
 *
 * So most of an imported appliance can be named without typing anything, which is what the button at the
 * top does. It fills the fields rather than hiding the decision: every name it wrote is sitting in a field
 * that can be corrected or emptied, which is the difference between a suggestion and a claim.
 */
import { Button, Loader, Text, TextInput, Tooltip } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';

import { keyOfScan } from '@harmony/silhouettes';

import type { CommandInUse, CommandNaming } from '../../../shared/api.ts';
import type { DeviceDefinition } from '../../../shared/library.ts';
import type { RemoteModel } from '../../../shared/remote.ts';
import { drawingFor } from '../catalogue.ts';
import { spelledOut } from '../viewmodels/keypad.model.ts';
import { commandRows, matching, namedCount, waiting, type CommandRow }
  from '../viewmodels/commands.model.ts';
import classes from './CommandsView.module.scss';

interface CommandsViewProps {
  readonly definition: DeviceDefinition | undefined;
  /** What the appliance is called, so the page can say whose commands these are. */
  readonly title: string;
  /** Where each command is already used on a remote, or `undefined` while that is on its way. */
  readonly uses: readonly CommandInUse[] | undefined;
  /** The documents and their models, so a scan code on the keypad can be named from the drawing. */
  readonly remotes: readonly { readonly name: string; readonly model?: RemoteModel }[];
  readonly busy: boolean;
  readonly onName: (names: readonly CommandNaming[]) => void;
}

export function CommandsView({ definition, title, uses, remotes, busy, onName }: CommandsViewProps) {
  const [typed, setTyped] = useState('');

  if (definition === undefined) {
    return (
      <section className={classes.commands}>
        <Text className={classes.quiet}>
          This device is no longer on this machine. The library above says what is.
        </Text>
      </section>
    );
  }

  // A keypad key's name lives in the drawing rather than in the configuration, because it is printed on the
  // plastic. Most models have no drawing and most keys of the drawn ones have no measured code, so this
  // answers for some keys and not others, which is why the view model takes it as a function.
  const named = (remote: string, scan: number): string | undefined => {
    const drawing = drawingFor(remotes.find((one) => one.name === remote)?.model);
    const key = drawing === undefined ? undefined : keyOfScan(drawing, scan);
    return key === undefined ? undefined : spelledOut(key.name);
  };

  const rows = commandRows(definition.commands, uses ?? [], named);
  const counted = namedCount(rows);
  const offered = waiting(rows);
  const shown = matching(rows, typed);

  return (
    <section className={classes.commands}>
      <div className={classes.heading}>
        <h2 className={classes.title}>Commands</h2>
        <Text className={classes.under}>
          {counted.total === 0
            ? `Nothing has been taught to ${title} yet.`
            : `${title} answers to ${counted.total === 1 ? '1 command' : `${counted.total} commands`},`
              + ` and ${counted.named} of them ${counted.named === 1 ? 'has' : 'have'} a name.`}
        </Text>
      </div>

      {counted.total === 0
        ? (
          <Text className={classes.quiet}>
            {/* An appliance typed in by hand starts here, and that is allowed: a description does not have
                to be complete to be useful. */}
            Commands arrive by importing a remote that drives this device.
          </Text>
          )
        : (
          <>
            <div className={classes.tools}>
              <TextInput
                className={classes.search}
                placeholder="Search"
                value={typed}
                onChange={(event) => setTyped(event.currentTarget.value)}
                aria-label="Search commands"
              />
              {uses === undefined && <Loader size="xs" />}
              {offered > 0 && (
                <Tooltip
                  label="Takes the word your remote shows for each one. You can change any of them after."
                  withArrow
                  openDelay={400}
                  multiline
                  w={240}
                >
                  <Button
                    variant="light"
                    disabled={busy}
                    // One call and not one per row: thirty seven separate writes would be thirty seven
                    // reloads of the list under the pointer of whoever pressed this.
                    onClick={() => onName(rows
                      .filter((row) => !row.named && row.known[0] !== undefined)
                      .map((row) => ({ slot: row.slot, name: row.known[0]! })))}
                  >
                    Use the {offered} name{offered === 1 ? '' : 's'} from your remote
                  </Button>
                </Tooltip>
              )}
              {typed.trim() !== '' && (
                <Text className={classes.counted}>{shown.length} of {counted.total}</Text>
              )}
            </div>

            <ol className={classes.list}>
              {shown.map((row) => (
                <Row
                  // Keyed on the appliance as well as the position, so opening a second device does not
                  // show the first one's half typed words in a field that looks like this one's.
                  key={`${definition.id}:${row.slot}`}
                  row={row}
                  busy={busy}
                  onName={onName}
                />
              ))}
            </ol>

            {shown.length === 0 && (
              <div className={classes.nothing}>
                <Text className={classes.quiet}>Nothing here matches that.</Text>
                <Button variant="subtle" size="compact-sm" onClick={() => setTyped('')}>
                  Clear the search
                </Button>
              </div>
            )}
          </>
          )}
    </section>
  );
}

/** One command: its position, a field for its name, and what the remote calls it. */
function Row({ row, busy, onName }: {
  readonly row: CommandRow;
  readonly busy: boolean;
  readonly onName: (names: readonly CommandNaming[]) => void;
}) {
  const suggestion = row.named ? undefined : row.known[0];

  return (
    <li className={classes.row}>
      <span className={classes.slot}>{row.slot + 1}</span>
      <NameField
        value={row.named ? row.label : ''}
        placeholder={row.label}
        busy={busy}
        onCommit={(name) => onName([{ slot: row.slot, ...(name === undefined ? {} : { name }) }])}
      />
      {suggestion === undefined
        // A command nothing uses has no word anywhere, which is ordinary rather than a gap: a television
        // answers to a hundred codes and a remote binds thirty. Nothing is drawn, because a row saying
        // "unknown" says less than an empty one and takes up the same space.
        ? <span />
        : (
          <button
            type="button"
            className={classes.suggestion}
            disabled={busy}
            onClick={() => onName([{ slot: row.slot, name: suggestion }])}
            title={row.from === undefined ? undefined : `From ${row.from}`}
          >
            {suggestion}
          </button>
          )}
      {/* The rest of the words, where a command is called different things in different places. Not
          pressable and deliberately quiet: they are there so somebody can see that a disagreement exists,
          which is the one case where taking the first suggestion would be the wrong move. */}
      <span className={classes.others}>{row.known.slice(1).join(', ')}</span>
    </li>
  );
}

/**
 * One row's name.
 *
 * It holds its own draft so that typing does not write a file per letter, and commits on blur and on Enter.
 * Escape abandons, which is the only way back out of a field somebody opened by mistake.
 *
 * **Clearing it removes the name**, which is what the empty string means here rather than a name of no
 * characters: the way to undo a name typed into the wrong row is to empty it, and the placeholder then goes
 * back to saying the position.
 */
function NameField({ value, placeholder, busy, onCommit }: {
  readonly value: string;
  readonly placeholder: string;
  readonly busy: boolean;
  readonly onCommit: (name?: string) => void;
}) {
  const [typed, setTyped] = useState(value);
  // The value can change under the field from outside it: the write goes to the main process and comes back
  // as a reloaded definition, and the button at the top of the page writes a whole column of them at once.
  // Following it keeps the two from drifting without stealing what is being typed, since this only runs when
  // the incoming value actually differs from what was last seen.
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    setTyped(value);
  }, [value]);

  const commit = () => {
    const wanted = typed.trim();
    if (wanted === value) return;
    last.current = wanted;
    onCommit(wanted === '' ? undefined : wanted);
  };

  return (
    <TextInput
      className={classes.name}
      variant="unstyled"
      value={typed}
      placeholder={placeholder}
      disabled={busy}
      onChange={(event) => setTyped(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit();
          // Out of the field, so Enter reads as "done with this one" rather than leaving it open and
          // ambiguous about whether anything was saved.
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') setTyped(value);
      }}
      aria-label={`Name for ${placeholder}`}
    />
  );
}

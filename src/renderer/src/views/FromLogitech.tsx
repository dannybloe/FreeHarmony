/**
 * Look an appliance up in Logitech's catalogue and take the names it has for its codes.
 *
 * **This is the one naming route that is not a guess.** A word drawn on a remote's screen, or the name of
 * the key a code sits on, says where a code is rather than what it is: somebody may have put channel up on
 * the key marked 1, and Logitech's default is only a default. This compares the **code**, so it matches or
 * it does not. Measured: 52 of the 58 commands Logitech states for one Panasonic television are byte for
 * byte equal to a code on the television attached to the bench Harmony 600, a different model of the same
 * family.
 *
 * Three steps and each one is somebody's decision. Type the make and model, pick from what comes back, see
 * how many codes matched, and then take the names. Nothing is written until the last press.
 *
 * **The result is reported before it is applied**, which is the shape this application uses everywhere a
 * machine worked something out: the library reports probable duplicates and never merges them, and this
 * says "52 of 81" before anybody agrees to it.
 */
import { Alert, Button, Loader, Text, TextInput } from '@mantine/core';
import { useState } from 'react';

import type { CatalogueDevice, CommandNaming, NameMatches } from '../../../shared/api.ts';
import { api } from '../api.ts';
import classes from './FromLogitech.module.scss';

interface FromLogitechProps {
  /** Which appliance's codes are being named. */
  readonly id: string;
  /** What is already known about it, so the fields start filled in where an import stated them. */
  readonly manufacturer: string | undefined;
  readonly model: string | undefined;
  readonly busy: boolean;
  readonly onApply: (names: readonly CommandNaming[]) => void;
  readonly onClose: () => void;
}

type Stage =
  | { readonly at: 'asking' }
  | { readonly at: 'working' }
  | { readonly at: 'choosing'; readonly found: readonly CatalogueDevice[] }
  | { readonly at: 'matched'; readonly device: CatalogueDevice; readonly matches: NameMatches };

export function FromLogitech({ id, manufacturer, model, busy, onApply, onClose }: FromLogitechProps) {
  const [make, setMake] = useState(manufacturer ?? '');
  const [number, setNumber] = useState(model ?? '');
  const [stage, setStage] = useState<Stage>({ at: 'asking' });
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const attempt = async (what: () => Promise<Stage>) => {
    setProblem(undefined);
    setStage({ at: 'working' });
    try {
      setStage(await what());
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setStage({ at: 'asking' });
    }
  };

  return (
    <div className={classes.panel}>
      <div className={classes.head}>
        <h3 className={classes.title}>Get the names from Logitech</h3>
        <Button variant="subtle" size="compact-sm" onClick={onClose}>Close</Button>
      </div>

      <Text className={classes.explain}>
        {/* What it does and, more importantly, what it compares. Somebody agreeing to this is entitled to
            know it is not matching on the words. */}
        Logitech's database has names for the codes your equipment answers to. This looks your appliance
        up and compares the codes themselves, so a name only lands where the code is the same one.
      </Text>

      <div className={classes.fields}>
        <TextInput
          label="Make"
          placeholder="Panasonic"
          value={make}
          disabled={stage.at === 'working'}
          onChange={(event) => setMake(event.currentTarget.value)}
        />
        <TextInput
          label="Model"
          placeholder="TX-40DX600B"
          value={number}
          disabled={stage.at === 'working'}
          onChange={(event) => setNumber(event.currentTarget.value)}
        />
        <Button
          className={classes.find}
          disabled={stage.at === 'working' || make.trim() === '' || number.trim() === ''}
          onClick={() => void attempt(async () => {
            const found = await api().logitech.search(make.trim(), number.trim());
            return { at: 'choosing', found };
          })}
        >
          Find it
        </Button>
      </div>

      {stage.at === 'working' && <Loader size="sm" />}

      {stage.at === 'choosing' && stage.found.length === 0 && (
        <Alert color="gray" variant="light">
          {/* The exact match is deliberate, so this is worth saying plainly rather than offering a fuzzy
              search: a near match returns a different appliance and there would be no way to tell. */}
          Logitech has nothing under that exact make and model. The model number on the back of the
          appliance is the one their database uses.
        </Alert>
      )}

      {stage.at === 'choosing' && stage.found.length > 0 && (
        <ul className={classes.found}>
          {stage.found.map((device) => (
            <li key={device.commandsId}>
              <button
                type="button"
                className={classes.pick}
                onClick={() => void attempt(async () => ({
                  at: 'matched',
                  device,
                  matches: await api().logitech.matchNames(id, device),
                }))}
              >
                <span className={classes.pickName}>{device.manufacturer} {device.model}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {stage.at === 'matched' && (
        <div className={classes.result}>
          {stage.matches.names.length === 0
            ? (
              <Alert color="gray" variant="light">
                {/* Both counts, because they say two different things: nothing matched with plenty
                    comparable means this is not the same appliance, and nothing comparable means the codes
                    on this one cannot be read as numbers at all. */}
                None of {stage.device.manufacturer} {stage.device.model}'s {stage.matches.offered} codes
                is one of this appliance's {stage.matches.comparable}. Either it is different equipment,
                or its names are already filled in.
              </Alert>
              )
            : (
              <>
                <Text className={classes.count}>
                  {stage.matches.names.length} of this appliance's {stage.matches.comparable} readable
                  codes are in {stage.device.manufacturer} {stage.device.model}.
                </Text>
                <Button
                  disabled={busy}
                  onClick={() => { onApply(stage.matches.names); onClose(); }}
                >
                  Use those {stage.matches.names.length} names
                </Button>
              </>
              )}
        </div>
      )}

      {problem !== undefined && <Alert color="red" variant="light">{problem}</Alert>}
    </div>
  );
}

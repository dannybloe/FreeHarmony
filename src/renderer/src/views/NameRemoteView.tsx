/**
 * The model, large, and the one thing left to decide: what to call it.
 *
 * The name is the whole page, which is why the field is beside the drawing rather than under a heap of
 * detail. The facts are there because they are what tells somebody they picked the right remote, and
 * they stop at what can be shown honestly: the buttons and the display are measured off the drawing,
 * and the device ceiling is Logitech's own figure and says "up to".
 *
 * **A model with no drawing lands here too**, which is the ordinary case rather than the exception:
 * three of the forty retired models are drawn, so a remote recognised over USB usually arrives with a
 * name, a skin and no picture. The initial stands in, exactly as it does in a tile, and the facts
 * shrink to whatever Logitech's table says. What must not happen is a page that refuses to show a
 * remote somebody is holding.
 *
 * The refusal comes from `whyNameIsRefused`, the same function the store refuses with. This one
 * explains early; that one is the refusal that counts.
 */
import { Button, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';

import type { RemoteModel } from '../../../shared/remote.ts';
import { whyNameIsRefused } from '../../../shared/remote.ts';
import type { HardwareReading } from '../../../shared/devices.ts';
import { describe } from '../catalogue.ts';
import type { HardwareState } from '../viewmodels/devices.model.ts';
import type { ModelOrigin } from '../viewmodels/navigation.model.ts';
import { Silhouette } from './Silhouette.tsx';
import classes from './NameRemoteView.module.scss';

interface NameRemoteViewProps {
  readonly model: RemoteModel;
  /** Whether it was picked from the chooser or read off the bus, which changes one line of text. */
  readonly origin: ModelOrigin;
  /** Which attached remote may be asked. Absent on the chooser route, where there is nothing to ask. */
  readonly productId?: number | undefined;
  readonly hardware: HardwareState;
  readonly busy: boolean;
  readonly onReadHardware: (productId: number) => void;
  readonly onAdd: (name: string, model: RemoteModel, hardware?: HardwareReading) => void;
}

export function NameRemoteView({
  model, origin, productId, hardware, busy, onReadHardware, onAdd,
}: NameRemoteViewProps) {
  const [wanted, setWanted] = useState('');
  const described = useMemo(() => describe(model), [model]);
  const refusal = wanted === '' ? undefined : whyNameIsRefused(wanted);
  const ready = !busy && wanted.trim() !== '' && refusal === undefined;

  const add = () => {
    // Whatever was read goes on the document, and nothing is read unless somebody asked for it. So
    // pressing Add without pressing Read stores a document with no hardware reading, which is correct:
    // the reading is provenance and an absent one is honest.
    if (ready) onAdd(wanted, model, hardware.reading);
  };

  return (
    <section className={classes.page}>
      <div className={classes.stage}>
        {described.drawing === undefined
          ? <span className={classes.unknown} aria-hidden="true">{model.name.slice(0, 1)}</span>
          : <Silhouette drawing={described.drawing} detail="full" />}
      </div>

      <div className={classes.panel}>
        {/* Said before the name, because it is the reason the name is already filled in. The skin was
            here too and it is gone: a number nobody outside this project can act on. */}
        {origin === 'device' && <Text className={classes.origin}>Plugged in now</Text>}

        <Title order={2} className={classes.title}>Logitech {model.name}</Title>
        {described.soldAs.length > 1 && (
          <Text className={classes.also}>also sold as the {described.soldAs.slice(1).join(', ')}</Text>
        )}

        {/* No facts is simply no row. It used to say so in a sentence, which told somebody about this
            application's tables rather than about their remote. */}
        {described.facts.length > 0 && (
          <ul className={classes.facts}>
            {described.facts.map((fact) => <li key={fact}>{fact}</li>)}
          </ul>
        )}

        {productId !== undefined && (
          <HardwarePanel
            state={hardware}
            onRead={() => onReadHardware(productId)}
          />
        )}

        <TextInput
          className={classes.field}
          size="md"
          label="What will you call it?"
          description="This is the name of its folder in your documents, so pick something you will recognise."
          placeholder="Living room"
          autoFocus
          value={wanted}
          error={refusal}
          onChange={(event) => setWanted(event.currentTarget.value)}
          onKeyDown={(event) => event.key === 'Enter' && add()}
        />

        <div className={classes.actions}>
          <Button size="sm" disabled={!ready} onClick={add}>Add...</Button>
        </div>
      </div>
    </section>
  );
}

/**
 * Offer to ask the remote what it is, and show what it answered.
 *
 * **A button and never automatic**, which is the whole design of this panel. Asking opens the device,
 * and a page that claimed an irreplaceable remote because somebody navigated to it would be a page that
 * decides for them. So the read is one press, and what it found is on screen before Add rather than
 * after.
 *
 * **It explains none of that on screen**, which is a standing rule for this application and was said
 * for the third time on 21 August 2026: it is not a diagnostic tool. The button says what it does, the
 * three values are the answer, and what a version block can and cannot establish lives in `CLAUDE.md`
 * and in the tests where it can be checked. The software type went with that pass as well, since
 * "application" beside a firmware version is a word only this project can act on.
 */
function HardwarePanel({ state, onRead }: {
  readonly state: HardwareState;
  readonly onRead: () => void;
}) {
  if (state.status === 'read' && state.reading !== undefined) {
    const read = state.reading;
    return (
      <div className={classes.hardware}>
        <dl className={classes.readings}>
          <dt>Firmware</dt><dd>{read.firmware}</dd>
          <dt>Board</dt><dd>{read.hardware}</dd>
          <dt>Flash</dt><dd>{read.flash}</dd>
        </dl>
      </div>
    );
  }

  return (
    <div className={classes.hardware}>
      {state.status === 'failed' && <Text className={classes.hardwareError}>{state.error}</Text>}
      <Button size="xs" variant="default" loading={state.status === 'reading'} onClick={onRead}>
        {state.status === 'failed' ? 'Try again' : 'Read its firmware version'}
      </Button>
    </div>
  );
}

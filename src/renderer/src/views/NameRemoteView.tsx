/**
 * The model you picked, large, and the one thing left to decide: what to call it.
 *
 * The name is the whole page, which is why the field is beside the drawing rather than under a heap of
 * detail. The facts are there because they are what tells somebody they picked the right remote, and
 * they stop at what can be shown honestly: the buttons and the display are measured off the drawing,
 * and the device ceiling is Logitech's own figure and says "up to".
 *
 * The refusal comes from `whyNameIsRefused`, the same function the store refuses with. This one
 * explains early; that one is the refusal that counts.
 */
import { Button, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';

import { whyNameIsRefused } from '../../../shared/remote.ts';
import { asRemoteModel, type SupportedModel } from '../catalogue.ts';
import type { RemoteModel } from '../../../shared/remote.ts';
import { Silhouette } from './Silhouette.tsx';
import classes from './NameRemoteView.module.scss';

interface NameRemoteViewProps {
  readonly model: SupportedModel;
  readonly busy: boolean;
  readonly onAdd: (name: string, model: RemoteModel) => void;
}

export function NameRemoteView({ model, busy, onAdd }: NameRemoteViewProps) {
  const [wanted, setWanted] = useState('');
  const refusal = wanted === '' ? undefined : whyNameIsRefused(wanted);
  const ready = !busy && wanted.trim() !== '' && refusal === undefined;

  const add = () => {
    if (ready) onAdd(wanted, asRemoteModel(model));
  };

  return (
    <section className={classes.page}>
      <div className={classes.stage}>
        <Silhouette drawing={model.drawing} detail="full" />
      </div>

      <div className={classes.panel}>
        <Title order={2} className={classes.title}>Logitech {model.name}</Title>
        {model.soldAs.length > 1 && (
          <Text className={classes.also}>also sold as the {model.soldAs.slice(1).join(', ')}</Text>
        )}

        <ul className={classes.facts}>
          {model.facts.map((fact) => <li key={fact}>{fact}</li>)}
        </ul>

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

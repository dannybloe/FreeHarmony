/**
 * The shared library: every appliance this machine has a description of.
 *
 * Reached from Home, which is the decision of 21 August 2026 on a screen. A television belongs to three
 * remotes, so it cannot live inside the folder of one of them, and this page is what makes that
 * arrangement something a person can see rather than something they are told about.
 *
 * **Nearly everything on it has no name yet, and that is the truth about a fresh import rather than a gap
 * in the page.** A configuration states codes and positions and no words at all: no manufacturer, no
 * model, nothing that says an appliance is a television. So the list falls back through three answers, in
 * order of how much anybody actually knows: the description's own name, then the manufacturer and model,
 * then the names the documents use for it, because their owner typed those. Only when all three are empty
 * does a tile say how many commands it has, which is the last honest thing left to say about it.
 */
import { Button, Modal, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';

import type { DeviceDefinition, DeviceDraft, DeviceKind } from '../../../shared/library.ts';
import { KINDS, KIND_NAMES } from '../../../shared/library.ts';
import { captionFor, listed, nameFor, type LibraryState } from '../viewmodels/library.model.ts';
import { Carousel } from './Carousel.tsx';
import { KindGlyph } from './KindGlyph.tsx';
import { AddSectionTile, SectionTile } from './SectionTile.tsx';
import classes from './LibraryView.module.scss';

interface LibraryViewProps {
  readonly state: LibraryState;
  readonly onOpen: (id: string) => void;
  readonly onCreate: (draft: DeviceDraft) => Promise<DeviceDefinition>;
}

export function LibraryView({ state, onOpen, onCreate }: LibraryViewProps) {
  const [adding, setAdding] = useState(false);
  // In the order somebody reads them rather than the order the library hands them over, which is by
  // identifier and therefore by nothing.
  const definitions = listed(state);
  const empty = state.status === 'ready' && definitions.length === 0;

  return (
    <section className={classes.library}>
      <div className={classes.heading}>
        <Title order={2} className={classes.title}>
          {empty ? 'No appliances yet' : 'Your appliances'}
        </Title>
        <Text className={classes.lead}>
          {empty
            ? 'This fills up when you import a remote. You can also write one down yourself, which is'
              + ' useful before you have taught it any codes.'
            : 'One description each, shared by every remote. Your remotes give them their own names.'}
        </Text>
      </div>

      {state.status === 'failed' && <Text c="red" size="sm">{state.error}</Text>}

      <Carousel label="Your appliances">
        {definitions.map((definition) => (
          <SectionTile
            key={definition.id}
            glyph={<KindGlyph kind={definition.kind} size={34} />}
            title={nameFor(definition, state)}
            caption={captionFor(definition, state)}
            onClick={() => onOpen(definition.id)}
          />
        ))}
        <AddSectionTile label="Add..." onClick={() => setAdding(true)} />
      </Carousel>

      <NewApplianceModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreate={async (draft) => {
          const made = await onCreate(draft);
          setAdding(false);
          // Straight onto the new one's page, because writing something down and then having to find it
          // in a row of tiles is the wrong end of the interaction.
          onOpen(made.id);
        }}
      />
    </section>
  );
}

/**
 * Writing one down by hand: what it is, and whatever words you have for it.
 *
 * **No commands, and that is the point of it existing.** An appliance does not have to be complete to be
 * worth recording, and until this application can learn a code there is nothing to record but the words.
 * A form that insisted on codes would be a form nobody can finish.
 *
 * The kind is chosen from tiles rather than a dropdown, because the kind is the only field with a drawing
 * behind it and the drawing is the fastest way to pick: nine pictures read quicker than nine words in a
 * list you have to open first.
 */
function NewApplianceModal({ open, onClose, onCreate }: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreate: (draft: DeviceDraft) => void;
}) {
  const [kind, setKind] = useState<DeviceKind>('television');
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');

  return (
    <Modal opened={open} onClose={onClose} title="Write down an appliance" centered size="lg">
      <div className={classes.form}>
        <Text size="sm" c="dimmed">
          What is it? This decides the picture and nothing else, so it is safe to change later.
        </Text>

        <div className={classes.kinds}>
          {KINDS.map((one) => (
            <button
              key={one}
              type="button"
              data-kind={one}
              aria-pressed={one === kind}
              className={`${classes.kind} ${one === kind ? classes.chosen : ''}`}
              onClick={() => setKind(one)}
            >
              <KindGlyph kind={one} size={30} />
              <span>{KIND_NAMES[one]}</span>
            </button>
          ))}
        </div>

        <TextInput
          label="Name"
          description="What you call it. Leave it empty and the make and model stand in."
          placeholder="The one in the study"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <div className={classes.pair}>
          <TextInput
            label="Make"
            placeholder="Sony"
            value={manufacturer}
            onChange={(event) => setManufacturer(event.currentTarget.value)}
          />
          <TextInput
            label="Model"
            placeholder="STR-DH190"
            value={model}
            onChange={(event) => setModel(event.currentTarget.value)}
          />
        </div>

        <div className={classes.actions}>
          <Button variant="default" onClick={onClose}>Cancel</Button>
          {/* Nothing is required. A kind is always chosen, and every other field is allowed to be
              empty, because "an amplifier, somewhere, that I cannot read yet" is a true thing to
              write down and refusing it would make this form useless on the day it is most wanted. */}
          <Button onClick={() => onCreate({ kind, name, manufacturer, model })}>Write it down</Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Putting an appliance on a remote: pick one this machine already describes.
 *
 * **One of three ways in and the only one that exists yet.** Danny's own layout has the plus offering
 * three things: take an appliance you already have, type a new one, or fetch one from Logitech's
 * catalogue. The second and third are shortcuts into the device manager, which does not exist yet, so this
 * dialogue says so rather than showing two buttons that do nothing.
 *
 * A description already here is the interesting case anyway, and it is why the library sits beside the
 * remotes rather than inside one: the television in the living room is the same television whichever remote
 * is being set up, so the second remote to use it takes what the first one imported.
 *
 * **Tiles in a carousel, with the name and nothing else**, which is Danny's own call on 22 August 2026
 * after reading a screenshot of the first version. That one was a list showing each appliance's command
 * count and which remotes used it, and it was unreadable: four rows saying "81 commands, not identified"
 * with nothing to choose between. Nobody has fifty appliances, so a row of tiles fits, and searching can
 * arrive when somebody has enough of them to need it.
 *
 * The name is asked for and not derived. It belongs to the use rather than to the appliance, which is the
 * point of the split: four identical televisions are one description and four names.
 */
import { Button, Modal, Text, TextInput } from '@mantine/core';
import { useState } from 'react';

import {
  describeDefinition, namesUsedFor, type DeviceDefinition, type DeviceUsage,
} from '../../../shared/library.ts';
import type { LibraryState } from '../viewmodels/library.model.ts';
import { Carousel } from './Carousel.tsx';
import { SectionTile } from './SectionTile.tsx';
import classes from './PickDeviceView.module.scss';

interface PickDeviceViewProps {
  readonly opened: boolean;
  readonly library: LibraryState;
  /** The appliances already on this remote, so a tile can say so. */
  readonly alreadyHere: readonly (string | undefined)[];
  readonly onClose: () => void;
  readonly onPick: (definition: string, label: string) => void;
}

/**
 * What to call an appliance on a tile.
 *
 * **The names your own remotes give it come first**, and that is why `usage` exists at all: a description
 * read out of a configuration states no manufacturer and no model, so without them every tile would read
 * "not identified". The documents have the words, because their owner typed them.
 *
 * Manufacturer and model where a person or Logitech's catalogue has supplied them, the names otherwise, and
 * a last resort that says what it holds, which is a fresh machine with one unnamed appliance on it.
 */
function nameOf(definition: DeviceDefinition, usage: readonly DeviceUsage[]): string {
  const identified = describeDefinition(definition);
  if (identified !== undefined) return identified;
  const names = namesUsedFor(usage, definition.id);
  if (names.length > 0) return names.join(', ');
  return `${definition.commands.length} ${definition.commands.length === 1 ? 'command' : 'commands'}`;
}

export function PickDeviceView({
  opened, library, alreadyHere, onClose, onPick,
}: PickDeviceViewProps) {
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const [label, setLabel] = useState('');

  const close = () => { setChosen(undefined); setLabel(''); onClose(); };
  const definitions = library.status === 'ready' ? library.definitions : [];
  const usage = library.status === 'ready' ? library.usage : [];

  return (
    <Modal opened={opened} onClose={close} title="Add a device" centered radius="md" size="xl">
      {definitions.length === 0
        ? (
          <Text size="sm">
            Nothing on this machine describes an appliance yet. Importing a remote is what fills this:
            every appliance it drives is described once and kept here, and every remote after that takes
            what is already here.
          </Text>
          )
        : (
          <>
            <Text size="sm" className={classes.lead}>
              One description is shared by every remote that uses it, so the name you give it here belongs
              to this remote only.
            </Text>

            <Carousel label="Appliances this machine describes">
              {definitions.map((definition) => (
                <SectionTile
                  key={definition.id}
                  title={nameOf(definition, usage)}
                  // Already on this remote is worth saying and not worth refusing: two of the same
                  // television in one room is a real arrangement, and each one gets its own name.
                  caption={alreadyHere.includes(definition.id) ? 'already on this remote' : ''}
                  selected={chosen === definition.id}
                  onClick={() => setChosen(definition.id)}
                />
              ))}
            </Carousel>

            <TextInput
              className={classes.label}
              label="What it is called on this remote"
              placeholder="TV, Amplifier, Bedroom telly"
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
            />
          </>
          )}

      <div className={classes.buttons}>
        <Button variant="default" size="sm" onClick={close}>Cancel</Button>
        {definitions.length > 0 && (
          <Button
            size="sm"
            disabled={chosen === undefined || label.trim() === ''}
            onClick={() => {
              const which = chosen;
              const called = label.trim();
              close();
              if (which !== undefined) onPick(which, called);
            }}
          >
            Add it
          </Button>
        )}
      </div>
    </Modal>
  );
}

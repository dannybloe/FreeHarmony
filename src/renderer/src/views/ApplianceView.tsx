/**
 * One appliance in the shared library: what it is, who uses it, and what it can send.
 *
 * **Not `DeviceView.tsx`, and the difference is the whole data model.** That page is a **position on a
 * remote**, which has your own name on it and may point at nothing at all. This is the description itself,
 * which belongs to no remote, is seen the same way by all of them, and is the thing provenance is recorded
 * on. Four televisions of one model are one of these and four of those.
 *
 * Everything about it can be corrected except its identifier, which is why the form covers every field
 * and the identifier is not on it. That asymmetry is deliberate and it is the opposite of a remote, whose
 * name **is** its identity: an appliance is named by a person, so a spelling somebody fixes must not move
 * what every document is pointing at.
 */
import { Button, Modal, Text, TextInput, Title } from '@mantine/core';
import { useEffect, useState } from 'react';

import type { DeviceDefinition, DeviceKind } from '../../../shared/library.ts';
import {
  KINDS, KIND_NAMES, ORIGIN_NAMES, describeDefinition, mayBeShared, namesUsedFor,
} from '../../../shared/library.ts';
import { KindGlyph } from './KindGlyph.tsx';
import classes from './ApplianceView.module.scss';

interface ApplianceViewProps {
  readonly definition: DeviceDefinition | undefined;
  /** The documents that use it, and what each of them calls it. Empty is a real and ordinary answer. */
  readonly usedBy: readonly { readonly remote: string; readonly label?: string }[];
  readonly busy: boolean;
  readonly onSave: (definition: DeviceDefinition) => void;
  readonly onClone: () => void;
  readonly onRemove: () => void;
}

export function ApplianceView({
  definition, usedBy, busy, onSave, onClone, onRemove,
}: ApplianceViewProps) {
  const [confirming, setConfirming] = useState(false);

  // A description this machine has not got. Reachable in one real way: the library page is open, another
  // window or a hand deletes the file, and the list reloads underneath. Saying so beats a half drawn page.
  if (definition === undefined) {
    return (
      <section className={classes.appliance}>
        <Title order={2} className={classes.title}>This appliance is gone</Title>
        <Text className={classes.lead}>
          Its description is no longer on this machine. Go back to see what is.
        </Text>
      </section>
    );
  }

  return (
    <section className={classes.appliance}>
      <div className={classes.heading}>
        <span className={classes.portrait}><KindGlyph kind={definition.kind} size={44} /></span>
        <div>
          <Title order={2} className={classes.title}>
            {describeDefinition(definition) ?? 'This appliance has no name yet'}
          </Title>
          <Text className={classes.lead}>
            {KIND_NAMES[definition.kind]}, {ORIGIN_NAMES[definition.origin]}.
            {' '}
            {mayBeShared(definition.origin)
              ? 'This one could be shared with other people, because its codes came from your own hardware.'
              : 'This one stays on this machine: only a description learned from your own hardware may'
                + ' ever be shared.'}
          </Text>
        </div>
      </div>

      <Details definition={definition} busy={busy} onSave={onSave} />

      <div className={classes.columns}>
        <div className={classes.block}>
          <h3 className={classes.blockTitle}>On your remotes</h3>
          {usedBy.length === 0
            ? (
              <Text size="sm" c="dimmed">
                No remote uses this yet. Open a remote, go to its devices, and add it there.
              </Text>
              )
            : (
              <ul className={classes.uses}>
                {usedBy.map((use) => (
                  <li key={`${use.remote}/${use.label ?? ''}`}>
                    {/* The document's own word for it first, because that is the one its owner will
                        recognise, with the remote it is on after. */}
                    <span className={classes.label}>{use.label ?? 'unnamed'}</span>
                    <span className={classes.on}>on {use.remote}</span>
                  </li>
                ))}
              </ul>
              )}
        </div>

        <div className={classes.block}>
          <h3 className={classes.blockTitle}>
            What it can send
            {definition.commands.length > 0 && <span className={classes.count}>{definition.commands.length}</span>}
          </h3>
          {definition.commands.length === 0
            ? (
              <Text size="sm" c="dimmed">
                Nothing yet. Codes arrive by importing a remote that drives this appliance.
              </Text>
              )
            : (
              <div className={classes.commands}>
                {definition.commands.map((command) => (
                  <span key={command.slot} className={classes.command}>
                    {/* A position where there is no name, which is nearly always: a configuration
                        carries codes and no words, so naming these is a later job. */}
                    {command.name ?? `Command ${command.slot + 1}`}
                  </span>
                ))}
              </div>
              )}
        </div>
      </div>

      <div className={classes.actions}>
        {/* Copying is what the name field was added for: two televisions of one model send the same
            codes, so an import makes them one description and telling them apart has to be somebody's
            deliberate act. */}
        <Button variant="default" disabled={busy} onClick={onClone}>Make a copy</Button>
        <Button variant="light" color="red" disabled={busy} onClick={() => setConfirming(true)}>
          Throw away
        </Button>
      </div>

      <Modal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title="Throw this appliance away?"
        centered
      >
        <div className={classes.confirm}>
          {/* The one thing a person needs to know before pressing it, and the reason this application
              allows the delete at all: it does not edit the documents, so a position that pointed here
              is left pointing at nothing. That is visible on the remote's own page rather than silent,
              which is the trade the library made by living outside the documents. */}
          <Text size="sm">
            {usedBy.length === 0
              ? 'No remote uses it, so nothing else changes.'
              : `${usedBy.length === 1 ? '1 remote uses' : `${usedBy.length} remotes use`} it.`
                + ' Their device positions stay where they are and will say the description is missing.'}
          </Text>
          <div className={classes.actions}>
            <Button variant="default" onClick={() => setConfirming(false)}>Keep it</Button>
            <Button color="red" disabled={busy} onClick={onRemove}>Throw away</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

/**
 * The correctable half: a kind, a name, a make and a model.
 *
 * It holds its own draft and only writes on Save, which is the right shape for four text fields: saving
 * per keystroke would write a file per letter and would make an abandoned edit unabandonnable. The draft
 * is reset when the appliance changes, which is what the effect is for and is the bug that shape invites:
 * without it, opening a second appliance would show the first one's half typed words.
 */
function Details({ definition, busy, onSave }: {
  readonly definition: DeviceDefinition;
  readonly busy: boolean;
  readonly onSave: (definition: DeviceDefinition) => void;
}) {
  const [kind, setKind] = useState<DeviceKind>(definition.kind);
  const [name, setName] = useState(definition.name ?? '');
  const [manufacturer, setManufacturer] = useState(definition.manufacturer ?? '');
  const [model, setModel] = useState(definition.model ?? '');

  useEffect(() => {
    setKind(definition.kind);
    setName(definition.name ?? '');
    setManufacturer(definition.manufacturer ?? '');
    setModel(definition.model ?? '');
  }, [definition]);

  const changed = kind !== definition.kind
    || name.trim() !== (definition.name ?? '')
    || manufacturer.trim() !== (definition.manufacturer ?? '')
    || model.trim() !== (definition.model ?? '');

  return (
    <div className={classes.details}>
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
            <KindGlyph kind={one} size={26} />
            <span>{KIND_NAMES[one]}</span>
          </button>
        ))}
      </div>

      <div className={classes.fields}>
        <TextInput
          label="Name"
          description="Leave it empty and the make and model stand in."
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <TextInput
          label="Make"
          value={manufacturer}
          onChange={(event) => setManufacturer(event.currentTarget.value)}
        />
        <TextInput
          label="Model"
          value={model}
          onChange={(event) => setModel(event.currentTarget.value)}
        />
      </div>

      <div className={classes.actions}>
        <Button
          disabled={busy || !changed}
          onClick={() => onSave(trimmed({ ...definition, kind }, { name, manufacturer, model }))}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/**
 * The typed words onto the definition, with the empty ones removed rather than stored as `''`.
 *
 * The same rule as the create path in `src/main/library.ts`, and it is here as well rather than only
 * there because this route does not go through `create`: it goes through `put`, which writes what it is
 * given. An empty string would satisfy every presence test and then render as nothing, which is a field
 * that looks filled in and is not.
 */
function trimmed(
  base: DeviceDefinition, typed: Record<'name' | 'manufacturer' | 'model', string>,
): DeviceDefinition {
  // Spread of the three optional fields rather than a loop with `delete`, because a loop needs the object
  // typed as a bag of unknowns and then a cast back, and a cast is exactly the thing that would let a
  // typo write a field this model does not have.
  const kept = (field: 'name' | 'manufacturer' | 'model') => {
    const value = typed[field].trim();
    return value === '' ? {} : { [field]: value };
  };
  const { name: _name, manufacturer: _make, model: _model, ...rest } = base;
  return { ...rest, ...kept('name'), ...kept('manufacturer'), ...kept('model') };
}

/**
 * One device in the library: what it is, which remotes use it, and what can be done to it.
 *
 * **Not `DeviceView.tsx`, and the difference is the whole data model.** That page is a **position on a
 * remote**, which has your own name on it and may point at nothing at all. This is the description itself,
 * which belongs to no remote, is seen the same way by all of them, and is the thing provenance is recorded
 * on. Four televisions of one model are one of these and four of those.
 *
 * The layout is Danny's: the drawing and the name at the top left, the remotes using it under that, and the
 * actions along the bottom with the destructive pair on the left and the places to go on the right.
 *
 * **The details block between them is the one thing added to that layout**, and it is flagged rather than
 * quietly inserted: his sketch went from the name straight to the remotes, which leaves a device typed with
 * a spelling mistake unfixable except by deleting it. It is kept small and it is the first candidate to move
 * behind Settings when that page exists.
 */
import { Button, Modal, Select, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

import type { DeviceDefinition, DeviceKind } from '../../../shared/library.ts';
import { KINDS, KIND_NAMES, mayBeShared } from '../../../shared/library.ts';
import type { RemoteModel } from '../../../shared/remote.ts';
import { drawingFor } from '../catalogue.ts';
import { Carousel } from './Carousel.tsx';
import { Silhouette } from './Silhouette.tsx';
import { KindGlyph } from './KindGlyph.tsx';
import { AddSectionTile, SectionTile } from './SectionTile.tsx';
import classes from './LibraryDeviceView.module.scss';

interface LibraryDeviceViewProps {
  readonly definition: DeviceDefinition | undefined;
  /**
   * What to call it and what to say underneath, computed where the usage is known.
   *
   * Passed in rather than derived here, because the honest name of a nameless device is what the documents
   * call it, and this view is handed one definition and no documents. `headingIn` in the library's view
   * model is the rule, and the tile in the grid uses the same one.
   */
  readonly heading: { readonly title: string; readonly under?: string } | undefined;
  readonly usedBy: readonly { readonly remote: string; readonly label?: string }[];
  readonly remotes: readonly { readonly name: string; readonly model?: RemoteModel }[];
  /** The remote the panel was opened from, so it can be marked and offered. */
  readonly current: string | undefined;
  readonly busy: boolean;
  readonly onSave: (definition: DeviceDefinition) => void;
  readonly onClone: (name?: string) => void;
  readonly onRemove: () => void;
  readonly onOpenRemote: (name: string) => void;
  readonly onAddToCurrent: () => void;
}

export function LibraryDeviceView({
  definition, heading, usedBy, remotes, current, busy,
  onSave, onClone, onRemove, onOpenRemote, onAddToCurrent,
}: LibraryDeviceViewProps) {
  const [confirming, setConfirming] = useState<'delete' | 'duplicate' | undefined>(undefined);

  // A description this machine has not got. Reachable in one real way: the panel is open, another window or
  // a hand deletes the file, and the list reloads underneath. Saying so beats a half drawn page.
  if (definition === undefined || heading === undefined) {
    return (
      <section className={classes.device}>
        <Text className={classes.gone}>
          This device is no longer on this machine. The library above says what is.
        </Text>
      </section>
    );
  }

  const on = [...new Set(usedBy.map((one) => one.remote))];
  // The offer, and only where there is a remote to offer and it is not already using this device.
  const offer = current !== undefined && !on.includes(current);

  return (
    <section className={classes.device}>
      <div className={classes.heading}>
        <span className={classes.portrait}><KindGlyph kind={definition.kind} size={40} /></span>
        <div className={classes.names}>
          <h2 className={classes.name}>{heading.title}</h2>
          {heading.under !== undefined && <span className={classes.under}>{heading.under}</span>}
          {!mayBeShared(definition.origin) && (
            <span className={classes.private}>
              Stays on this machine: only a device learned from your own hardware may be shared.
            </span>
          )}
        </div>
      </div>

      <Details definition={definition} busy={busy} onSave={onSave} />

      <div className={classes.block}>
        <h3 className={classes.blockTitle}>Remotes</h3>
        {on.length === 0 && !offer
          ? (
            <Text size="sm" c="dimmed">
              No remote uses this yet. Open a remote, go to its devices, and add it there.
            </Text>
            )
          : (
            <Carousel label="Remotes using this device">
              {on.map((name) => {
                const model = remotes.find((one) => one.name === name)?.model;
                const drawing = drawingFor(model);
                return (
                  <SectionTile
                    key={name}
                    title={name}
                    caption={model?.name ?? ''}
                    // The remote, drawn, rather than a letter in a circle: Danny's, and it is the same
                    // picture Home uses for the same document, at tile detail, so a person recognises the
                    // thing rather than reading its name twice. No drawing for most models, and then the
                    // tile falls back to the initial, which is what the chooser does too.
                    glyph={drawing === undefined
                      ? <span className={classes.initial}>{name.slice(0, 1).toUpperCase()}</span>
                      : <Silhouette drawing={drawing} detail="tile" className={classes.small} />}
                    // The one you came from, marked. Pressing it closes the panel and leaves you exactly
                    // where you were rather than taking you to that remote's front page.
                    selected={name === current}
                    onClick={() => onOpenRemote(name)}
                  />
                );
              })}
              {offer && <AddSectionTile label={`Add to ${current}`} onClick={onAddToCurrent} />}
            </Carousel>
            )}
      </div>

      <div className={classes.actions}>
        <div className={classes.destructive}>
          {/* Copying is what a device's own name was added for: two televisions of one model send the same
              codes, so an import describes them once and telling them apart has to be a deliberate act. */}
          <Button variant="default" disabled={busy} onClick={() => setConfirming('duplicate')}>
            Duplicate...
          </Button>
          <Button variant="light" color="red" disabled={busy} onClick={() => setConfirming('delete')}>
            Delete...
          </Button>
        </div>
        <div className={classes.places}>
          {/* Three places that do not exist yet, drawn and disabled rather than absent, which is Danny's
              and is right: grey says "this is coming" where a missing button says nothing and a working
              button that opens an empty page says "this is broken". `docs/roadmap.md` carries what each of
              them is waiting on, and Settings is waiting on a finding in the other repository. */}
          <Button variant="subtle" disabled>Commands</Button>
          <Button variant="subtle" disabled>Inputs</Button>
          <Button variant="subtle" disabled>Settings</Button>
        </div>
      </div>

      <Modal
        opened={confirming === 'delete'}
        onClose={() => setConfirming(undefined)}
        title="Delete this device?"
        centered
      >
        <div className={classes.confirm}>
          {/* The one thing to know before pressing it, and the reason this is allowed at all: it does not
              edit the documents, so a position that pointed here is left pointing at nothing. That is
              visible on the remote's own page rather than silent, which is the trade the library made by
              living outside the documents. */}
          <Text size="sm">
            {on.length === 0
              ? 'No remote uses it, so nothing else changes.'
              : `${on.length === 1 ? '1 remote uses' : `${on.length} remotes use`} it.`
                + ' Their device positions stay where they are and will say the device is missing.'}
          </Text>
          <div className={classes.confirmActions}>
            <Button variant="default" onClick={() => setConfirming(undefined)}>Keep it</Button>
            <Button color="red" disabled={busy} onClick={() => { setConfirming(undefined); onRemove(); }}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <DuplicateModal
        open={confirming === 'duplicate'}
        suggestion={`${heading.title} copy`}
        busy={busy}
        onClose={() => setConfirming(undefined)}
        onDuplicate={(chosen) => { setConfirming(undefined); onClone(chosen); }}
      />
    </section>
  );
}

/**
 * The correctable half: a category, a make, a model and a name.
 *
 * It holds its own draft and only writes on Save, which is the right shape for four fields: saving per
 * keystroke would write a file per letter and make an abandoned edit unabandonnable. The draft resets when
 * the device changes, which is what the effect is for and is the bug that shape invites: without it, opening
 * a second device would show the first one's half typed words.
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
      <Select
        label="Category"
        data={KINDS.map((one) => ({ value: one, label: KIND_NAMES[one] }))}
        value={kind}
        onChange={(chosen) => setKind((chosen ?? 'other') as DeviceKind)}
        allowDeselect={false}
        leftSection={<KindGlyph kind={kind} size={18} />}
        renderOption={({ option }) => (
          <div className={classes.option}>
            <KindGlyph kind={option.value as DeviceKind} size={18} />
            <span>{option.label}</span>
          </div>
        )}
        comboboxProps={{ withinPortal: false }}
      />
      <TextInput label="Make" value={manufacturer}
                 onChange={(event) => setManufacturer(event.currentTarget.value)} />
      <TextInput label="Model" value={model}
                 onChange={(event) => setModel(event.currentTarget.value)} />
      <TextInput label="Name (optional)" value={name}
                 onChange={(event) => setName(event.currentTarget.value)} />
      <Button
        className={classes.save}
        disabled={busy || !changed}
        onClick={() => onSave(trimmed({ ...definition, kind }, { name, manufacturer, model }))}
      >
        Save
      </Button>
    </div>
  );
}

/** Copying, with a name suggested. The ellipsis on the button is the promise that this appears. */
function DuplicateModal({ open, suggestion, busy, onClose, onDuplicate }: {
  readonly open: boolean;
  readonly suggestion: string;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onDuplicate: (name: string) => void;
}) {
  const [name, setName] = useState(suggestion);
  useEffect(() => { setName(suggestion); }, [suggestion, open]);

  return (
    <Modal opened={open} onClose={onClose} title="Duplicate this device?" centered>
      <div className={classes.confirm}>
        <Text size="sm">
          The copy sends exactly the same codes. A name of its own is how the two are told apart.
        </Text>
        <TextInput label="Name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <div className={classes.confirmActions}>
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => onDuplicate(name)}>Duplicate</Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The typed words onto the device, with the empty ones removed rather than stored as `''`.
 *
 * The same rule as the create path in `src/main/library.ts`, and it is here as well because this route does
 * not go through `create`: it goes through `put`, which writes what it is given. An empty string would
 * satisfy every presence test and then render as nothing, which is a field that looks filled in and is not.
 */
function trimmed(
  base: DeviceDefinition, typed: Record<'name' | 'manufacturer' | 'model', string>,
): DeviceDefinition {
  const kept = (field: 'name' | 'manufacturer' | 'model') => {
    const value = typed[field].trim();
    return value === '' ? {} : { [field]: value };
  };
  const { name: _name, manufacturer: _make, model: _model, ...rest } = base;
  return { ...rest, ...kept('name'), ...kept('manufacturer'), ...kept('model') };
}

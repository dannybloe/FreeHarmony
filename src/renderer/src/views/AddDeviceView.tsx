/**
 * Writing down a device by hand: what it is, and whatever words you have for it.
 *
 * A page inside the panel rather than a dialogue, the same way adding a remote is a page. The way out is the
 * panel's own back arrow, so there is no Cancel: two ways to abandon one form is one more than a form needs,
 * and the one in the corner is the one people already know.
 *
 * **The category is one field and used to be nine tiles.** The tiles were drawn on 22 August 2026, looked at,
 * and took a third of the form for a choice most people make once per device. The drawings survive inside the
 * list, one beside each name, which is where they earn their keep: nine pictures in a list read faster than
 * nine words.
 *
 * **Nothing is required.** A category is always chosen, and every other field may be empty, because "an
 * amplifier, somewhere, that I cannot read yet" is a true thing to write down and refusing it would make this
 * form useless on the day it is most wanted.
 */
import { Button, Select, TextInput } from '@mantine/core';
import { useState } from 'react';

import type { DeviceDraft, DeviceKind } from '../../../shared/library.ts';
import { KINDS, KIND_NAMES } from '../../../shared/library.ts';
import { KindGlyph } from './KindGlyph.tsx';
import classes from './AddDeviceView.module.scss';

interface AddDeviceViewProps {
  readonly busy: boolean;
  readonly onAdd: (draft: DeviceDraft) => void;
}

export function AddDeviceView({ busy, onAdd }: AddDeviceViewProps) {
  const [kind, setKind] = useState<DeviceKind>('television');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [name, setName] = useState('');

  // What the name field suggests, and what the device will actually be called if the field is left empty.
  // The same words either way, which is the point: the placeholder is not a hint, it is the answer.
  const standIn = [manufacturer.trim(), model.trim()].filter((one) => one !== '').join(' ');

  return (
    <section className={classes.add}>
      {/* No heading and no introduction. "Add device" is already the crumb in the panel's bar, and four
          labelled fields need no sentence explaining that they are fields. */}
      <div className={classes.fields}>
        <Select
          label="Category"
          data={KINDS.map((one) => ({ value: one, label: KIND_NAMES[one] }))}
          value={kind}
          onChange={(chosen) => setKind((chosen ?? 'other') as DeviceKind)}
          allowDeselect={false}
          // The drawing beside each name in the list, and in the field once chosen. This is the whole of
          // what the nine tiles were for, at a tenth of the space.
          leftSection={<KindGlyph kind={kind} size={20} />}
          renderOption={({ option }) => (
            <div className={classes.option}>
              <KindGlyph kind={option.value as DeviceKind} size={20} />
              <span>{option.label}</span>
            </div>
          )}
          comboboxProps={{ withinPortal: false }}
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

        <TextInput
          label="Name (optional)"
          placeholder={standIn === '' ? 'The one in the study' : standIn}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </div>

      <div className={classes.actions}>
        <Button disabled={busy} onClick={() => onAdd({ kind, name, manufacturer, model })}>Add</Button>
      </div>
    </section>
  );
}

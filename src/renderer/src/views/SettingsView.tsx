/**
 * One remote's own settings: what it is, where it came from, and the things you can do to the document.
 *
 * **Renaming, copying and removing moved here from the remote's front page** on 22 August 2026, because
 * that page became a way in to three others and a list of buttons underneath them read as a footer. This
 * is also what settings means for a document: the thing itself rather than what is in it.
 *
 * Removing asks first and the question says what goes, which is the folder and everything under it. That
 * is a sentence rather than a shrug because the folder is in somebody's own documents and may hold the
 * only copy of a configuration for a remote that cannot be bought again.
 */
import { Button, Modal, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';

import { whyNameIsRefused, type RemoteDocument } from '../../../shared/remote.ts';
import classes from './SettingsView.module.scss';

interface SettingsViewProps {
  readonly remote: RemoteDocument;
  readonly busy: boolean;
  readonly onRename: (to: string) => void;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
}

/** "16 August 2026", spelled the way the reader's own machine spells a date. */
function on(when: string): string {
  return new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Where a document came from, in words rather than in the stored token. */
const ORIGIN: Readonly<Record<RemoteDocument['provenance'], string>> = {
  'created-empty': 'set up here from scratch',
  duplicated: 'copied from another remote',
  'read-from-device': 'imported from the remote itself',
};

export function SettingsView({ remote, busy, onRename, onDuplicate, onRemove }: SettingsViewProps) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const refusal = draft === undefined || draft === '' ? undefined : whyNameIsRefused(draft);

  return (
    <section className={classes.settings}>
      <div className={classes.heading}>
        <Title order={2} className={classes.title}>Settings</Title>
        <Text className={classes.lead}>What {remote.name} is, and what you can do to the entry itself.</Text>
      </div>

      <dl className={classes.facts}>
        <dt>Model</dt>
        <dd>{remote.model?.name ?? 'not recorded'}</dd>
        <dt>Added</dt>
        <dd>{on(remote.createdAt)}</dd>
        <dt>Where it came from</dt>
        <dd>{ORIGIN[remote.provenance]}</dd>
        <dt>Configuration</dt>
        <dd>
          {remote.baseConfiguration === undefined
            ? 'none'
            : remote.baseConfiguration.readAt === undefined
              ? 'stored here'
              : `imported on ${on(remote.baseConfiguration.readAt)}`}
        </dd>
      </dl>

      <div className={classes.actions}>
        <Button variant="default" size="xs" disabled={busy} onClick={() => setDraft(remote.name)}>
          Rename
        </Button>
        <Button variant="default" size="xs" disabled={busy} onClick={onDuplicate}>Duplicate</Button>
        <Button variant="default" size="xs" disabled={busy} onClick={() => setConfirming(true)}>
          Remove
        </Button>
      </div>

      <Modal opened={draft !== undefined} onClose={() => setDraft(undefined)}
             title={`Rename ${remote.name}`} centered radius="md">
        <TextInput value={draft ?? ''} onChange={(event) => setDraft(event.currentTarget.value)}
                   error={refusal} data-autofocus autoFocus />
        <div className={classes.confirm}>
          <Button variant="default" size="sm" onClick={() => setDraft(undefined)}>Cancel</Button>
          <Button
            size="sm"
            disabled={draft === undefined || draft === '' || refusal !== undefined}
            onClick={() => {
              const wanted = draft;
              setDraft(undefined);
              if (wanted !== undefined) onRename(wanted);
            }}
          >
            Rename
          </Button>
        </div>
      </Modal>

      <Modal opened={confirming} onClose={() => setConfirming(false)} title={`Remove ${remote.name}?`}
             centered radius="md">
        <Text size="sm">
          This deletes its folder in your documents and everything in it, including every configuration
          you have imported. It cannot be undone from here.
        </Text>
        <div className={classes.confirm}>
          <Button variant="default" size="sm" onClick={() => setConfirming(false)}>Keep it</Button>
          <Button color="red" size="sm" onClick={() => { setConfirming(false); onRemove(); }}>
            Remove
          </Button>
        </div>
      </Modal>
    </section>
  );
}

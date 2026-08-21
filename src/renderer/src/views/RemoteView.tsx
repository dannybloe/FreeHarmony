/**
 * One remote: its picture, its name, and the three things you can do to it.
 *
 * Deliberately almost empty, and that is Danny's own limit on this round. No remote in the application
 * has a configuration yet, so a page of empty panels would imply something is missing that is supposed
 * to be there. What is here is the document: the picture, the name, when it was added and where it came
 * from.
 *
 * The three actions live here rather than on Home, which is how a document application works: you do
 * something to a document on its own page. Removing asks first, because it takes the folder and
 * everything under it, and that is a sentence rather than a shrug.
 */
import { Button, Modal, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';

import { whyNameIsRefused, type RemoteDocument } from '../../../shared/remote.ts';
import { drawingFor } from '../catalogue.ts';
import { Silhouette } from './Silhouette.tsx';
import classes from './RemoteView.module.scss';

interface RemoteViewProps {
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
  'read-from-device': 'read off the remote itself',
};

export function RemoteView({ remote, busy, onRename, onDuplicate, onRemove }: RemoteViewProps) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const drawing = drawingFor(remote.model);

  const refusal = draft === undefined || draft === '' ? undefined : whyNameIsRefused(draft);
  const accept = () => {
    setDraft(undefined);
    if (draft !== undefined && refusal === undefined && draft.trim() !== remote.name) onRename(draft);
  };

  return (
    <section className={classes.page}>
      <div className={classes.stage}>
        {drawing === undefined
          ? <span className={classes.unknown} aria-hidden="true">{remote.name.slice(0, 1).toUpperCase()}</span>
          : <Silhouette drawing={drawing} detail="full" />}
      </div>

      <div className={classes.panel}>
        {draft === undefined
          ? (
            <Title
              order={2}
              className={classes.name}
              title="double click to rename"
              onDoubleClick={() => setDraft(remote.name)}
            >
              {remote.name}
            </Title>
            )
          : (
            <TextInput
              size="md"
              autoFocus
              value={draft}
              error={refusal}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onBlur={accept}
              onKeyDown={(event) => {
                if (event.key === 'Enter') accept();
                if (event.key === 'Escape') setDraft(undefined);
              }}
            />
            )}

        <Text className={classes.model}>
          {remote.model === undefined ? 'Model unknown' : `Logitech ${remote.model.name}`}
        </Text>

        <dl className={classes.details}>
          <dt>Added</dt>
          <dd>{on(remote.createdAt)}</dd>
          <dt>Origin</dt>
          <dd>{ORIGIN[remote.provenance]}</dd>
          <dt>Configuration</dt>
          <dd>
            {remote.baseConfiguration === undefined
              ? 'none yet, so there is nothing to change'
              : `${remote.baseConfiguration.byteLength.toLocaleString()} bytes`}
          </dd>
        </dl>

        <div className={classes.actions}>
          <Button variant="default" size="xs" disabled={busy} onClick={() => setDraft(remote.name)}>
            Rename
          </Button>
          <Button variant="default" size="xs" disabled={busy} onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button variant="default" size="xs" disabled={busy} onClick={() => setConfirming(true)}>
            Remove
          </Button>
        </div>
      </div>

      <Modal opened={confirming} onClose={() => setConfirming(false)} title={`Remove ${remote.name}?`}
             centered radius="md">
        <Text size="sm">
          This deletes its folder in your documents and everything in it, including any backups. It
          cannot be undone from here.
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

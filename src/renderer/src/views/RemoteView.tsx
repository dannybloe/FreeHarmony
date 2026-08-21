/**
 * One remote: its picture, its name, what it is set up to do, and the things you can do to it.
 *
 * **It used to be almost empty and it no longer is**, because a document can now have a configuration
 * behind it: the appliances and activities are in `Inventory`, made out of the bytes each time. Where
 * there is no configuration there is still no panel, which is the same rule as before rather than a
 * softened one. A document made by picking a model from a list holds nothing, and the honest page for
 * that is a page that offers to read a remote.
 *
 * The actions live here rather than on Home, which is how a document application works: you do
 * something to a document on its own page. Removing asks first, because it takes the folder and
 * everything under it, and that is a sentence rather than a shrug.
 */
import { Button, Modal, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';

import type { AttachedRemote } from '../../../shared/devices.ts';
import { whyNameIsRefused, type RemoteDocument } from '../../../shared/remote.ts';
import { drawingFor, isSameModel } from '../catalogue.ts';
import type { Contents } from '../viewmodels/useContents.ts';
import { Inventory } from './Inventory.tsx';
import { Silhouette } from './Silhouette.tsx';
import classes from './RemoteView.module.scss';

interface RemoteViewProps {
  readonly remote: RemoteDocument;
  readonly busy: boolean;
  /** What the document holds, and what a read of a device is doing. */
  readonly contents: Contents;
  /** Attached remotes, so that reading is offered only when the right one is plugged in. */
  readonly attached: readonly AttachedRemote[];
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

export function RemoteView({
  remote, busy, contents, attached, onRename, onDuplicate, onRemove,
}: RemoteViewProps) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const drawing = drawingFor(remote.model);
  // Which attached remote this document is about, if any. Matched on the **model**, because that is all
  // a document knows: nothing here identifies a unit, and two Harmony Ones are indistinguishable over
  // USB. So this answers "a remote of this kind is plugged in" and never "your remote is plugged in".
  const thisOne = attached.find((one) => isSameModel(remote.model, one.model));

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
            {/* "none" and not "none yet, so there is nothing to change": the absence is a fact about
                this document, the sentence after it was about this application.
                **A byte count used to be here and it is gone.** It is the sort of number a person
                cannot act on, and it read as a diagnostic once the devices and activities were listed
                below it. When it was read is the fact worth keeping, since a configuration goes stale
                the moment somebody changes something on the remote itself. */}
            {remote.baseConfiguration === undefined
              ? 'none'
              : remote.baseConfiguration.readAt === undefined
                ? 'stored here'
                : `read on ${on(remote.baseConfiguration.readAt)}`}
          </dd>
        </dl>

        {contents.contents.status === 'ready' && <Inventory contents={contents.contents.contents} />}

        {/* Offered only where it can be done: a remote of this model has to be attached. A button that
            is always there and fails when nothing is plugged in makes somebody find that out by
            pressing it. */}
        {thisOne !== undefined && (
          <div className={classes.read}>
            <Button
              size="xs"
              variant={remote.baseConfiguration === undefined ? 'filled' : 'default'}
              loading={contents.read.status === 'reading'}
              onClick={() => void contents.readFrom(thisOne.productId)}
            >
              {remote.baseConfiguration === undefined ? 'Read what is on it' : 'Read it again'}
            </Button>
            {contents.read.status === 'failed' && (
              <Text className={classes.readError}>{contents.read.error}</Text>
            )}
          </div>
        )}

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

/**
 * One remote: its picture, its name, and the three ways in.
 *
 * **It is a landing page now rather than a page with everything on it**, which is Danny's own layout of
 * 22 August 2026: Devices, Activities and Settings as tiles, each carrying the number a press was going
 * to ask for. The inventory list it used to show is gone from here, because a list of four devices and
 * a list of three activities on the way in to pages about devices and activities was the same content
 * twice.
 *
 * Renaming, copying and removing moved to Settings, which is what settings means for a document: the
 * thing itself rather than what is in it. Renaming by double clicking the title stays, because it is
 * the fastest way to do the commonest of the three and it costs nothing.
 *
 * Importing is the only thing on this page that touches hardware, and it is offered only when a remote
 * of this model is attached: a button that is always there and fails makes somebody find that out by
 * pressing it.
 */
import { Button, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';

import type { AttachedRemote } from '../../../shared/devices.ts';
import { whyNameIsRefused, type RemoteDocument } from '../../../shared/remote.ts';
import { drawingFor, isSameModel } from '../catalogue.ts';
import type { Contents } from '../viewmodels/useContents.ts';
import type { Importing } from '../viewmodels/useImport.ts';
import { ImportView } from './ImportView.tsx';
import { SectionTile } from './SectionTile.tsx';
import { Silhouette } from './Silhouette.tsx';
import classes from './RemoteView.module.scss';

interface RemoteViewProps {
  readonly remote: RemoteDocument;
  readonly busy: boolean;
  /** What the document holds. */
  readonly contents: Contents;
  /** The import, which is the only thing on this page that touches hardware. */
  readonly importing: Importing;
  /** Attached remotes, so that reading is offered only when the right one is plugged in. */
  readonly attached: readonly AttachedRemote[];
  readonly onRename: (to: string) => void;
  /** Where the three tiles go. Settings is a screen of its own, hence a third destination. */
  readonly onOpen: (section: 'devices' | 'activities' | 'settings') => void;
}

/**
 * The devices, by the names their owner gave them, as one line.
 *
 * Truncated by CSS rather than here, so the tile decides how much fits: a name is somebody's own word
 * and cutting it in the middle is worse than letting the box do it.
 */
function names(devices: readonly { readonly label?: string }[]): string {
  return devices.map((one) => one.label).filter((one) => one !== undefined).join(', ');
}

export function RemoteView({
  remote, busy, contents, importing, attached, onRename, onOpen,
}: RemoteViewProps) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const drawing = drawingFor(remote.model);
  // What the document holds, or undefined because nothing has been imported into it. The tiles say `?`
  // rather than `0` for that, since zero devices is a statement about somebody's remote.
  const held = contents.contents.status === 'ready' ? contents.contents.contents.content : undefined;
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

        {/* The three ways in, each with the number the press was going to ask for. `?` and not `0`
            where nothing has been imported: zero devices is a claim about somebody's remote and an
            unimported document makes none. */}
        <div className={classes.sections}>
          <SectionTile
            value={held === undefined ? '?' : held.devices.length}
            title="Devices"
            caption={held === undefined ? 'nothing imported yet' : names(held.devices)}
            onClick={() => onOpen('devices')}
          />
          <SectionTile
            value={held === undefined ? '?' : held.activities.length}
            title="Activities"
            caption={held === undefined
              ? 'nothing imported yet'
              : held.activities.map((one) => one.name).filter((one) => one !== undefined).join(', ')}
            onClick={() => onOpen('activities')}
          />
          <SectionTile
            title="Settings"
            caption="Rename, copy, remove"
            onClick={() => onOpen('settings')}
          />
        </div>

        {/* Offered only where it can be done: a remote of this model has to be attached.
            **The word is Import and not Read**, decided on 22 August 2026. Reading a remote is an
            import and never a synchronisation, the way back is always built from the document, and
            "read" reads as looking where this replaces. Looking is what the dialogue's first half is
            for, and it is reached by the same button. */}
        {thisOne !== undefined && (
          <div className={classes.read}>
            <Button
              size="xs"
              variant={remote.baseConfiguration === undefined ? 'filled' : 'default'}
              disabled={busy}
              loading={importing.inspection.status === 'inspecting'}
              onClick={() => void importing.inspect(thisOne.productId, remote.name)}
            >
              {remote.baseConfiguration === undefined ? 'Import from the remote' : 'Import again'}
            </Button>
          </div>
        )}
      </div>

      <ImportView importing={importing} into={remote.name} onImported={() => void contents.reload()} />

    </section>
  );
}

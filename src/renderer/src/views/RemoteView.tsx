/**
 * One remote: its picture, its name, and the three ways in.
 *
 * **It is a landing page now rather than a page with everything on it**, which is Danny's own layout of
 * 22 August 2026: Devices, Activities and Settings as tiles, each badged with the number a press was going
 * to ask for. The inventory list it used to show is gone from here, because a list of four devices and
 * a list of three activities on the way in to pages about devices and activities was the same content
 * twice.
 *
 * Renaming, copying and removing moved to Settings, which is what settings means for a document: the
 * thing itself rather than what is in it. Renaming the title in place stays, because it is the fastest way
 * to do the commonest of the three and it costs nothing. It is `EditableTitle` since 22 August 2026 and no
 * longer written out here: a device's page needed the same thing, and two copies of an interaction are two
 * copies until one of them moves. The pencil on hover came free with that.
 *
 * Importing is the only thing on this page that touches hardware, and it is offered only when a remote
 * of this model is attached: a button that is always there and fails makes somebody find that out by
 * pressing it.
 */
import { Button, Text } from '@mantine/core';

import type { AttachedRemote } from '../../../shared/devices.ts';
import { whyNameIsRefused, type RemoteDocument } from '../../../shared/remote.ts';
import { drawingFor, isSameModel } from '../catalogue.ts';
import type { Contents } from '../viewmodels/useContents.ts';
import type { Importing } from '../viewmodels/useImport.ts';
import { EditableTitle } from './EditableTitle.tsx';
import { CogGlyph, StackGlyph } from './Glyphs.tsx';
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

export function RemoteView({
  remote, busy, contents, importing, attached, onRename, onOpen,
}: RemoteViewProps) {
  const drawing = drawingFor(remote.model);
  // What the document holds, or undefined because nothing has been imported into it. The tiles then carry
  // no badge at all, since zero devices is a statement about somebody's remote and this makes none.
  const held = contents.contents.status === 'ready' ? contents.contents.contents.content : undefined;
  // Which attached remote this document is about, if any. Matched on the **model**, because that is all
  // a document knows: nothing here identifies a unit, and two Harmony Ones are indistinguishable over
  // USB. So this answers "a remote of this kind is plugged in" and never "your remote is plugged in".
  const thisOne = attached.find((one) => isSameModel(remote.model, one.model));

  return (
    <section className={classes.page}>
      <div className={classes.stage}>
        {drawing === undefined
          ? <span className={classes.unknown} aria-hidden="true">{remote.name.slice(0, 1).toUpperCase()}</span>
          : <Silhouette drawing={drawing} detail="full" />}
      </div>

      <div className={classes.panel}>
        <EditableTitle
          value={remote.name}
          refuse={whyNameIsRefused}
          onCommit={onRename}
          className={classes.name}
        />

        <Text className={classes.model}>
          {remote.model === undefined ? 'Model unknown' : `Logitech ${remote.model.name}`}
        </Text>

        {/* The three ways in: a generic drawing, the word, and the count as a badge in the corner.
            Danny's, on 22 August 2026, and it replaced a big figure with a line of names under it. Two
            things were wrong with that. The line was the contents of the page you were about to open,
            written small enough to be unreadable and cut off mid name, and Settings had no number so it
            had to invent a line to keep the row the same shape.

            **No badge rather than a zero where nothing has been imported**, which is the same rule the
            library's tiles follow: a badge is a positive signal. It used to say `?` there, on the ground
            that zero devices is a claim about somebody's remote and an unimported document makes none.
            That is still true and the honest way to say it is to say nothing. */}
        <div className={classes.sections}>
          <SectionTile
            glyph={<StackGlyph />}
            title="Devices"
            {...(held === undefined ? {} : { badge: held.devices.length })}
            onClick={() => onOpen('devices')}
          />
          <SectionTile
            glyph={<StackGlyph />}
            title="Activities"
            {...(held === undefined ? {} : { badge: held.activities.length })}
            onClick={() => onOpen('activities')}
          />
          <SectionTile
            glyph={<CogGlyph />}
            title="Settings"
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

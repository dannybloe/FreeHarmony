/**
 * Plug your remote in, and what happens next.
 *
 * The page now actually looks. It asks the main process once a second which Harmonys the operating
 * system can see, which is **enumeration and nothing more**: no device is opened, no command is sent,
 * and nothing is read off anybody's remote. That distinction is worth keeping in the wording as well as
 * in the code, because it is the difference between looking at a bus and talking to hardware that
 * cannot be replaced.
 *
 * Four outcomes, and each one is a real case rather than a defensive branch:
 *
 *   - nothing attached, which is where somebody starts, so the instructions stay on screen
 *   - one attached and named, which moves straight on to the naming page with the model filled in
 *   - one attached and **not** named, because three of the forty retired models are drawn and only a
 *     fraction of the rest are in Logitech's own table. It says what it saw and offers the chooser
 *   - more than one attached, where nothing here can tell which one was meant, so it asks
 *
 * The advance on the second case is done by the shell rather than here, because it is a change of
 * screen and this component does not know about screens.
 */
import { Button, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

import type { AttachedRemote } from '../../../shared/devices.ts';
import type { RemoteModel } from '../../../shared/remote.ts';
import { type DevicesState, theRecognisedOne } from '../viewmodels/devices.model.ts';
import { PlugGlyph } from './Glyphs.tsx';
import classes from './ConnectView.module.scss';

interface ConnectViewProps {
  readonly devices: DevicesState;
  readonly onBack: () => void;
  /** Off to the chooser, for a remote that is attached and cannot be named. */
  readonly onPickByHand: () => void;
  /**
   * On with the recognised remote, by hand.
   *
   * The shell also does this by itself the moment a remote is recognised, so this button is for the
   * second visit: come back from the naming page and the remote is still plugged in, and the shell
   * deliberately does not advance again, because that would make the back arrow do nothing.
   */
  readonly onContinue: (model: RemoteModel, productId: number) => void;
}

export function ConnectView({ devices, onBack, onPickByHand, onContinue }: ConnectViewProps) {
  const recognised = theRecognisedOne(devices);
  const attached = devices.attached;

  return (
    <section className={classes.page}>
      <div className={classes.card}>
        <span className={`${classes.plug} ${recognised === undefined ? classes.waiting : classes.found}`}>
          <PlugGlyph size={46} />
        </span>

        {recognised !== undefined
          ? (
            <>
              <Title order={2} className={classes.title}>Found your {recognised.model?.name}</Title>
              <Text className={classes.lead}>
                Nothing was read off it beyond which model it is, and nothing was opened to find that out.
              </Text>
            </>
            )
          : (
            <>
              <Title order={2} className={classes.title}>Connect your remote</Title>
              <Text className={classes.lead}>
                Plug it into this computer with its own USB cable and give it a moment to appear.
              </Text>
            </>
            )}

        {recognised === undefined && (
          <ol className={classes.steps}>
            <li>Use the cable that came with the remote, or any data cable that fits it.</li>
            <li>Plug it straight into the computer rather than through a hub, which is more reliable.</li>
            <li>The remote will show that it is connected on its own screen.</li>
          </ol>
        )}

        {devices.status === 'failed' && (
          <Note title="Could not look at the USB bus">{devices.error}</Note>
        )}

        {devices.status !== 'failed' && attached.length === 0 && (
          <p className={classes.searching}>
            <span className={classes.dots} aria-hidden="true"><i /><i /><i /></span>
            {devices.status === 'looking' ? 'Looking...' : 'Nothing attached yet'}
          </p>
        )}

        {attached.length > 1 && (
          <Note title={`${attached.length} remotes are attached`}>
            Nothing here can tell which one you meant, so leave the one you want plugged in and unplug
            the rest. Seen: {attached.map(describeBriefly).join(', ')}.
          </Note>
        )}

        {attached.length === 1 && recognised === undefined && (
          <Note title="Attached, but not recognised">
            {describeBriefly(attached[0] as AttachedRemote)} is a Harmony, and nothing here names that
            model. You can still add it by picking the closest model by hand.
          </Note>
        )}

        <div className={classes.actions}>
          <Button variant="default" size="sm" onClick={onBack}>Back</Button>
          {attached.length === 1 && recognised === undefined && (
            <Button size="sm" onClick={onPickByHand}>Pick a model...</Button>
          )}
          {recognised?.model !== undefined && (
            <Button size="sm" onClick={() => onContinue(recognised.model!, recognised.productId)}>
              Name it...
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/** What we can say about a remote without opening it, which on a bad day is a number. */
function describeBriefly(device: AttachedRemote): string {
  if (device.model !== undefined) return device.model.name;
  const skin = device.skin === undefined ? 'no skin' : `skin ${device.skin}`;
  return `${device.product ?? 'A remote'} (${skin}, product 0x${device.productId.toString(16)})`;
}

/**
 * The amber box. Nothing is broken, something is simply not what the happy path wanted.
 *
 * Amber and not red on purpose, and all three of its uses earn it: two remotes attached, a model
 * nobody has recorded, and a bus that would not answer are all situations somebody can act on, not
 * faults. A red box would say the application had gone wrong.
 */
function Note({ title, children }: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={classes.note}>
      <Text className={classes.noteTitle}>{title}</Text>
      <Text className={classes.noteBody}>{children}</Text>
    </div>
  );
}

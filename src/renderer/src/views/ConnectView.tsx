/**
 * Plug your remote in, and what happens next.
 *
 * The one screen in this flow that is honest about not being finished, and it says so on itself rather
 * than in a document. Reading a remote means talking to it over USB: enumerating the bus to see which
 * model is attached, which needs no more than looking, and then asking the remote for its own version
 * block, which means opening a device that cannot be replaced. Both are the next step and neither is
 * pretended here. A spinner that can never resolve would be worse than a sentence.
 *
 * The instructions are real and worth showing now, because they are what somebody has to do either way.
 */
import { Button, Text, Title } from '@mantine/core';

import { PlugGlyph } from './Glyphs.tsx';
import classes from './ConnectView.module.scss';

export function ConnectView({ onBack }: { readonly onBack: () => void }) {
  return (
    <section className={classes.page}>
      <div className={classes.card}>
        <span className={classes.plug}><PlugGlyph size={46} /></span>
        <Title order={2} className={classes.title}>Connect your remote</Title>
        <Text className={classes.lead}>
          Plug it into this computer with its own USB cable and give it a moment to appear.
        </Text>

        <ol className={classes.steps}>
          <li>Use the cable that came with the remote, or any data cable that fits it.</li>
          <li>Plug it straight into the computer rather than through a hub, which is more reliable.</li>
          <li>The remote will show that it is connected on its own screen.</li>
        </ol>

        <div className={classes.pending}>
          <Text className={classes.pendingTitle}>Not yet listening</Text>
          <Text className={classes.pendingBody}>
            Recognising a connected remote is the next thing being built. Until then, pick your model by
            hand and this page will do the rest later.
          </Text>
        </div>

        <div className={classes.actions}>
          <Button variant="default" size="sm" onClick={onBack}>Back</Button>
        </div>
      </div>
    </section>
  );
}

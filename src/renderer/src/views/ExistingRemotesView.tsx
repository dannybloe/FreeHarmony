/**
 * You already have one of these. Open it, or add another?
 *
 * **It says "a Harmony One" and never "this remote", and that wording is the whole honesty of the
 * screen.** Nothing in this application can tell one Harmony One from another: a Harmony declares
 * `iSerialNumber 0` in its USB descriptor, so enumeration has no serial to report, and the per unit
 * identifiers do exist but sit in the remote's own internal flash behind an opened device.
 *
 * **The wording is the whole of it, and the screen does not explain any of the above**, which is this
 * application's standing rule: it is not a diagnostic tool. A paragraph about serial numbers under two
 * tiles would turn choosing a remote into reading about USB. So the heading names the model, the two
 * answers are equally weighted, and the reasoning lives here.
 *
 * **Adding another is a first class answer and not a fallback.** Somebody with two Harmony Ones is the
 * ordinary case this exists for, and the alternative, silently reusing a document because the model
 * matched, is the mistake worth a screen to avoid.
 *
 * The matches are derived from the live list every time this is drawn, rather than carried on the
 * screen's own state, so a document renamed or deleted in another window cannot leave a stale entry here.
 */
import { Button, Text, Title } from '@mantine/core';

import type { RemoteDocument, RemoteModel } from '../../../shared/remote.ts';
import { describe } from '../catalogue.ts';
import { RemoteTile } from './RemoteTile.tsx';
import classes from './ExistingRemotesView.module.scss';

interface ExistingRemotesViewProps {
  readonly model: RemoteModel;
  /** Every document whose model is this one. Never empty: the shell only comes here when it is not. */
  readonly matches: readonly RemoteDocument[];
  readonly onOpen: (name: string) => void;
  readonly onAddAnother: () => void;
}

export function ExistingRemotesView({ model, matches, onOpen, onAddAnother }: ExistingRemotesViewProps) {
  const drawing = describe(model).drawing;

  return (
    <section className={classes.page}>
      <Title order={2} className={classes.title}>
        You already have {matches.length === 1 ? 'a' : `${matches.length}`} {model.name}
        {matches.length === 1 ? '' : 's'}
      </Title>

      <Text className={classes.lead}>
        {/* The count is in the heading, so the sentence does not repeat it. The first version did, and
            said "you have already added one" above two tiles. */}
        Open it, or add another one.
      </Text>

      <div className={classes.matches}>
        {matches.map((remote) => (
          <RemoteTile
            key={remote.name}
            title={remote.name}
            caption={remote.baseConfiguration === undefined ? 'no configuration' : 'has a configuration'}
            drawing={drawing}
            onClick={() => onOpen(remote.name)}
          />
        ))}
      </div>

      <div className={classes.actions}>
        <Button size="sm" variant="default" onClick={onAddAnother}>Add another one...</Button>
      </div>

    </section>
  );
}

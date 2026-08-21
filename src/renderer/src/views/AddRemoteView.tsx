/**
 * Add a remote: read one off the hardware, or say which model you have.
 *
 * Two routes side by side, as sketched. The left one goes to the Connect page, which watches the bus and
 * recognises whatever is plugged in; the right one is for a remote that is not to hand.
 *
 * The chooser's tiles are **faces, not model numbers**. Where two numbers are the same remote they
 * share a tile and both numbers are on it; where the keys differ they are different remotes and get a
 * tile each. That rule is in `catalogue.ts` and the caption below just reads it out.
 */
import { Button, Text, Title } from '@mantine/core';

import { SUPPORTED, type SupportedModel } from '../catalogue.ts';
import { Carousel } from './Carousel.tsx';
import { PlugGlyph } from './Glyphs.tsx';
import { RemoteTile } from './RemoteTile.tsx';
import classes from './AddRemoteView.module.scss';

interface AddRemoteViewProps {
  readonly picked: string | undefined;
  readonly onPick: (id: string) => void;
  readonly onContinue: (model: SupportedModel) => void;
  readonly onConnect: () => void;
}

export function AddRemoteView({ picked, onPick, onContinue, onConnect }: AddRemoteViewProps) {
  const chosen = SUPPORTED.find((model) => model.id === picked);

  return (
    <section className={classes.add}>
      <div className={classes.heading}>
        <Title order={2} className={classes.title}>Add a remote</Title>
        <Text className={classes.lead}>
          Read the one you own, or pick the model and set it up from scratch.
        </Text>
      </div>

      <div className={classes.routes}>
        <button type="button" className={classes.connect} onClick={onConnect}>
          <span className={classes.plug}><PlugGlyph size={30} /></span>
          <span className={classes.connectTitle}>Connect...</span>
          <span className={classes.connectCaption}>Plug your remote in over USB</span>
        </button>

        <div className={classes.chooser}>
          <Carousel label="Supported models">
            {SUPPORTED.map((model) => (
              <RemoteTile
                key={model.id}
                title={model.name}
                caption={model.soldAs.length > 1 ? `also sold as ${model.soldAs.slice(1).join(', ')}` : ''}
                drawing={model.drawing}
                selected={model.id === picked}
                onClick={() => onPick(model.id)}
              />
            ))}
          </Carousel>

          <div className={classes.footer}>
            {/* Empty until something is picked. It used to count the drawings here, which told somebody
                how far this application has got rather than anything about their remote. */}
            <Text className={classes.facts}>{chosen === undefined ? '' : chosen.facts.join(' · ')}</Text>
            <Button
              size="sm"
              disabled={chosen === undefined}
              onClick={() => chosen !== undefined && onContinue(chosen)}
            >
              Add...
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

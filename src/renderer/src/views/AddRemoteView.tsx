/**
 * Add a remote: read one off the hardware, or say which model you have.
 *
 * Two routes side by side, as sketched, and the left one is the honest half of this screen. Reading a
 * remote means talking to it over USB, which this application cannot do yet, so the tile says so on
 * itself rather than in a document. Showing the shape of the screen with one route still arriving beats
 * a screen that changes shape later.
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
            <Text className={classes.facts}>
              {chosen === undefined ? 'Three models are drawn so far.' : chosen.facts.join(' · ')}
            </Text>
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

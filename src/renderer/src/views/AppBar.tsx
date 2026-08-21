/**
 * The bar across the top: the name, and the way back.
 *
 * It holds no state and decides nothing. Whether there is anywhere to go back to is a question about
 * navigation, so it arrives as a property.
 *
 * The two buttons it used to carry are gone. Adding a remote belongs on Home, beside the remotes it
 * would join, and a permanent toolbar of actions is what a bar becomes when nobody decides where an
 * action lives.
 */
import { Title, Tooltip } from '@mantine/core';

import { BeamMark, ChevronGlyph, PulseTrain } from './Glyphs.tsx';
import classes from './AppBar.module.scss';

interface AppBarProps {
  readonly canGoBack: boolean;
  readonly onBack: () => void;
}

export function AppBar({ canGoBack, onBack }: AppBarProps) {
  return (
    <header className={classes.bar}>
      <PulseTrain className={classes.pulse} />

      <div className={classes.left}>
        {canGoBack && (
          <Tooltip label="Back" withArrow openDelay={400}>
            <button type="button" className={classes.back} onClick={onBack} aria-label="Back">
              <ChevronGlyph towards="left" size={20} />
            </button>
          </Tooltip>
        )}
        <BeamMark size={26} className={classes.mark} />
        <Title order={1} className={classes.wordmark}>
          Free<span className={classes.wordmarkTail}>Harmony</span>
        </Title>
      </div>
    </header>
  );
}

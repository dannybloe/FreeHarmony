/**
 * The bar across the top: the name, and the two ways a remote gets into the application.
 *
 * It holds no state and decides nothing. Both actions are handed in, because whether adding a remote
 * is possible right now is a question about the store and this is a view.
 *
 * **Attaching is offered and refused for now**, with the reason on the button rather than in a
 * document: it means reading a configuration off a connected remote, and this application cannot talk
 * to one yet. Showing the shape of the screen with one route not yet arrived is better than a screen
 * that changes shape later, and a disabled control that says why is not a dead end.
 */
import { Button, Group, Title, Tooltip } from '@mantine/core';

import { BeamMark, PlugGlyph, PlusGlyph, PulseTrain } from './Glyphs.tsx';
import classes from './AppBar.module.scss';

interface AppBarProps {
  readonly onAdd: () => void;
  readonly busy: boolean;
}

export function AppBar({ onAdd, busy }: AppBarProps) {
  return (
    <header className={classes.bar}>
      <PulseTrain className={classes.pulse} />

      <Group gap="sm" wrap="nowrap">
        <BeamMark size={26} className={classes.mark} />
        <Title order={1} className={classes.wordmark}>
          Free<span className={classes.wordmarkTail}>Harmony</span>
        </Title>
      </Group>

      <Group gap="sm" wrap="nowrap">
        <Tooltip label="Reading a remote over USB comes later" withArrow>
          <Button variant="default" size="sm" disabled leftSection={<PlugGlyph />}>
            Attach a remote
          </Button>
        </Tooltip>
        <Button size="sm" onClick={onAdd} disabled={busy} leftSection={<PlusGlyph />}>
          New remote
        </Button>
      </Group>
    </header>
  );
}

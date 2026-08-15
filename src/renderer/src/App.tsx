/**
 * Still a placeholder, but now a styled one, and it is the demonstration that `#5` asks for rather
 * than the welcome page that `#6` asks for.
 *
 * What it shows is the agreement working end to end: Mantine draws the components, a Sass module
 * decides how they look, and the JSX below carries **placement only**. There is no colour, no font
 * size and no weight in this file. Those are in `App.module.scss` and in the theme, which is the
 * rule the lint check will enforce once there is one.
 */
import { Card, Stack, Text, Title } from '@mantine/core';

import classes from './App.module.scss';

export function App() {
  return (
    <main className={classes.shell}>
      <Card className={classes.card} withBorder p="xl">
        <Stack gap="sm">
          <Title order={1}>FreeHarmony</Title>
          <Text>
            The window opens, the build works, and the styling foundation is in place. Nothing else
            has been built yet.
          </Text>
          <Text className={classes.note} size="sm">
            No remote is involved. Nothing has been read.
          </Text>
        </Stack>
      </Card>
    </main>
  );
}

/**
 * The view: what a list of remotes looks like, and nothing about what a remote is.
 *
 * It reads its whole state from `useRemotes` and decides nothing. There is no `await` here, no fetch,
 * no sorting rule and no judgement about names or about what may be written: `byMostRecentlyChanged`,
 * `whyNameIsRefused` and `isWritable` are in the shared model, because all three are statements about
 * remotes rather than about this screen, and a second copy of any of them would be a second answer.
 *
 * `whyNameIsRefused` is used here to **explain early**, not to decide. The store refuses with the
 * same function and that is the refusal that counts; this one is so that somebody sees why before
 * pressing anything.
 *
 * Placement is in the JSX and appearance is in the stylesheet, per the agreement. Mantine's spacing
 * and size props are placement; anything about colour, weight or type lives in the stylesheet and in
 * the theme.
 */
import { Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';

import { isWritable, whyNameIsRefused } from '../../../shared/remote.ts';
import { useRemotes } from '../viewmodels/useRemotes.ts';
import classes from './RemotesView.module.scss';

export function RemotesView() {
  const remotes = useRemotes();
  // What is being typed is view state and lives here, which is the distinction the architecture
  // turns on: it is not part of any remote and it never reaches the main process unless accepted.
  const [wanted, setWanted] = useState('');
  const [editing, setEditing] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState('');

  const refusal = wanted === '' ? undefined : whyNameIsRefused(wanted);

  const add = () => {
    if (refusal !== undefined || wanted.trim() === '') return;
    void remotes.create(wanted).then(() => setWanted(''));
  };

  const accept = (name: string) => {
    setEditing(undefined);
    if (whyNameIsRefused(draft) === undefined) void remotes.rename(name, draft);
  };

  return (
    <Stack className={classes.list} gap="md">
      <Title order={1}>Your remotes</Title>

      <Group align="flex-start" gap="sm">
        <TextInput
          flex={1}
          label="Add a remote"
          placeholder="the name you will recognise it by"
          value={wanted}
          error={refusal}
          onChange={(event) => setWanted(event.currentTarget.value)}
          onKeyDown={(event) => event.key === 'Enter' && add()}
        />
        <Button mt={25} onClick={add} disabled={remotes.busy || refusal !== undefined || wanted.trim() === ''}>
          Add
        </Button>
      </Group>

      {remotes.error !== undefined && <Text className={classes.problem}>{remotes.error}</Text>}

      {remotes.status === 'loading' && <Text className={classes.empty}>Reading your remotes.</Text>}

      {remotes.status === 'ready' && remotes.remotes.length === 0 && (
        <Text className={classes.empty}>
          Nothing here yet. Add one above, or read one off a remote once that exists.
        </Text>
      )}

      {remotes.remotes.map((remote) => (
        <Card key={remote.name} withBorder p="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={2} flex={1}>
              {editing === remote.name ? (
                // The one change this screen can make, and the point of it is the round trip: type,
                // accept, and the list that comes back is the one the main process read off disk.
                // A rename here moves a folder in the documents folder, which is why the same rule
                // that guards a new name guards this one.
                <TextInput
                  autoFocus
                  value={draft}
                  error={whyNameIsRefused(draft)}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  onBlur={() => accept(remote.name)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') accept(remote.name);
                    if (event.key === 'Escape') setEditing(undefined);
                  }}
                />
              ) : (
                <Text
                  className={classes.name}
                  title="double click to rename"
                  onDoubleClick={() => {
                    setEditing(remote.name);
                    setDraft(remote.name);
                  }}
                >
                  {remote.name}
                </Text>
              )}
              <Text className={classes.detail} size="sm">
                added {remote.createdAt.slice(0, 10)}, {remote.provenance.replace(/-/g, ' ')}
              </Text>
              {!isWritable(remote) && (
                <Text className={classes.problem} size="sm">
                  No configuration behind it yet, so it cannot be sent to a remote.
                </Text>
              )}
            </Stack>
            <Group gap="xs" wrap="nowrap">
              <Button
                variant="default"
                size="xs"
                disabled={remotes.busy}
                onClick={() => void remotes.duplicate(remote.name)}
              >
                Duplicate
              </Button>
              <Button
                variant="default"
                size="xs"
                disabled={remotes.busy}
                onClick={() => void remotes.remove(remote.name)}
              >
                Remove
              </Button>
            </Group>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

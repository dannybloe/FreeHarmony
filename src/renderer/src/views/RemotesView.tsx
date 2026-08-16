/**
 * The view: what a list of remotes looks like, and nothing about what a remote is.
 *
 * It reads its whole state from `useRemotes` and decides nothing. There is no `await` here, no fetch,
 * no sorting rule and no judgement about what may be written: `byMostRecentlyChanged` and
 * `isWritable` are in the shared model, because both are statements about remotes rather than about
 * this screen, and a second copy of either would be a second answer.
 *
 * Placement is in the JSX and appearance is in the stylesheet, per the agreement. Mantine's spacing
 * and size props are placement; anything about colour, weight or type lives in `RemotesView.module.scss`
 * and in the theme.
 */
import { Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';

import { isWritable } from '../../../shared/remote.ts';
import { useRemotes } from '../viewmodels/useRemotes.ts';
import classes from './RemotesView.module.scss';

export function RemotesView() {
  const remotes = useRemotes();
  // What is being typed is view state and lives here, which is the distinction the architecture
  // turns on: it is not part of any remote and it never reaches the main process unless accepted.
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState('');

  const add = () => {
    if (name.trim() === '') return;
    void remotes.create(name).then(() => setName(''));
  };

  const accept = (id: string) => {
    setEditing(undefined);
    if (draft.trim() !== '') void remotes.rename(id, draft);
  };

  return (
    <Stack className={classes.list} gap="md">
      <Title order={1}>Your remotes</Title>

      <Group align="flex-end" gap="sm">
        <TextInput
          flex={1}
          label="Add a remote"
          placeholder="the name you will recognise it by"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => event.key === 'Enter' && add()}
        />
        <Button onClick={add} disabled={remotes.busy || name.trim() === ''}>
          Add
        </Button>
      </Group>

      {remotes.error !== undefined && <Text className={classes.notWritable}>{remotes.error}</Text>}

      {remotes.status === 'loading' && <Text className={classes.empty}>Reading your remotes.</Text>}

      {remotes.status === 'ready' && remotes.remotes.length === 0 && (
        <Text className={classes.empty}>
          Nothing here yet. Add one above, or read one off a remote once that exists.
        </Text>
      )}

      {remotes.remotes.map((remote) => (
        <Card key={remote.id} withBorder p="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={2} flex={1}>
              {editing === remote.id ? (
                // The one change this screen can make. It is here rather than in a dialog because
                // the point of it is the round trip: type, accept, and the list that comes back is
                // the one the main process read off disk again.
                <TextInput
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  onBlur={() => accept(remote.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') accept(remote.id);
                    if (event.key === 'Escape') setEditing(undefined);
                  }}
                />
              ) : (
                <Text
                  className={classes.name}
                  onDoubleClick={() => {
                    setEditing(remote.id);
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
                <Text className={classes.notWritable} size="sm">
                  No configuration behind it yet, so it cannot be sent to a remote.
                </Text>
              )}
            </Stack>
            <Group gap="xs" wrap="nowrap">
              <Button
                variant="default"
                size="xs"
                disabled={remotes.busy}
                onClick={() => void remotes.duplicate(remote.id)}
              >
                Duplicate
              </Button>
              <Button
                variant="default"
                size="xs"
                disabled={remotes.busy}
                onClick={() => void remotes.remove(remote.id)}
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

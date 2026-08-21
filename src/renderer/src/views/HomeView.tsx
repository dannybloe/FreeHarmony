/**
 * Home: the remotes somebody has, and the one way to get another.
 *
 * Danny's first sketch, and it is deliberately only two things. Picking a remote opens it; the tile at
 * the end adds one. Renaming, duplicating and removing live on a remote's own page, which is how a
 * document application works and is what keeps this screen readable.
 *
 * Everything it draws comes from the list the main process handed over. It sorts nothing, decides
 * nothing about names and resolves no drawing of its own: `byMostRecentlyChanged` and `drawingFor` are
 * shared, because both are statements about remotes rather than about this screen.
 */
import { Text, Title } from '@mantine/core';

import type { RemoteDocument } from '../../../shared/remote.ts';
import { drawingFor } from '../catalogue.ts';
import { Carousel } from './Carousel.tsx';
import { AddTile, RemoteTile } from './RemoteTile.tsx';
import classes from './HomeView.module.scss';

interface HomeViewProps {
  readonly remotes: readonly RemoteDocument[];
  readonly loading: boolean;
  readonly onOpen: (name: string) => void;
  readonly onAdd: () => void;
}

/** "added 16 August", which is the one fact a tile has room for. */
function added(remote: RemoteDocument): string {
  const on = new Date(remote.createdAt);
  return `added ${on.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;
}

export function HomeView({ remotes, loading, onOpen, onAdd }: HomeViewProps) {
  const empty = !loading && remotes.length === 0;

  return (
    <section className={classes.home}>
      <div className={classes.heading}>
        <Title order={2} className={classes.title}>
          {empty ? 'Add your first remote' : 'Pick your remote'}
        </Title>
        <Text className={classes.lead}>
          {empty
            ? 'Nothing here yet. Every remote you add is a folder in your documents, yours to copy and keep.'
            : 'Everything you add lives in your own documents, as a folder each.'}
        </Text>
      </div>

      <Carousel label="Your remotes">
        {remotes.map((remote) => (
          <RemoteTile
            key={remote.name}
            title={remote.name}
            caption={remote.model?.name ?? added(remote)}
            drawing={drawingFor(remote.model)}
            onClick={() => onOpen(remote.name)}
          />
        ))}
        <AddTile label="Add..." onClick={onAdd} />
      </Carousel>
    </section>
  );
}

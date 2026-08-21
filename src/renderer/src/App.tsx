/**
 * The shell: one model of the remotes, one model of where we are, and the screen that follows.
 *
 * Both view models are constructed **here and once**. Two components each calling `useRemotes` would be
 * two lists, two loads and two answers, and the day they disagreed the window would be showing a remote
 * that no longer exists. So the state lives at the top and the screens take properties.
 *
 * The other job of this file is the one that is easy to forget: **navigation has to hear about a change
 * to a document.** Renaming a remote while looking at it has to follow the new name, and removing it has
 * to leave the page, because a screen holding a name whose folder is gone is a page drawing nothing. The
 * handlers below are where those two are wired, deliberately in one place.
 */
import { Text } from '@mantine/core';
import { useState } from 'react';

import type { RemoteModel } from '../../shared/remote.ts';
import { SUPPORTED } from './catalogue.ts';
import { useNavigation } from './viewmodels/useNavigation.ts';
import { useRemotes } from './viewmodels/useRemotes.ts';
import { AddRemoteView } from './views/AddRemoteView.tsx';
import { AppBar } from './views/AppBar.tsx';
import { ConnectView } from './views/ConnectView.tsx';
import { HomeView } from './views/HomeView.tsx';
import { NameRemoteView } from './views/NameRemoteView.tsx';
import { RemoteView } from './views/RemoteView.tsx';
import classes from './App.module.scss';

export function App() {
  const remotes = useRemotes();
  const { screen, model: nav } = useNavigation();
  // Which model is highlighted in the chooser. View state, and it belongs to this flow rather than to
  // navigation: leaving the page and coming back should not remember a half made choice.
  const [picked, setPicked] = useState<string | undefined>(undefined);

  const add = async (name: string, model: RemoteModel) => {
    await remotes.create(name, model);
    setPicked(undefined);
    nav.home();
  };

  const rename = async (from: string, to: string) => {
    await remotes.rename(from, to);
    nav.renamed(from, to.trim());
  };

  const remove = async (name: string) => {
    await remotes.remove(name);
    nav.removed(name);
  };

  return (
    <div className={classes.shell}>
      <AppBar canGoBack={nav.canGoBack} onBack={() => nav.back()} />

      <main className={classes.page}>
        {remotes.error !== undefined && <Text c="red" size="sm">{remotes.error}</Text>}

        {screen.at === 'home' && (
          <HomeView
            remotes={remotes.remotes}
            loading={remotes.status === 'loading'}
            onOpen={(name) => nav.go({ at: 'remote', name })}
            onAdd={() => nav.go({ at: 'add' })}
          />
        )}

        {screen.at === 'add' && (
          <AddRemoteView
            picked={picked}
            onPick={setPicked}
            onContinue={(model) => nav.go({ at: 'name', modelId: model.id })}
            onConnect={() => nav.go({ at: 'connect' })}
          />
        )}

        {screen.at === 'name' && (() => {
          const model = SUPPORTED.find((m) => m.id === screen.modelId);
          // A screen naming a model that is not in the catalogue cannot be drawn, and going home is the
          // honest response. It arises if a drawing is withdrawn next door while this window is open.
          if (model === undefined) return <Text size="sm">That model is no longer available.</Text>;
          return <NameRemoteView model={model} busy={remotes.busy} onAdd={(name, m) => void add(name, m)} />;
        })()}

        {screen.at === 'connect' && <ConnectView onBack={() => nav.back()} />}

        {screen.at === 'remote' && (() => {
          const remote = nav.resolve(remotes.remotes);
          // The folder was renamed or deleted from outside while this page was open. Saying so beats
          // drawing an empty page, and the way back is in the bar.
          if (remote === undefined) {
            return <Text size="sm">That remote is no longer in your documents.</Text>;
          }
          return (
            <RemoteView
              remote={remote}
              busy={remotes.busy}
              onRename={(to) => void rename(remote.name, to)}
              onDuplicate={() => void remotes.duplicate(remote.name)}
              onRemove={() => void remove(remote.name)}
            />
          );
        })()}
      </main>
    </div>
  );
}

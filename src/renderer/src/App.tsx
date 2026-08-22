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
import { useEffect, useRef, useState } from 'react';

import type { HardwareReading } from '../../shared/devices.ts';
import type { RemoteModel } from '../../shared/remote.ts';
import { api } from './api.ts';
import { asRemoteModel, isSameModel } from './catalogue.ts';
import { advanceOn } from './viewmodels/devices.model.ts';
import { definitionIn } from './viewmodels/library.model.ts';
import { afterChoosingModel, remoteOn } from './viewmodels/navigation.model.ts';
import { useContents } from './viewmodels/useContents.ts';
import { useDevices } from './viewmodels/useDevices.ts';
import { useHardware } from './viewmodels/useHardware.ts';
import { useImport } from './viewmodels/useImport.ts';
import { useLibrary } from './viewmodels/useLibrary.ts';
import { useNavigation } from './viewmodels/useNavigation.ts';
import { useRemotes } from './viewmodels/useRemotes.ts';
import { ActivitiesView } from './views/ActivitiesView.tsx';
import { AddRemoteView } from './views/AddRemoteView.tsx';
import { AppBar } from './views/AppBar.tsx';
import { ConnectView } from './views/ConnectView.tsx';
import { DeviceView } from './views/DeviceView.tsx';
import { DevicesView } from './views/DevicesView.tsx';
import { ExistingRemotesView } from './views/ExistingRemotesView.tsx';
import { HomeView } from './views/HomeView.tsx';
import { NameRemoteView } from './views/NameRemoteView.tsx';
import { PickDeviceView } from './views/PickDeviceView.tsx';
import { RemoteView } from './views/RemoteView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import classes from './App.module.scss';

export function App() {
  const remotes = useRemotes();
  const { screen, model: nav } = useNavigation();
  // Which model is highlighted in the chooser. View state, and it belongs to this flow rather than to
  // navigation: leaving the page and coming back should not remember a half made choice.
  const [picked, setPicked] = useState<string | undefined>(undefined);
  // The USB bus is watched while the Connect screen is up, and while a remote's own page is open.
  // Passing the condition in rather than mounting the hook conditionally is what keeps the polling in
  // one place and stops it running for the life of the window.
  //
  // **The second screen is why this is a condition and not a constant.** A document's page offers to
  // read the remote it is about, and that offer can only be honest if something is watching the bus.
  // Enumeration opens nothing, so it is the cheap half; the read is a button.
  const devices = useDevices(screen.at === 'connect' || screen.at === 'remote');
  // What the open document holds. Keyed on the name, so opening a different remote asks about that one,
  // and asked for on every screen about a remote rather than only the front one: `remoteOn` is the one
  // place that says which those are, so a screen added later is covered without this line changing.
  const contents = useContents(remoteOn(screen));
  const importing = useImport();
  // The appliances this machine describes, wanted by the two screens that name one.
  const library = useLibrary(screen.at === 'devices' || screen.at === 'device');
  const [picking, setPicking] = useState(false);
  // The one thing here that opens a remote. It is a model of its own rather than part of `useDevices`,
  // because that one polls and this one must never be on a timer.
  const hardware = useHardware();

  const add = async (name: string, model: RemoteModel, read?: HardwareReading) => {
    await remotes.create(name, model, read);
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

  // Putting an appliance on a remote, which changes the document's contents rather than the folder, so
  // it reloads the contents and not the list. The picker closes itself; this is only the writing.
  const addDevice = async (name: string, definition: string, label: string) => {
    await api().remotes.addDevice(name, definition, label);
    await contents.reload();
  };

  // A recognised remote moves the flow on by itself, which is what the sketch asked for: you plug it in
  // and you are being asked what to call it. The decision is `advanceOn`, in the view model, where a
  // test can walk it; what is left here is the change of screen and the memory it needs, because a ref
  // is a React thing and a rule is not.
  const advancedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (screen.at !== 'connect') return;
    const next = advanceOn(devices, advancedFor.current);
    advancedFor.current = next.remember;
    if (next.model !== undefined) {
      nav.go(afterChoosingModel(remotes.remotes, next.model, 'device', next.productId));
    }
  }, [screen.at, devices, nav, remotes.remotes]);

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
            onContinue={(model) =>
              nav.go(afterChoosingModel(remotes.remotes, asRemoteModel(model), 'chooser'))}
            onConnect={() => nav.go({ at: 'connect' })}
          />
        )}

        {screen.at === 'name' && (
          <NameRemoteView
            model={screen.model}
            origin={screen.origin}
            productId={screen.productId}
            hardware={hardware}
            busy={remotes.busy}
            onReadHardware={(productId) => void hardware.read(productId)}
            onAdd={(name, model, read) => void add(name, model, read)}
          />
        )}

        {screen.at === 'existing' && (() => {
          const matches = remotes.remotes.filter((r) => isSameModel(r.model, screen.model));
          // Every match was removed while this page was open, from another window or from Finder. The
          // question no longer arises, so the honest thing is to ask the name straight away rather than
          // to draw a page listing nothing.
          if (matches.length === 0) {
            return (
              <NameRemoteView
                model={screen.model}
                origin={screen.origin}
                productId={screen.productId}
                hardware={hardware}
                busy={remotes.busy}
                onReadHardware={(productId) => void hardware.read(productId)}
                onAdd={(name, model, read) => void add(name, model, read)}
              />
            );
          }
          return (
            <ExistingRemotesView
              model={screen.model}
              matches={matches}
              onOpen={(name) => nav.go({ at: 'remote', name })}
              onAddAnother={() =>
                nav.go({
                  at: 'name', model: screen.model, origin: screen.origin,
                  ...(screen.productId === undefined ? {} : { productId: screen.productId }),
                })}
            />
          );
        })()}

        {screen.at === 'connect' && (
          <ConnectView
            devices={devices}
            onBack={() => nav.back()}
            onPickByHand={() => nav.go({ at: 'add' })}
            onContinue={(model, productId) =>
              nav.go(afterChoosingModel(remotes.remotes, model, 'device', productId))}
          />
        )}

        {/* Every screen about one remote, resolved once.
            One block rather than five, because all five need the same two things: the document out of the
            list the main process gave us, and something honest to say when it is not there. Five copies
            of that would be five chances to forget the second. */}
        {remoteOn(screen) !== undefined && (() => {
          const remote = nav.resolve(remotes.remotes);
          // The folder was renamed or deleted from outside while this page was open. Saying so beats
          // drawing an empty page, and the way back is in the bar.
          if (remote === undefined) {
            return <Text size="sm">That remote is no longer in your documents.</Text>;
          }
          const held = contents.contents.status === 'ready' ? contents.contents.contents : undefined;

          if (screen.at === 'remote') {
            return (
              <RemoteView
                remote={remote}
                busy={remotes.busy}
                contents={contents}
                importing={importing}
                attached={devices.attached}
                onRename={(to) => void rename(remote.name, to)}
                onOpen={(section) => nav.go({ at: section, name: remote.name })}
              />
            );
          }
          if (screen.at === 'devices') {
            return (
              <>
                <DevicesView
                  remote={remote.name}
                  contents={held}
                  library={library.state}
                  onOpen={(slot) => nav.go({ at: 'device', name: remote.name, slot })}
                  onAdd={() => setPicking(true)}
                />
                <PickDeviceView
                  opened={picking}
                  library={library.state}
                  alreadyHere={(held?.content.devices ?? []).map((one) => one.definition)}
                  onClose={() => setPicking(false)}
                  onPick={(definition, label) => void addDevice(remote.name, definition, label)}
                />
              </>
            );
          }
          if (screen.at === 'device') {
            return (
              <DeviceView
                remote={remote.name}
                slot={screen.slot}
                contents={held}
                definition={definitionIn(
                  library.state,
                  held?.content.devices.find((one) => one.slot === screen.slot)?.definition)}
              />
            );
          }
          if (screen.at === 'activities') {
            return <ActivitiesView remote={remote.name} contents={held} />;
          }
          return (
            <SettingsView
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

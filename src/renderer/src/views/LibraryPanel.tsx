/**
 * The device library, as a panel over the application.
 *
 * Danny's, on 22 August 2026, and the reason is where the descriptions actually live: a television belongs
 * to every remote that drives it, so its page belongs to no remote and should be reachable from wherever
 * you happen to be. A panel does that where a screen cannot, because a screen would have to take you away
 * from what you were doing and then bring you back.
 *
 * **The application underneath does not change while this is open.** Its own trail stays exactly as it was
 * and cannot be pressed, because there is a sheet over it. That was a correction: the first proposal hid
 * the application's way back while the panel was up, which is the panel reaching down and altering the
 * thing it is supposed to be lying on top of.
 *
 * Three screens inside, each a page rather than a dialogue, with the panel's own trail carrying the way up.
 * The pages themselves are the three files next door; this one is the sheet, the bar and the routing.
 */
import { Modal, Tooltip } from '@mantine/core';

import type { DeviceDefinition, DeviceDraft } from '../../../shared/library.ts';
import type { RemoteModel } from '../../../shared/remote.ts';
import { headingFor } from '../../../shared/library.ts';
import type { LibraryNavigationModel } from '../viewmodels/library-navigation.model.ts';
import { libraryTrailFor } from '../viewmodels/trail.model.ts';
import { definitionIn, headingIn, type LibraryState } from '../viewmodels/library.model.ts';
import { AddDeviceView } from './AddDeviceView.tsx';
import { Header } from './Header.tsx';
import { LibraryDeviceView } from './LibraryDeviceView.tsx';
import { LibraryListView } from './LibraryListView.tsx';
import classes from './LibraryPanel.module.scss';

interface LibraryPanelProps {
  readonly nav: LibraryNavigationModel;
  readonly state: LibraryState;
  readonly onCreate: (draft: DeviceDraft) => Promise<DeviceDefinition>;
  readonly onSave: (definition: DeviceDefinition) => void;
  readonly onClone: (id: string, name?: string) => Promise<DeviceDefinition>;
  readonly onRemove: (id: string) => void;
  /**
   * Which remotes exist, so a device's own page can draw the ones using it.
   *
   * The whole model and not just its name, because those tiles carry a drawing of the remote and
   * `drawingFor` needs the skin: a document that knows only a name still gets the right picture where the
   * name matches a drawn model, and no picture where it does not.
   */
  readonly remotes: readonly { readonly name: string; readonly model?: RemoteModel }[];
  /** Open that remote in the application and close the panel. */
  readonly onOpenRemote: (name: string) => void;
  /** Put this device on the remote the panel was opened from, then close. */
  readonly onAddToCurrent: (id: string) => void;
}

export function LibraryPanel({
  nav, state, onCreate, onSave, onClone, onRemove, remotes, onOpenRemote, onAddToCurrent,
}: LibraryPanelProps) {
  const screen = nav.screen;
  const crumbs = libraryTrailFor(screen, {
    deviceInLibrary: (id) => {
      const definition = definitionIn(state, id);
      // The same name the tile in the grid carried, which is what `headingIn` is for: a crumb that renamed
      // the thing you had just pressed would be worse than no crumb.
      return definition === undefined ? undefined : headingIn(definition, state).title;
    },
  }).map((crumb) => ({
    label: crumb.label,
    ...(crumb.to === undefined ? {} : { onClick: () => nav.go(crumb.to!) }),
  }));

  return (
    <Modal
      opened={nav.open}
      onClose={() => nav.close()}
      // The panel draws its own bar, in the same shape as the application's, so Mantine's title and close
      // button are off: two closes and two titles is what asking for both would give.
      withCloseButton={false}
      centered
      // **It does not animate**, and the reason is what this panel is: not a dialogue interrupting your
      // work but a place you go to look something up, opened often and closed again in seconds. A sheet
      // that fades and scales in every time reads as an event, and glancing at your own devices is not one.
      //
      // What made anybody look at it was a test. A window that is never shown never composites, so
      // `requestAnimationFrame` never fires and an entry transition never completes: the panel stayed in
      // its entering state, and a press on a tile inside it went nowhere while the same press on the bar
      // worked. Measured rather than guessed, by setting this to zero and watching the form appear.
      transitionProps={{ duration: 0 }}
      size="min(64rem, 92vw)"
      padding={0}
      classNames={{ content: classes.sheet, body: classes.body }}
    >
      <Header
        className={classes.bar}
        crumbs={crumbs}
        right={(
          <Tooltip label="Close" withArrow openDelay={400}>
            <button
              type="button"
              className={classes.close}
              onClick={() => nav.close()}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" />
              </svg>
            </button>
          </Tooltip>
        )}
      />

      {/*
        `data-autofocus` on the page rather than on a button, and it is a fix rather than a flourish.
        Mantine's focus trap gives the keyboard to the first thing it can find when a modal opens, which
        was the close button, so the panel came up with a ring around its own X. A ring nobody asked for
        reads as a warning about the thing it is drawn on, and the thing it was drawn on was "close".

        The trap still has to hold something, or Escape and Tab leave the panel altogether, so it holds
        the page: not tabbable, so nobody lands here on the way through, and focused on arrival so the
        first Tab goes to the first control on whichever page is showing.
      */}
      <div className={classes.page} data-autofocus tabIndex={-1}>
        {screen.at === 'list' && (
          <LibraryListView
            state={state}
            onOpen={(id) => nav.go({ at: 'device', id })}
            onAdd={() => nav.go({ at: 'add' })}
          />
        )}

        {screen.at === 'add' && (
          <AddDeviceView
            busy={state.status === 'loading'}
            onAdd={async (draft) => {
              const made = await onCreate(draft);
              // Onto the new one's page rather than back to the list, because writing something down and
              // then having to find it in a grid is the wrong end of the interaction. Nothing to say about
              // the route any more: the trail from a device is the list, whatever you came through, which
              // is what removing the history bought.
              nav.go({ at: 'device', id: made.id });
            }}
          />
        )}

        {screen.at === 'device' && (
          <LibraryDeviceView
            definition={definitionIn(state, screen.id)}
            heading={(() => {
              const definition = definitionIn(state, screen.id);
              return definition === undefined ? undefined : headingIn(definition, state);
            })()}
            usedBy={state.status === 'ready'
              ? state.usage.filter((one) => one.definition === screen.id)
              : []}
            remotes={remotes}
            current={nav.from}
            busy={state.status === 'loading'}
            onSave={onSave}
            // Both, and that is a correction: this passed the identifier where the name was expected, so
            // every copy was made under a name that was a digest. The window test caught it, which is the
            // one place it could be caught, since both arguments are strings.
            onClone={async (name) => {
              const made = await onClone(screen.id, name);
              nav.go({ at: 'device', id: made.id });
            }}
            onRemove={() => onRemove(screen.id)}
            onOpenRemote={onOpenRemote}
            onAddToCurrent={() => onAddToCurrent(screen.id)}
          />
        )}
      </div>
    </Modal>
  );
}

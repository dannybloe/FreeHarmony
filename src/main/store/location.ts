/**
 * Where the store lives, which is the only thing about it that needs Electron.
 *
 * Kept apart from the store itself so that the store can be tested without an application. This
 * file imports `electron` and holds no behaviour; that file holds all of the behaviour and imports
 * nothing but Node.
 */
import { join } from 'node:path';

import { app } from 'electron';

/**
 * The user's own documents, in a folder with this application's name on it.
 *
 * **Not the operating system's application data directory**, which is where this started and where
 * most applications keep their state. The reason for moving it is what these files are: a remote's
 * entry is somebody's own equipment and, once backups exist, the only remaining copy of a device
 * that cannot be bought again. That belongs somewhere a person can find it, copy it and back it up
 * without being told where to look, which application data is deliberately not.
 *
 * The consequence to know about: on macOS the documents folder is commonly synced to iCloud, and on
 * Windows to OneDrive. So this data may leave the machine, by the user's own arrangement rather than
 * by anything here. That is a reasonable thing for a backup to do and it is worth being aware of,
 * since the application otherwise touches no network at all.
 */
export function storeRoot(): string {
  return join(base(), 'remotes');
}

/**
 * Where the device library lives: beside the remotes, not inside one.
 *
 * That placement **is** the decision of 21 August 2026 expressed on disk. A television belongs to three
 * remotes, so it cannot sit in the folder of one of them, and a person looking at their own documents
 * should be able to see that arrangement without being told it.
 */
export function libraryRoot(): string {
  return join(base(), 'devices');
}

/** The one folder both of them sit in, so the override moves both together or neither. */
function base(): string {
  return elsewhere() ?? join(app.getPath('documents'), 'FreeHarmony');
}

/**
 * Where both of them go instead, if something has said so.
 *
 * This exists for one caller: the end to end test in `test/app`, which drives the built application
 * over the developer tools protocol and has to create and delete entries to prove the bridge reaches
 * the real store. Doing that in somebody's own documents folder would be an unacceptable price for a
 * test, and pointing the application at a temporary directory is the whole of the fix.
 *
 * It is read here rather than passed to `RemoteStore`, because the store already takes its root as an
 * argument and the question this answers is where the **application** puts it. So the seam sits in the
 * one file that decides that, and the store stays unaware that an override exists at all.
 */
function elsewhere(): string | undefined {
  const named = process.env['FREEHARMONY_STORE'];
  return named === undefined || named === '' ? undefined : named;
}

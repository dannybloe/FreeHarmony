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
  return join(app.getPath('documents'), 'FreeHarmony', 'remotes');
}

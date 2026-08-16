/**
 * Where the store lives, which is the only thing about it that needs Electron.
 *
 * Kept apart from the store itself so that the store can be tested without an application. This
 * file is two lines and imports `electron`; that file is the whole of the behaviour and imports
 * nothing but Node.
 */
import { join } from 'node:path';

import { app } from 'electron';

/**
 * The operating system's own place for this application's data, plus one directory.
 *
 * `userData` is per platform and Electron resolves it: `~/Library/Application Support/FreeHarmony`
 * on macOS, `%APPDATA%` on Windows, `~/.config` on Linux. It is deliberately not next to the
 * application, because these files outlive any particular build and, once backups live here, they
 * are the only copy of something that cannot be bought again.
 */
export function storeRoot(): string {
  return join(app.getPath('userData'), 'remotes');
}

/**
 * Reading a configuration out of a file instead of off a remote, so that the import dialogue can be
 * looked at without anybody's hardware.
 *
 * **This is a seam in production code and it exists for one reason: a screen nobody can look at is a
 * screen that gets designed by guessing.** The import summary can otherwise only be reached with an
 * irreplaceable remote plugged in, so it would be built, shipped and first seen by a user. That was
 * decided on 22 August 2026, against waiting for hardware and against building the screen a second time
 * in a page of its own, which would be two implementations of one thing.
 *
 * Four things keep it from being a way to fake hardware:
 *
 *   - **it is off unless an environment variable names a file**, the same shape as `FREEHARMONY_STORE`,
 *     which already exists so the end to end tests do not write into somebody's documents
 *   - **only the half that writes nothing may use it.** `importInto` refuses a pretended reading
 *     outright, so nothing can be filed as having been read off a device when it was not. That refusal
 *     is the whole reason this returns a flag rather than just bytes
 *   - **it says so on stderr, every time**, because the one genuinely bad outcome would be somebody
 *     believing a number came off their remote when it came off a file
 *   - **the bytes are real.** It reads a configuration, so the dialogue shows what one actually holds
 *     rather than figures written into a fixture, which is what makes looking at it worth anything
 *
 * The page cannot do this to itself: `contextBridge` freezes the API deeply and `window.freeharmony` is
 * neither writable nor configurable, measured on 22 August 2026 when a page side stub silently did
 * nothing. So this is the only route, and it is in the process that owns the rails.
 */
import { readFile } from 'node:fs/promises';

/** What the variable holds: a skin so the remote can be named, and the file to read instead of it. */
interface Pretence {
  readonly skin?: number;
  readonly file: string;
}

const VARIABLE = 'FREEHARMONY_PRETEND_REMOTE';

/**
 * The pretence in force, or `undefined` because there is none, which is every ordinary run.
 *
 * A malformed value is an error rather than a silent absence. Somebody who set the variable meant to set
 * it, and quietly ignoring it would send them looking for the remote they thought they had faked.
 */
export function pretence(): Pretence | undefined {
  const named = process.env[VARIABLE];
  if (named === undefined || named === '') return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(named);
  } catch {
    throw new Error(`${VARIABLE} is not JSON; it wants {"skin":71,"file":"/path/to/configuration.bin"}`);
  }
  const one = parsed as Partial<Pretence>;
  if (typeof one.file !== 'string' || one.file === '') {
    throw new Error(`${VARIABLE} has no file in it; it wants {"skin":71,"file":"..."}`);
  }
  return { file: one.file, ...(typeof one.skin === 'number' ? { skin: one.skin } : {}) };
}

/** The bytes, announced the first time so nobody can mistake where they came from. */
export async function pretendedBytes(of: Pretence): Promise<Uint8Array> {
  announce(`reading ${of.file} instead of opening a remote`);
  return readFile(of.file);
}

/**
 * Said once and not once a second.
 *
 * Enumeration is polled while a page is open, so announcing there would bury everything else in the log
 * and teach whoever is reading it to skip the line. The variable is set by whoever ran the command, so
 * the thing worth saying is that it is in force, not how many times it was consulted.
 */
let said = false;

function announce(what: string): void {
  if (said) return;
  said = true;
  process.stderr.write(`${VARIABLE} is set: ${what}. Nothing may be imported from it.\n`);
}

/** What enumeration answers under a pretence: one remote, of whatever the skin names. */
export function pretendedEnumeration(of: Pretence): { skin?: number } {
  announce('reporting one attached remote that is not there');
  return of.skin === undefined ? {} : { skin: of.skin };
}

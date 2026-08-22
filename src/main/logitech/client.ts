/**
 * A session with Logitech's service: sign in, look a device up, fetch its named commands.
 *
 * **Three reads and nothing else, by construction.** The operation names are a closed list in this file
 * and the request builder takes one of them, so there is no route from here to a call that changes
 * anything. That matters more than it sounds: the operation that queues a compilation of somebody's remote
 * sits one name away from these, and Logitech's own naming cannot be trusted to say which is which. Their
 * `CompileManager/CommandList` reads like a list of commands and **is** a compile, which was found by
 * sending it.
 *
 * **The password is used and never kept, never logged and never returned.** It goes into one request body
 * and is not held on the session afterwards, so nothing that inspects a live session can find it. The
 * failure messages below are Logitech's own text with anything identifying stripped, because a message that
 * quotes what was sent is a message that ends up in a log.
 *
 * **No dependency.** `fetch` is in Electron, and the session is a cookie: signing in sets one and every
 * call after it carries it. That is the whole of the authentication, which is why there is no token
 * handling here and nothing to refresh.
 */
import { CATEGORY_OF_DEVICE_TYPE, DEVICES, SEARCH_EXACT, SECURITY, ANY_DEVICE_TYPE, statedCode }
  from './protocol.ts';

/** What a search turns up: enough to show a person a list and to ask for one of them. */
export interface CatalogueDevice {
  readonly manufacturer: string;
  readonly model: string;
  /** Our own category, translated from Logitech's sixty, or `other`. */
  readonly kind: string;
  /**
   * The handle the command fetch needs.
   *
   * It is a **language version** rather than a device: Logitech keeps one set of commands per device per
   * language, and this is the identifier of that set. Opaque to us and passed back unchanged.
   */
  readonly commandsId: number;
}

/** One command as Logitech states it: a word, and a code we can compare but not send. */
export interface CatalogueCommand {
  readonly name: string;
  readonly protocol?: string;
  readonly bits?: number;
  readonly frame?: string;
}

/**
 * Signed in, and able to answer two questions.
 *
 * Deliberately not a class with a stored credential. It closes over the cookie and nothing else, so the
 * only way to make one is to have signed in, and there is nothing on it to leak.
 */
export interface Session {
  search(manufacturer: string, model: string): Promise<CatalogueDevice[]>;
  commandsFor(commandsId: number): Promise<CatalogueCommand[]>;
}

/** The three operations. A closed list, because it is also the safety rail. */
type Operation = 'LoginUser' | 'SearchGlobalDevices' | 'GetGlobalLanguageCommands';

const BASE: Readonly<Record<Operation, string>> = {
  LoginUser: SECURITY,
  SearchGlobalDevices: DEVICES,
  GetGlobalLanguageCommands: DEVICES,
};

/** How long a single call may take. Their search is slow; their login is not. */
const TIMEOUT_MS = 30_000;

/**
 * Sign in, and hand back something that can ask the two questions.
 *
 * **What a failure says is deliberately short.** "Logitech did not accept that email and password" and
 * nothing else: their own reply carries an account identifier and a message that sometimes quotes the
 * address, and both would end up wherever this error is shown or written down. A person who has just typed
 * a password wrong does not need more, and a person debugging this needs the network rather than the text.
 */
export async function signIn(email: string, password: string): Promise<Session> {
  const cookie = new CookieJar();
  const answer = await post(cookie, 'LoginUser', {
    email,
    password,
    customCredential: null,
    // Their own client sends this false, and it is the honest value: this application signs in when it is
    // asked to and does not keep a session across restarts.
    isPersistent: false,
  });

  const result = answer?.['LoginUserResult'];
  if (!isRecord(result)) throw new Error('Logitech did not accept that email and password');
  if (result['IsLockedOut'] === true) {
    throw new Error('Logitech has locked that account out. Signing in on their own site clears it.');
  }

  return {
    search: (manufacturer, model) => search(cookie, manufacturer, model),
    commandsFor: (commandsId) => commandsFor(cookie, commandsId),
  };
}

async function search(
  cookie: CookieJar, manufacturer: string, model: string,
): Promise<CatalogueDevice[]> {
  const answer = await post(cookie, 'SearchGlobalDevices', {
    // The field names are Logitech's and the spelling of the first one is the trap `protocol.ts` records.
    manufacturer,
    modelNumber: model,
    deviceType: ANY_DEVICE_TYPE,
    searchType: SEARCH_EXACT,
    // Enough that a real model with regional variants is not cut off, few enough that a mistyped model
    // does not return a page of noise. A person picks from this list.
    maxResults: 25,
  });

  const result = answer?.['SearchGlobalDevicesResult'];
  const matches = isRecord(result) ? result['Matches'] : undefined;
  if (!Array.isArray(matches)) return [];

  const found: CatalogueDevice[] = [];
  for (const match of matches) {
    if (!isRecord(match)) continue;
    // The identifier is nested in a wrapper of theirs carrying the same number twice, `Value` and
    // `VersionId`. Either would do; a match with neither is dropped rather than guessed at, because the
    // command fetch is the only thing this row is for.
    const version = match['GlobalLanguageVersionId'];
    const id = isRecord(version) ? version['Value'] ?? version['VersionId'] : undefined;
    if (typeof id !== 'number') continue;
    const type = match['DeviceType'];
    found.push({
      manufacturer: asText(match['Manufacturer']),
      model: asText(match['DeviceModel']),
      kind: (typeof type === 'number' ? CATEGORY_OF_DEVICE_TYPE[type] : undefined) ?? 'other',
      commandsId: id,
    });
  }
  return found;
}

async function commandsFor(cookie: CookieJar, commandsId: number): Promise<CatalogueCommand[]> {
  const answer = await post(cookie, 'GetGlobalLanguageCommands', {
    // Wrapped exactly as their client wraps it. A bare number is silently ignored, which is the same
    // failure mode as the misspelled field: `200` and an empty list.
    globalLanguageVersionId: { IsPersisted: true, Value: commandsId, VersionId: commandsId },
  });

  const result = answer?.['GetGlobalLanguageCommandsResult'];
  if (!Array.isArray(result)) return [];

  const found: CatalogueCommand[] = [];
  for (const command of result) {
    if (!isRecord(command)) continue;
    // **`Name` and not `CommandTypeId`**, which is the field that reads like an identifier and is not
    // usable as one: it is the literal string "Unknown" on every command Logitech has no standard slot
    // for, which on one television was "Digital/Analog", "Discover" and "Football". Their `Name` is
    // always populated and is the word their own software shows.
    const name = asText(command['Name']);
    if (name === '') continue;
    const code = statedCode(command['KeyCode'] as string | null | undefined);
    found.push({ name, ...(code === undefined ? {} : code) });
  }
  return found;
}

/**
 * One request, to one of three named operations.
 *
 * The body is JSON and so is the answer, except when it is not: a refusal comes back as JSON too, with an
 * `ErrorCode` and a `Message`, so a non-2xx status is read rather than thrown away. What is **not** passed
 * on is their message: an authorisation failure names the operation and carries a request identifier, and
 * anything else is Logitech's own wording about somebody's account.
 */
async function post(
  cookie: CookieJar, operation: Operation, body: unknown,
): Promise<Record<string, unknown> | undefined> {
  const abort = AbortSignal.timeout(TIMEOUT_MS);
  let answer: Response;
  try {
    answer = await fetch(BASE[operation] + operation, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...cookie.header(),
      },
      body: JSON.stringify(body),
      signal: abort,
    });
  } catch {
    // Their service being unreachable and this machine being offline are the same thing from here, and the
    // sentence has to be true of both. The underlying message is not passed on: it is a Node error naming
    // a host and a system call, which is noise on a screen.
    throw new Error('Logitech\'s service could not be reached');
  }

  cookie.take(answer);
  const text = await answer.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }

  if (!answer.ok) {
    if (operation === 'LoginUser') throw new Error('Logitech did not accept that email and password');
    // Everything above the login refuses the same way when the session is not good enough for it, which
    // is what this sentence has to cover: it is the one a person can act on.
    throw new Error('Logitech refused that request. Signing in again may fix it.');
  }
  return isRecord(parsed) ? parsed : undefined;
}

/**
 * The session cookie, kept in memory for as long as the session object lives.
 *
 * Written out rather than reached for from a library, because it is four lines and because the alternative
 * is `fetch` following the platform's own cookie store: in Electron that is shared with whatever else the
 * process has loaded, and a credentialed session for a third party service has no business being visible
 * outside the object that made it.
 *
 * **Nothing here is written to disk.** Signing in again is one request, so a session that is lost costs
 * nothing, and a stored session is a stored credential with none of the protection one gets.
 */
class CookieJar {
  #jar = new Map<string, string>();

  take(answer: Response): void {
    for (const line of answer.headers.getSetCookie()) {
      const pair = line.split(';', 1)[0] ?? '';
      const at = pair.indexOf('=');
      if (at > 0) this.#jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
    }
  }

  header(): Record<string, string> {
    if (this.#jar.size === 0) return {};
    return { Cookie: [...this.#jar].map(([name, value]) => `${name}=${value}`).join('; ') };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The four things a window can ask about Logitech's service, and the one place a password is decrypted.
 *
 * **The password never crosses the bridge in either direction except once, inwards.** Somebody types it
 * into a field, it goes to `remember`, and after that no method here takes one or returns one: signing in
 * reads it out of the encrypted file, uses it in one request, and lets it go. `accountState` is what a
 * screen is told, and it is an address and a yes or no.
 *
 * **A session is kept in memory and never on disk.** Signing in is one request, so a lost session costs
 * nothing, where a stored one would be a second credential with none of the first one's protection. It is
 * dropped whenever the stored account changes, because a session belonging to an address nobody has any
 * more is worse than none: it would keep working and quietly answer for the wrong account.
 *
 * **Every call here is a read of Logitech's catalogue.** Nothing signs a remote up, queues a compilation,
 * or writes to an account. `client.ts` enforces that with a closed list of three operations, and this file
 * has no way past it.
 */
import type { AccountState, Settings } from './preferences.ts';
import type { CatalogueDevice, Session } from './logitech/client.ts';
import { signIn } from './logitech/client.ts';
import { asDefinition } from './logitech/convert.ts';
import { matchNames, type Matched } from './logitech/match.ts';
import type { DeviceDefinition } from '../shared/library.ts';
import type { DeviceLibrary } from './store/library.ts';

/**
 * The signed in session, if there is one.
 *
 * Module level rather than passed around, because it is genuinely process wide state: one machine, one
 * person, one account. The alternative is threading it through every handler, which would put a live
 * credentialed session in more places than the one that needs it.
 */
let live: Session | undefined;

/** Whose session it is, so that a changed account cannot keep using the old one. */
let liveFor: string | undefined;

export async function accountState(settings: Settings): Promise<AccountState> {
  return settings.accountState();
}

export async function rememberAccount(
  settings: Settings, email: string, password: string,
): Promise<AccountState> {
  await settings.rememberAccount(email, password);
  forgetSession();
  return settings.accountState();
}

export async function forgetAccount(settings: Settings): Promise<AccountState> {
  await settings.forgetAccount();
  forgetSession();
  return settings.accountState();
}

/**
 * Sign in and throw away the session, which is the only way to find out whether a password still works.
 *
 * **Why there is a button for this at all**: a password that expired, or was changed on Logitech's own
 * site, looks exactly like a password that works until something needs it. So the state a screen can show
 * is "an address and a stored password" and not "signed in", and this is how somebody turns the first into
 * the second on purpose rather than at the moment they wanted a device.
 *
 * It reuses nothing: a cached session would make this answer yes without asking Logitech anything.
 */
export async function checkAccount(settings: Settings): Promise<void> {
  forgetSession();
  await session(settings);
}

/** Look a device up. The list a person picks from, and nothing is written by asking. */
export async function searchCatalogue(
  settings: Settings, manufacturer: string, model: string,
): Promise<CatalogueDevice[]> {
  return retrying(settings, (open) => open.search(manufacturer, model));
}

/**
 * Fetch one device's commands and file it in the library.
 *
 * **What lands is names attached to codes this application cannot send**, which is the whole shape of what
 * Logitech serves: a protocol family and a frame value per command, never the pulses. `convert.ts` says
 * why at length. It is filed anyway, because a list of Logitech's own words attached to Logitech's own
 * codes is exactly what turns the nameless codes on somebody's remote into something readable.
 */
export async function fetchDevice(
  settings: Settings, library: DeviceLibrary, device: CatalogueDevice, now: string,
): Promise<DeviceDefinition> {
  const commands = await retrying(settings, (open) => open.commandsFor(device.commandsId));
  return library.put(asDefinition(device, commands, now));
}

/**
 * Which of an appliance's codes Logitech has a word for, by comparing the codes.
 *
 * **Reports and does not write**, which is the shape the whole application uses for anything a machine
 * worked out: `likelyDuplicates` reports and never merges, and this reports and never names. Applying it is
 * `library.nameCommands`, from a window, after somebody has seen how many there are.
 */
export async function namesFromCatalogue(
  settings: Settings, library: DeviceLibrary, id: string, device: CatalogueDevice,
): Promise<Matched> {
  const held = await library.get(id);
  const commands = await retrying(settings, (open) => open.commandsFor(device.commandsId));
  return matchNames(held, commands);
}

/**
 * One call, signing in again if the session has gone stale, and only once.
 *
 * Their session is a cookie with a lifetime nobody here knows, so the first failure of an authorised call
 * is far more likely to be an expired session than a real refusal. Retrying **once** is the difference
 * between a person having to press a button and a loop that hammers somebody else's service.
 */
async function retrying<T>(settings: Settings, ask: (open: Session) => Promise<T>): Promise<T> {
  try {
    return await ask(await session(settings));
  } catch (error) {
    if (!looksLikeAStaleSession(error)) throw error;
    forgetSession();
    return ask(await session(settings));
  }
}

function looksLikeAStaleSession(error: unknown): boolean {
  // Matched on our own wording from `client.ts` rather than on Logitech's, which is the point of that file
  // rewriting their messages: this is a decision about our own error and not a parse of somebody else's.
  return error instanceof Error && error.message.startsWith('Logitech refused that request');
}

async function session(settings: Settings): Promise<Session> {
  const credential = await settings.credentialForSigningIn();
  if (credential === undefined) {
    throw new Error('No Logitech account is stored. Preferences is where that goes.');
  }
  if (live !== undefined && liveFor === credential.email) return live;
  live = await signIn(credential.email, credential.password);
  liveFor = credential.email;
  return live;
}

function forgetSession(): void {
  live = undefined;
  liveFor = undefined;
}

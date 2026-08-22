/**
 * What this application remembers about how somebody wants to use it, and where the one secret lives.
 *
 * **Two files, because they are two kinds of thing.** `preferences.json` is readable and meant to be:
 * an email address, indented, in a folder somebody can open. `logitech.credential` is ciphertext,
 * produced by Electron's `safeStorage`, which on macOS means the login keychain holds the key. Putting
 * both in one file would mean either encrypting a preference nobody needs hidden or writing a password
 * next to text a person is invited to read.
 *
 * **The password goes in and never comes out.** There is no reader for it in this module's public
 * surface: `signInToLogitech` in `logitech.ts` decrypts it, uses it in one request and drops it, and no
 * function here returns it, logs it, or puts it in an error. `storedFor` answers whether there **is**
 * one, which is what a screen needs to draw a state and all a screen may know.
 *
 * `safeStorage` can be unavailable, on a Linux session with no keyring in particular. That is reported
 * rather than worked around: writing the password in the clear because encryption was not offered is
 * exactly the sort of quiet downgrade that makes a promise worthless.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Everything remembered. One section today, and the shape says there will be more. */
export interface Preferences {
  readonly logitech?: {
    /** The address to sign in with. Readable on purpose: it is not a secret and a screen has to show it. */
    readonly email: string;
  };
}

/**
 * What a screen may know about the account: the address, and whether a password is stored.
 *
 * **Never the password and never a masked version of it either.** A row of dots with the right number of
 * dots in it is a fact about somebody's password, and this is the boundary a window is on the far side of.
 */
export interface AccountState {
  readonly email?: string;
  readonly hasPassword: boolean;
}

/**
 * The two files, given the folder they sit in.
 *
 * A class taking its root, like `RemoteStore` and `DeviceLibrary`, for the same reason: it makes every
 * test below able to run against a temporary directory with no application in the process.
 *
 * `crypto` is injected rather than imported, and that is what lets any of this be tested at all:
 * `safeStorage` needs a running Electron app, so the real one is handed in from `main` and a test hands
 * in something that reverses a string. The interface is deliberately the two methods `safeStorage`
 * actually has, so nothing here can drift away from what it is standing in for.
 */
export interface Cipher {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(cipher: Buffer): string;
}

export class Settings {
  readonly #root: string;
  readonly #cipher: Cipher;

  constructor(options: { root: string; cipher: Cipher }) {
    this.#root = options.root;
    this.#cipher = options.cipher;
  }

  async read(): Promise<Preferences> {
    const text = await this.#readText('preferences.json');
    if (text === undefined) return {};
    try {
      const parsed: unknown = JSON.parse(text);
      // A file somebody may have edited by hand, in a folder they were invited to look in. So a broken one
      // is an empty preference set rather than an application that will not start: nothing in here is
      // irreplaceable, unlike a remote's entry, which is why the store next door does the opposite.
      return typeof parsed === 'object' && parsed !== null ? (parsed as Preferences) : {};
    } catch {
      return {};
    }
  }

  /** What a screen may be told. Both halves, since "an address with no password" is a real state. */
  async accountState(): Promise<AccountState> {
    const held = await this.read();
    const email = held.logitech?.email;
    return {
      ...(email === undefined || email === '' ? {} : { email }),
      hasPassword: (await this.#readCredential()) !== undefined,
    };
  }

  /**
   * Remember an address, and a password unless one is already stored.
   *
   * **An empty password means "keep the one you have"**, which is what the field on the screen means when
   * somebody corrects a typo in their address and leaves the password alone. It is not a way to store an
   * empty password: with nothing stored already, it is refused, because the alternative is remembering an
   * address that can never be signed in with and a screen that says a password is stored when none is.
   *
   * Both belong together, which is why there is one method: a secret whose owner nobody recorded is a
   * secret nobody can use. Clearing is `forgetAccount`.
   */
  async rememberAccount(email: string, password: string): Promise<void> {
    const wanted = email.trim();
    if (wanted === '') throw new Error('An email address is needed');
    const keeping = password === '';
    if (keeping && (await this.#readCredential()) === undefined) {
      throw new Error('A password is needed');
    }
    if (!keeping && !this.#cipher.isEncryptionAvailable()) {
      throw new Error('This system offers no way to store a password safely, so it was not stored');
    }

    await mkdir(this.#root, { recursive: true });
    const held = await this.read();
    await writeFile(this.#path('preferences.json'),
                    `${JSON.stringify({ ...held, logitech: { email: wanted } }, undefined, 2)}\n`,
                    'utf8');
    if (!keeping) {
      await writeFile(this.#path('logitech.credential'), this.#cipher.encryptString(password));
    }
  }

  async forgetAccount(): Promise<void> {
    const held = await this.read();
    const { logitech: _gone, ...rest } = held;
    await mkdir(this.#root, { recursive: true });
    await writeFile(this.#path('preferences.json'), `${JSON.stringify(rest, undefined, 2)}\n`, 'utf8');
    await rm(this.#path('logitech.credential'), { force: true });
  }

  /**
   * The address and the password, for the one caller allowed to have them.
   *
   * **Deliberately awkward to reach**, and named so that its one use reads as what it is: it is called by
   * the sign in path in the main process and by nothing else, and there is no bridge method that returns
   * what it returns. Everything a window is allowed to know goes through `accountState`.
   */
  async credentialForSigningIn(): Promise<{ email: string; password: string } | undefined> {
    const held = await this.read();
    const email = held.logitech?.email;
    const password = await this.#readCredential();
    if (email === undefined || email === '' || password === undefined) return undefined;
    return { email, password };
  }

  async #readCredential(): Promise<string | undefined> {
    let raw: Buffer;
    try {
      raw = await readFile(this.#path('logitech.credential'));
    } catch {
      return undefined;
    }
    if (raw.length === 0) return undefined;
    try {
      return this.#cipher.decryptString(raw);
    } catch {
      // Ciphertext this machine can no longer read, which happens for a real reason: the key belongs to
      // this login on this computer, so a copied settings folder brings a file nobody can open. Reported as
      // "no password stored", which is what it amounts to, and the screen then offers to type one in.
      return undefined;
    }
  }

  async #readText(name: string): Promise<string | undefined> {
    try {
      return await readFile(this.#path(name), 'utf8');
    } catch {
      return undefined;
    }
  }

  #path(name: string): string {
    return join(this.#root, name);
  }
}

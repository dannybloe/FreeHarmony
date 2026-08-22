/**
 * Drives the built application over Chrome's developer tools protocol, with no new dependency.
 *
 * This exists because of what `test/viewmodel.test.ts` and `test/store.test.ts` cannot see. They
 * exercise both ends of the bridge separately, against a fake API on one side and a temporary
 * directory on the other, and they would both keep passing if the two ends were never connected: a
 * channel name that only matches on one side, a preload script that fails to load, a security setting
 * that stops the page reaching anything. Those failures are only visible in a running window.
 *
 * **No Playwright, and that is a deliberate omission rather than an oversight.** Playwright would do
 * this in fewer lines, and it would bring a browser download whose install script this workspace does
 * not approve, for a mechanism that is a websocket and three messages. The protocol is Chromium's own
 * and Electron speaks it with a single command line switch, so the driver below is the whole cost:
 * spawn the application, find its page, evaluate an expression in it.
 *
 * Everything it needs is already here. Electron is a dependency because the application is Electron,
 * and `WebSocket` has been part of Node since 22.
 *
 * The application is launched with its store pointed at a temporary directory. A test that creates and
 * deletes entries in somebody's real documents folder is not an acceptable test, and `storeRoot()` has
 * the seam for exactly this caller.
 *
 * **It lives under `test` and it has a second caller**, `bin/screenshot.ts`, which draws the window to
 * a PNG so that a change to the interface can be looked at rather than described. That is deliberate
 * rather than untidy: the driver exists for the tests, and a screenshot tool with its own copy of the
 * launching, the port parsing and the protocol plumbing would be the second copy this project's oldest
 * rule is about.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** How long each stage may take. Generous, because a first launch on a cold machine is slow. */
const PATIENCE = 30_000;

/**
 * The Electron binary, read the way the `electron` package's own entry point reads it.
 *
 * Not `import electron from 'electron'`, which does return this path when Node runs it, because the
 * package's types describe the Electron API instead and the import would not typecheck. A file with
 * one line in it is a smaller price than a cast that claims a namespace is a string.
 */
async function electronBinary(): Promise<string> {
  const named = await readFile(join(REPO, 'node_modules', 'electron', 'path.txt'), 'utf8');
  return join(REPO, 'node_modules', 'electron', 'dist', named.trim());
}

/**
 * How many times a wait inside the page tries before giving up, at 100 milliseconds each.
 *
 * One number for every such loop in this folder, exported so a test can bake it into the little script
 * it hands the page. It was written out as `tries < 40` in thirteen places, which is four seconds each,
 * and that is generous when the machine is idle and not generous at all when it is not: Node runs these
 * six files concurrently, so six Electron instances start, build nothing and race for the same cores.
 * One of these tests failed exactly once that way, in a full `pnpm check` and never on its own, which is
 * the signature.
 *
 * **Raising it costs nothing on a fast run**, because every one of those loops returns the moment it
 * finds what it is waiting for. What it buys is that a slow machine reports a slow machine rather than a
 * bug, which is the difference between a suite people trust and one people re-run.
 */
export const TRIES = 150;

export interface RunningApplication {
  /**
   * The folder the application was pointed at, so a test can look at what its requests did on disk.
   *
   * The **base**, holding both of the application's own folders. `remotes` and `devices` below are
   * where they actually are, and a test uses those rather than rebuilding the layout, because the
   * layout is `src/main/store/location.ts`'s decision and one copy of it is enough.
   */
  readonly store: string;
  readonly remotes: string;
  readonly devices: string;
  /** Evaluates an expression in the page, awaiting it if it is a promise. Throws what the page threw. */
  evaluate<T>(expression: string): Promise<T>;
  /**
   * Any other protocol command, for the cases where evaluating an expression is not enough.
   *
   * `Emulation.setEmulatedMedia` is the one that matters so far: it is how a test can ask the page to
   * believe the system prefers a dark colour scheme, which is a thing no expression can change and
   * the only honest way to check that forcing the light scheme actually holds.
   */
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  /**
   * Reloads the page and waits until it has drawn again.
   *
   * The reason a test needs this is emulation: something like a preferred colour scheme is read when
   * the page mounts, so telling a running page that the system has changed its mind proves nothing
   * about an application somebody starts on a machine that already prefers it. Reloading with the
   * emulation in place is the honest arrangement.
   */
  reload(): Promise<void>;
  close(): Promise<void>;
}

export interface LaunchOptions {
  /**
   * Put the window on the screen. Off by default, so a test run does not steal focus.
   *
   * `bin/screenshot.ts` turns it on, and has to: a window that is never shown is never composited, so
   * `Page.captureScreenshot` has nothing to photograph. Measured rather than assumed, since a hidden
   * window answers every other protocol command perfectly well.
   */
  readonly visible?: boolean;
  /** Where the store goes. A temporary directory by default, removed on `close`. */
  readonly store?: string;
  /**
   * A configuration file standing in for a remote on the bus, per `src/main/pretend.ts`.
   *
   * The value the seam's own environment variable takes. It is here because `test/app/import.test.ts` is
   * the only place either half of the import can be exercised at all: one opens a remote, and the other
   * is the rail that refuses a reading which came out of a file.
   */
  readonly pretendRemote?: string;
}

/** Launches the built application and waits until its page has finished loading. */
export async function launch(options: LaunchOptions = {}): Promise<RunningApplication> {
  const own = options.store === undefined;
  const store = options.store ?? await mkdtemp(join(tmpdir(), 'freeharmony-app-'));
  const child = spawn(await electronBinary(), ['.', '--remote-debugging-port=0'], {
    cwd: REPO,
    // Three things are added to the environment and nothing else about this run differs from what
    // somebody starting the application would get: where the store goes, whether a window appears, and
    // whether a file stands in for a remote. See `STAY_HIDDEN` in `src/main/index.ts` for why the second
    // is the nearest thing to headless here, and `src/main/pretend.ts` for what the third costs.
    env: {
      ...process.env,
      FREEHARMONY_STORE: store,
      ...(options.visible === true ? {} : { FREEHARMONY_HIDDEN: '1' }),
      ...(options.pretendRemote === undefined
        ? {} : { FREEHARMONY_PRETEND_REMOTE: options.pretendRemote }),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let said = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => { said += chunk; });
  child.stderr.on('data', (chunk: string) => { said += chunk; });

  try {
    // The port is announced rather than chosen, because a port picked here could be taken by the time
    // it is used. Everything the application said is carried into the failure, since the interesting
    // case is a build that will not start and the reason is in that output.
    const port = await until(() => /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(said)?.[1],
                             () => `no developer tools port appeared. The application said:\n${said}`);
    const socket = await connectToThePage(port, () => said);
    const application = talkTo(socket, store, child, own);
    await application.reload();
    return application;
  } catch (failure) {
    await stop(child);
    if (own) await rm(store, { recursive: true, force: true });
    throw failure;
  }
}

/** Polls until the answer is not `undefined`, then returns it. */
async function until<T>(attempt: () => T | undefined | Promise<T | undefined>,
                        complaint: () => string): Promise<T> {
  const deadline = Date.now() + PATIENCE;
  for (;;) {
    const answer = await attempt();
    if (answer !== undefined) return answer;
    if (Date.now() > deadline) throw new Error(complaint());
    await new Promise((wake) => setTimeout(wake, 50));
  }
}

/**
 * Finds the window's page among the application's targets and opens a socket to it.
 *
 * The page is identified by its own file, not by being the only target: an application with an open
 * inspector has several, and picking the first would work until the day one of them is not the page.
 */
async function connectToThePage(port: string, said: () => string): Promise<WebSocket> {
  interface Target { type: string; url: string; webSocketDebuggerUrl: string }
  const url = await until(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = (await response.json()) as Target[];
    return targets.find((t) => t.type === 'page' && t.url.endsWith('index.html'))?.webSocketDebuggerUrl;
  }, () => `the application never opened a page. It said:\n${said()}`);

  const socket = new WebSocket(url);
  await new Promise<void>((ready, refuse) => {
    socket.addEventListener('open', () => ready(), { once: true });
    socket.addEventListener('error', () => refuse(new Error(`could not attach to ${url}`)), { once: true });
  });
  return socket;
}

interface Answer {
  id: number;
  result?: {
    result?: { value?: unknown; description?: string };
    exceptionDetails?: { exception?: { description?: string }; text: string };
  };
  error?: { message: string };
}

/** Wraps an open socket as the small interface a test wants: evaluate, and close. */
function talkTo(socket: WebSocket, store: string, child: ChildProcess,
                storeIsOurs: boolean): RunningApplication {
  let nextId = 1;
  const waiting = new Map<number, (answer: Answer) => void>();
  socket.addEventListener('message', (event: MessageEvent) => {
    const answer = JSON.parse(String(event.data)) as Answer;
    waiting.get(answer.id)?.(answer);
    waiting.delete(answer.id);
  });

  /** One command and its reply, matched by id. A refusal by the protocol itself throws here. */
  async function ask(method: string, params: Record<string, unknown>): Promise<Answer> {
    const id = nextId++;
    const answer = await new Promise<Answer>((arrived) => {
      waiting.set(id, arrived);
      socket.send(JSON.stringify({ id, method, params }));
    });
    if (answer.error !== undefined) throw new Error(`the protocol refused: ${answer.error.message}`);
    return answer;
  }

  return {
    store,
    remotes: join(store, 'remotes'),
    devices: join(store, 'devices'),

    async evaluate<T>(expression: string): Promise<T> {
      // `awaitPromise` is what lets a test say `await api.list()` and get the list rather than a
      // promise handle, and `returnByValue` is what brings the value across as plain data.
      const answer = await ask('Runtime.evaluate',
                               { expression, awaitPromise: true, returnByValue: true });
      const thrown = answer.result?.exceptionDetails;
      // A page that throws has to fail the test rather than return `undefined`, which is what an
      // uninspected `result.value` would quietly do.
      if (thrown !== undefined) {
        throw new Error(`the page threw: ${thrown.exception?.description ?? thrown.text}`);
      }
      return answer.result?.result?.value as T;
    },

    async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
      return (await ask(method, params)).result;
    },

    async reload(): Promise<void> {
      // Waiting on `document.readyState` alone is not enough: it says the document is parsed, not that
      // React has mounted, and a test that reads a computed style needs the page to have drawn. The
      // shell element is the cheapest proof of both. On the first call there is nothing to reload yet,
      // which `Page.reload` handles by simply loading.
      await ask('Page.enable', {});
      await ask('Page.reload', {});
      await until(async () => (await this.evaluate<boolean>(
                    `document.readyState === 'complete' && !!document.querySelector('main')`))
                    ? true : undefined,
                  () => 'the page never finished loading');
    },

    async close(): Promise<void> {
      socket.close();
      await stop(child);
      if (storeIsOurs) await rm(store, { recursive: true, force: true });
    },
  };
}

/** Asks the application to stop, and insists if it does not. */
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise<void>((done) => child.once('exit', () => done()));
  child.kill('SIGTERM');
  const insist = setTimeout(() => child.kill('SIGKILL'), 5_000);
  await ended;
  clearTimeout(insist);
}

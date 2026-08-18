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

export interface RunningApplication {
  /** The store the application was pointed at, so a test can look at what its requests did on disk. */
  readonly store: string;
  /** Evaluates an expression in the page, awaiting it if it is a promise. Throws what the page threw. */
  evaluate<T>(expression: string): Promise<T>;
  close(): Promise<void>;
}

/** Launches the built application and waits until its page has finished loading. */
export async function launch(): Promise<RunningApplication> {
  const store = await mkdtemp(join(tmpdir(), 'freeharmony-app-'));
  const child = spawn(await electronBinary(), ['.', '--remote-debugging-port=0'], {
    cwd: REPO,
    // Two things are added to the environment and nothing else about this run differs from what
    // somebody starting the application would get: where the store goes, and that no window appears.
    // See `STAY_HIDDEN` in `src/main/index.ts` for why that is the nearest thing to headless here.
    env: { ...process.env, FREEHARMONY_STORE: store, FREEHARMONY_HIDDEN: '1' },
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
    const application = talkTo(socket, store, child);
    await until(async () => (await application.evaluate<string>('document.readyState')) === 'complete'
                              ? true : undefined,
                () => 'the page never finished loading');
    return application;
  } catch (failure) {
    await stop(child);
    await rm(store, { recursive: true, force: true });
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
function talkTo(socket: WebSocket, store: string, child: ChildProcess): RunningApplication {
  let nextId = 1;
  const waiting = new Map<number, (answer: Answer) => void>();
  socket.addEventListener('message', (event: MessageEvent) => {
    const answer = JSON.parse(String(event.data)) as Answer;
    waiting.get(answer.id)?.(answer);
    waiting.delete(answer.id);
  });

  return {
    store,

    async evaluate<T>(expression: string): Promise<T> {
      const id = nextId++;
      const answer = await new Promise<Answer>((arrived) => {
        waiting.set(id, arrived);
        socket.send(JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          // `awaitPromise` is what lets a test say `await api.list()` and get the list rather than a
          // promise handle, and `returnByValue` is what brings the value across as plain data.
          params: { expression, awaitPromise: true, returnByValue: true },
        }));
      });

      if (answer.error !== undefined) throw new Error(`the protocol refused: ${answer.error.message}`);
      const thrown = answer.result?.exceptionDetails;
      // A page that throws has to fail the test rather than return `undefined`, which is what an
      // uninspected `result.value` would quietly do.
      if (thrown !== undefined) {
        throw new Error(`the page threw: ${thrown.exception?.description ?? thrown.text}`);
      }
      return answer.result?.result?.value as T;
    },

    async close(): Promise<void> {
      socket.close();
      await stop(child);
      await rm(store, { recursive: true, force: true });
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

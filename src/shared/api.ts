/**
 * Everything the window may ask the main process to do, as one interface used by both sides.
 *
 * This file is the contract, and it is shared source rather than two declarations that agree today.
 * The main process implements it, the preload script exposes it, and the window consumes it, so a
 * method whose arguments change breaks the typecheck on every side at once. That is the whole point
 * of the seam: the alternative is a string channel name in two files and a runtime surprise.
 *
 * Everything crossing here is plain data. Structured cloning is what the channel does, so an object
 * with methods, a class instance or a parsed container cannot pass, and that constraint is a feature:
 * the configuration bytes stay in the main process because they cannot casually leave it.
 */
import type { RemoteDocument } from './remote.ts';

/** The name the API is published under on `window`. One constant, so no side spells it by hand. */
export const API_NAMESPACE = 'freeharmony';

export interface RemotesApi {
  /** Every remote this machine holds, most recently changed first. */
  list(): Promise<RemoteDocument[]>;
  /** A new entry with nothing behind it. It cannot be written to a device, see `isWritable`. */
  create(name: string): Promise<RemoteDocument>;
  rename(id: string, name: string): Promise<RemoteDocument>;
  /** A complete copy, base configuration included, under a new identity. */
  duplicate(id: string): Promise<RemoteDocument>;
  /** Removes the entry and everything under it, including its backups. */
  remove(id: string): Promise<void>;
}

export interface FreeHarmonyApi {
  readonly remotes: RemotesApi;
}

/**
 * The channel names, derived from the interface rather than written out, so that adding a method to
 * `RemotesApi` and forgetting to register it is a typecheck failure instead of a channel that
 * answers nothing.
 */
export const REMOTE_METHODS = ['list', 'create', 'rename', 'duplicate', 'remove'] as const;

export type RemoteMethod = (typeof REMOTE_METHODS)[number];

/** `remotes:list` and so on. One spelling, used by the handler side and the caller side. */
export function channelFor(method: RemoteMethod): string {
  return `remotes:${method}`;
}

/**
 * A type level assertion that `REMOTE_METHODS` names every method of `RemotesApi` and no others.
 *
 * Two lists that nobody compares will differ, which is the sibling repository's most repeated
 * failure. Here the comparison costs nothing and happens at compile time: the assignment below stops
 * typechecking the moment the interface and the array disagree in either direction.
 */
type Exhaustive = RemoteMethod extends keyof RemotesApi
  ? keyof RemotesApi extends RemoteMethod
    ? true
    : never
  : never;
export const METHODS_ARE_EXHAUSTIVE: Exhaustive = true;

/**
 * The view model for "what is plugged in", as a plain module.
 *
 * No React, no DOM, no timers. The absence of timers is the deliberate part: a view model that owns a
 * `setInterval` can only be tested by waiting, so this one exposes a single `poll()` and the hook next
 * door is what calls it on a clock. Every state the Connect screen can be in is then reachable in one
 * line here, including the three that are awkward to arrange with real hardware: nothing attached, two
 * remotes attached at once, and a remote whose model nothing in the tables names.
 */
import type { DevicesApi } from '../../../shared/api.ts';
import type { AttachedRemote } from '../../../shared/devices.ts';
import type { RemoteModel } from '../../../shared/remote.ts';

export interface DevicesState {
  /** Before the first answer. It is not an error to be looking, so this is not `loading`. */
  readonly status: 'looking' | 'answered' | 'failed';
  readonly attached: readonly AttachedRemote[];
  /** What went wrong asking, kept until the next answer. Rare: enumeration mostly cannot fail. */
  readonly error?: string;
}

export const NOTHING_YET: DevicesState = { status: 'looking', attached: [] };

/**
 * The remote to carry on with, or `undefined`, and the rule is stricter than "something is attached".
 *
 * Two conditions, and each rules out a case that would otherwise put a wrong document on somebody's
 * disk. **Exactly one** attached, because with two on the bus nothing here can tell which one the
 * person meant, and choosing for them would name the other one's model. And a **model we can name**,
 * because the point of arriving at the naming screen from here is that the model is already filled in;
 * a remote whose skin names nothing has to send somebody to the chooser instead, where they can say
 * what they are holding.
 */
export function theRecognisedOne(state: DevicesState): AttachedRemote | undefined {
  if (state.attached.length !== 1) return undefined;
  const only = state.attached[0];
  return only?.model === undefined ? undefined : only;
}

/**
 * A stable name for one remote arriving, so that "the same arrival" is a comparison and not a guess.
 *
 * Not an identity, and it must not be read as one: two identical remotes produce the same key, because
 * enumeration deliberately drops the serial number. That is fine for what it is used for, which is
 * noticing that nothing has changed since the last time we acted.
 */
export function arrivalKey(device: AttachedRemote): string {
  return `${device.productId}:${device.model?.name ?? ''}:${device.model?.skin ?? ''}`;
}

/** What the shell should do about the bus, and what it should remember afterwards. */
export interface Advance {
  /** The model to move on with. Absent means stay where you are. */
  readonly model?: RemoteModel;
  /** The arrival to consider dealt with from now on. `undefined` forgets, which is what re-arms it. */
  readonly remember: string | undefined;
}

/**
 * Whether a recognised remote should carry somebody on to the naming screen, and once only.
 *
 * **Once per arrival, not once per poll**, and the version without this advanced every second. That is
 * invisible in the happy path and obvious the moment somebody presses back: the naming screen returns to
 * Connect, the remote is still plugged in, the condition is still true, and back becomes a button that
 * does nothing. The remedy is a memory of what was already acted on, which is why this takes one.
 *
 * Forgetting when nothing is recognised is the other half, and it is what keeps unplugging and plugging
 * back in working. It also covers two remotes appearing, which is a change of situation and should not
 * leave a stale memory behind.
 *
 * It is here rather than in the shell because it is a decision, and a decision in a component is a
 * decision no test can walk. The shell's share is three lines with no branch in them.
 */
export function advanceOn(state: DevicesState, advancedFor: string | undefined): Advance {
  const only = theRecognisedOne(state);
  if (only?.model === undefined) return { remember: undefined };
  const key = arrivalKey(only);
  return key === advancedFor ? { remember: key } : { model: only.model, remember: key };
}

export class DevicesModel {
  #state: DevicesState = NOTHING_YET;
  readonly #api: DevicesApi;
  readonly #changed: (state: DevicesState) => void;

  constructor(api: DevicesApi, changed: (state: DevicesState) => void) {
    this.#api = api;
    this.#changed = changed;
  }

  get state(): DevicesState {
    return this.#state;
  }

  /**
   * One round of asking. Called repeatedly while the Connect screen is open.
   *
   * It does not emit when the answer has not changed, which is not an optimisation: this runs on a
   * timer, and a state object emitted every second would redraw the screen every second and make any
   * animation on it stutter. The comparison is on the serialised answer because everything crossing
   * the bridge is plain data by construction, so there is nothing in it that will not serialise.
   */
  async poll(): Promise<void> {
    try {
      const attached = await this.#api.attached();
      if (this.#state.status === 'answered' && same(this.#state.attached, attached)) return;
      this.#emit({ status: 'answered', attached });
    } catch (error) {
      this.#emit({
        status: 'failed',
        attached: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  #emit(state: DevicesState): void {
    this.#state = state;
    this.#changed(state);
  }
}

function same(before: readonly AttachedRemote[], after: readonly AttachedRemote[]): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

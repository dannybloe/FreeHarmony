/**
 * Importing a configuration off a remote, in two halves.
 *
 * **Reading a remote is an import and never a synchronisation**, decided on 22 August 2026. The way back
 * to a remote is always built from the document, so the two directions are not symmetrical and nothing
 * here should pretend they are. That is why the word on the button is "import" rather than "read": read
 * sounds like looking, and this replaces.
 *
 * The two halves exist because looking and committing are different acts with different costs. The first
 * opens an irreplaceable device, pulls a megabyte and a half off it, works out what is on it, and
 * **writes nothing**. The second writes. So somebody who only wants to know what is on their remote gets
 * the whole answer and leaves no trace, and somebody who wants to import sees exactly what they are
 * about to replace before they replace it.
 *
 * These types are the summary the window is shown. The bytes stay in the main process, per
 * `configuration.ts`: a configuration is up to 1.6 MB, only the library may interpret one, and the window
 * receives the model.
 */
import type { RemoteModel } from './remote.ts';

/**
 * What importing would do with one appliance found on the remote.
 *
 * The distinction that matters to a person is `linked` against `new`, and it is decided by the codes and
 * nothing else. Two descriptions are the same appliance when they send the same things, which is
 * checkable without knowing what either of them is, so an appliance already in the library is recognised
 * even though a configuration states no manufacturer, no model and no name for it.
 */
export interface AppliancePlan {
  /** The position on the remote, which is what every button and every activity refers to. */
  readonly slot: number;
  /** What its owner called it on the remote, which is usually a word like `TV`. */
  readonly label?: string;
  readonly commandCount: number;
  /** The library identifier it will point at, whether that is an existing entry or a new one. */
  readonly definition: string;
  /**
   * `linked` when the library already describes this appliance, so the import points at what is there
   * and leaves it alone; `new` when nothing here sends the same codes.
   */
  readonly disposition: 'linked' | 'new';
  /**
   * What the library already calls it, on a `linked` appliance.
   *
   * The reason a person cares about the distinction at all: their own name, manufacturer and model
   * survive the import, where the configuration would have offered none of the three.
   */
  readonly knownAs?: string;
}

/** What a document would lose, so a confirmation can say it in numbers rather than in a warning. */
export interface Replacing {
  readonly devices: number;
  readonly activities: number;
  readonly buttons: number;
  /**
   * Device names the document carries, whether they were typed here or came out of the configuration.
   *
   * **Not "names its owner typed", which is what this said and could not know.** A document imported
   * from a remote already has a name per appliance, because a configuration states one, so counting only
   * the typed ones would need a distinction the model does not draw. Counting all of them is the honest
   * version and it is the one that matters anyway: these are the words on the screen that will be
   * replaced by whatever the incoming configuration says.
   */
  readonly labels: number;
}

/**
 * What is on the attached remote, with nothing written down yet.
 *
 * `token` names the bytes the main process is holding. It is deliberately opaque and deliberately
 * perishable: let it go and the read is simply repeated, which costs a minute and does not touch
 * anything on the remote.
 */
export interface AttachedSummary {
  readonly token: string;
  /** What the remote says it is, which the document adopts on import. Absent when nothing names its skin. */
  readonly model?: RemoteModel;
  readonly skin?: number;
  readonly byteLength: number;
  readonly appliances: readonly AppliancePlan[];
  readonly activities: readonly { readonly slot: number; readonly name?: string }[];
  readonly buttonCount: number;
  /** The language the remote's own screens are in, inferred next door. Absent means genuinely unknown. */
  readonly language?: string;
  /** Absent when the document holds nothing yet, which is the ordinary first import. */
  readonly replacing?: Replacing;
}

/** What an import did, which the window states afterwards rather than implying it went well. */
export interface ImportOutcome {
  /** Appliances the document now points at that were already described here. */
  readonly linked: readonly string[];
  /** Appliances the library did not have, now added bare: codes, and not one word. */
  readonly created: readonly string[];
  /** Whether this replaced content somebody had built here. */
  readonly replaced: boolean;
  /**
   * Command references that had to move because the library's description orders its commands
   * differently.
   *
   * **Not a rare case, measured rather than guessed.** Of the twelve appliances that appear in more than
   * one configuration in the corpus next door, three are described with their commands in a different
   * order, and those are four configurations of one remote from Logitech's own generator. So importing a
   * second reading of a remote whose television the library already holds would silently repoint every
   * button on it. That is what `relink.ts` exists for and this is the count that says it happened.
   */
  readonly moved: number;
  /**
   * Command references that had no counterpart at all, which should be impossible on a linked appliance
   * and is counted rather than asserted.
   *
   * The one way it can arise: identity is decided by the set of codes with empty ones filtered out, so a
   * command that sends nothing is invisible to it. No configuration in the corpus has one, 0 of 3925
   * commands across fourteen containers, which is why this is a number and not a refusal. If it ever
   * moves, the affected references were left pointing where they were, which is wrong in a way somebody
   * can find rather than wrong in a way that looks fine.
   */
  readonly unmatched: number;
}

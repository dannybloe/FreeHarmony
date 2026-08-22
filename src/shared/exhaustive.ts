/**
 * A compile time proof that a list and a union name the same things.
 *
 * Its own file because two places need it and this project's oldest rule is that a derivation has one
 * copy. It was written inside `navigation.model.ts` on 21 August 2026 for `REMOTE_SCREENS`, and the day a
 * second list wanted the same guarantee was the day it had to move.
 *
 * The value of it over a test is that it fails in **both** directions and it fails at build time. A list
 * that has grown a member the union does not have is a screen or a tile nothing can reach; a union that
 * has grown a member the list does not have is worse, because the code compiles and the new case is
 * silently never offered. That second one is the failure this catches and no test written today would:
 * nobody adds a case to a union and then remembers to widen a count in a test file.
 */
export type Exhaustive<Listed extends string, Union extends string> = [Listed] extends [Union]
  ? [Union] extends [Listed]
    ? true
    : never
  : never;

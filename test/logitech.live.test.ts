/**
 * One real conversation with Logitech's service, behind a flag, skipped when there are no credentials.
 *
 * **Why a live test exists at all**, when everything in `logitech.test.ts` runs offline: a client nobody
 * has ever run against the real thing is a client nobody knows works. The reply shapes the other file
 * asserts against were copied from real answers, and this is what keeps them honest, because the one thing
 * a fixture cannot notice is the service changing.
 *
 * **How it is kept safe.** The credentials come from the environment and never from a file in this
 * repository, so a checkout cannot talk to anybody's account by accident. Nothing here prints an address, a
 * password, a cookie or a body. And it is three reads: signing in, one search, one command fetch. The
 * operation that queues a compilation of somebody's remote is not reachable from `client.ts` at all, which
 * is the point of that file's closed list.
 *
 * Run it with:
 *
 *   FREEHARMONY_LOGITECH_EMAIL=... FREEHARMONY_LOGITECH_PASSWORD=... pnpm test:unit
 *
 * The device it asks for is a Logitech catalogue entry picked to make this measurement, so naming it
 * breaks nothing: the rule about not naming equipment is about somebody's own inventory.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signIn } from '../src/main/logitech/client.ts';
import { matchNames } from '../src/main/logitech/match.ts';

const EMAIL = process.env['FREEHARMONY_LOGITECH_EMAIL'] ?? '';
const PASSWORD = process.env['FREEHARMONY_LOGITECH_PASSWORD'] ?? '';

/**
 * Skipped rather than failed with no credentials, and that is the right way round.
 *
 * The suite has to pass on a fresh clone on a machine with no account and, just as importantly, on one
 * with no network at all. A test that failed there would be a test everybody learns to ignore.
 */
const HAVE = EMAIL !== '' && PASSWORD !== '';
const SKIP = { skip: HAVE ? false : 'no Logitech credentials in the environment' };

test('the service answers, and a device\'s commands come back as names and codes', SKIP, async () => {
  const session = await signIn(EMAIL, PASSWORD);

  // An exact match, which is what the client asks for: their fuzzy ladder returns a different appliance
  // and there would be no way to tell which.
  const found = await session.search('Panasonic', 'TX-40DX600B');
  assert.equal(found.length, 1, 'exactly one device is that make and model');
  const only = found[0]!;
  assert.equal(only.manufacturer, 'Panasonic');
  assert.equal(only.model, 'TX-40DX600B');
  assert.equal(only.kind, 'television', 'and their category translated into one of ours');

  const commands = await session.commandsFor(only.commandsId);
  // Exact, not a floor. Their catalogue could change, and a floor would absorb that silently where this
  // says which figure moved. 58 as measured on 22 August 2026.
  assert.equal(commands.length, 58);
  const stated = commands.filter((one) => one.frame !== undefined);
  assert.equal(stated.length, 58, 'every one of them states a code');

  // **The shape that decides what the product can do with this.** A protocol family and a frame value, and
  // no pulses anywhere, so a definition from here cannot send anything. That is not a defect of this
  // client: `Raw` was null on all 419 commands fetched across six devices when the service was surveyed.
  const digit = commands.find((one) => one.name === '5');
  assert.ok(digit !== undefined, 'the digits are named as digits');
  assert.equal(digit.protocol, 'PanasonicV2 48 Bit');
  assert.equal(digit.bits, 48);
  assert.equal(digit.frame, '400401002829');
});

test('a name matches a code decoded out of a real configuration', SKIP, async () => {
  // **The measurement the whole route rests on, made against the live service.** The frame below was
  // decoded out of the configuration on the bench Harmony 600 by this repository's own reader, and it is
  // byte for byte a code Logitech states for a **different model** of the same family. So Logitech's value
  // is in the same order our decoder produces, and a name can be carried across by comparing numbers.
  //
  // The value is a fact about a protocol family rather than about anybody's equipment inventory.
  const session = await signIn(EMAIL, PASSWORD);
  const found = await session.search('Panasonic', 'TX-40DX600B');
  const commands = await session.commandsFor(found[0]!.commandsId);

  const matched = matchNames({
    id: 'appliance-under-test',
    kind: 'television',
    commands: [{ slot: 41, signal: { bits: 48, frame: '400401002829' },
                 origin: 'from-a-configuration' }],
    properties: [],
    timing: {},
    origin: 'from-a-configuration',
    addedAt: '2026-08-22T12:00:00.000Z',
  }, commands);

  assert.deepEqual(matched.names, [{ slot: 41, name: '5' }]);
});

test('a model their database has never heard of is an empty list, not an error', SKIP, async () => {
  // Which is the answer a person sees when they mistype, and it has to be distinguishable from a failure.
  // It is also the shape that once hid a misspelled field name for six searches: `200` with no matches.
  const session = await signIn(EMAIL, PASSWORD);
  assert.deepEqual(await session.search('Nope', 'ZZZZ-does-not-exist'), []);
});

test('a wrong password is refused with a sentence and nothing about the account', SKIP, async () => {
  // The message is ours rather than Logitech's, deliberately: theirs carries a request identifier and
  // sometimes the address, and this error ends up on a screen and possibly in a log.
  await assert.rejects(() => signIn(EMAIL, `${PASSWORD}-definitely-wrong`), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Logitech did not accept that email and password');
    assert.ok(!error.message.includes('@'), 'and it names nobody');
    return true;
  });
});

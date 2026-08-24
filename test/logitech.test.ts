/**
 * Logitech's service, as far as it can be tested without it: the shapes, the credential, and the matching.
 *
 * **Three things this file is careful about.** The reply shapes are copied from real answers, so a change
 * to a parser is checked against what the service actually sends rather than against what somebody thought
 * it sends. The credential store runs against a temporary directory and a stand-in cipher, since the real
 * one needs a running Electron application. And the matching is tested on frames rather than on words,
 * because that is the claim: a name lands where the code is the same code.
 *
 * The one live call is `test/logitech.live.test.ts`, which skips without credentials.
 *
 * The brands here are Logitech's own catalogue entries, picked to make a measurement, so quoting them
 * breaks nothing: the rule about not naming equipment is about somebody's own inventory.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LAB } from '@harmony/lab';

import type { DeviceDefinition } from '../src/shared/library.ts';
import { catalogueCode } from '../src/main/logitech/client.ts';
import { asDefinition } from '../src/main/logitech/convert.ts';
import { matchNames } from '../src/main/logitech/match.ts';
import { Settings, type Cipher } from '../src/main/preferences.ts';

/**
 * A cipher that reverses a string, which is exactly enough to test everything around it.
 *
 * **Not encryption and not pretending to be**: what is being tested is that the password goes through the
 * cipher and never through anything else, so the only property the stand-in needs is that its output is
 * not its input. The real one is Electron's `safeStorage` and needs a running application, which is why it
 * is injected rather than imported.
 */
function reversing(): Cipher & { available: boolean } {
  const it = {
    available: true,
    isEncryptionAvailable: () => it.available,
    encryptString: (plain: string) => Buffer.from([...plain].reverse().join(''), 'utf8'),
    decryptString: (cipher: Buffer) => [...cipher.toString('utf8')].reverse().join(''),
  };
  return it;
}

async function settings(): Promise<{ store: Settings; cipher: ReturnType<typeof reversing>;
                                     root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'freeharmony-settings-'));
  const cipher = reversing();
  return { store: new Settings({ root, cipher }), cipher, root };
}

test('a command\'s code is read out of the string Logitech states it in', () => {
  // `G:<family>:(<A>)(<B>)(<C>):3`, copied from real replies. The width comes from the family name,
  // because the value alone cannot say it: 0x910 is three characters and twelve bits.
  assert.deepEqual(catalogueCode('G:Sony 12 Bit:()(0x910)():3'),
                   { protocol: 'Sony 12 Bit', bits: 12, frames: ['910'], frame: '910' });
  assert.deepEqual(catalogueCode('G:PanasonicV2 48 Bit:()(0x40040D00808D)():3'),
                   { protocol: 'PanasonicV2 48 Bit', bits: 48,
                     frames: ['40040d00808d'], frame: '40040d00808d' });
  assert.equal(catalogueCode(null), undefined, 'a command with no code stated has none');
  assert.equal(catalogueCode('something else entirely'), undefined);
});

test('a code stating more than one frame keeps them all and offers no single frame', () => {
  // **The two shapes the reader here used to get wrong, and they failed differently.** Toshiba names its
  // second frame with a word instead of stating it, and the old regex demanded a value where the word is,
  // so it refused the family the most appliances in the catalogue use. Pioneer states two values, and the
  // old regex matched the second one alone and called it the command, which parses, looks right and sends
  // half of a command.
  // The absence is asserted before the shape, because `deepEqual` narrows its argument to the literal it
  // was compared against, and a later question about a field that literal does not carry stops compiling.
  const repeat = catalogueCode('G:Toshiba 32 Bit:(0x20DF10EF)(Repeat)():3');
  assert.equal(repeat?.frame, undefined, 'a word names a frame, so the command is not one frame');
  assert.deepEqual(repeat, { protocol: 'Toshiba 32 Bit', bits: 32,
                             frames: ['20df10ef'], words: ['Repeat'] });
  const two = catalogueCode('G:Pioneer 32 Bit 2:(0xC53A9966)(0xF50A5DA2)():3');
  assert.equal(two?.frame, undefined, 'two frames are not one frame');
  assert.deepEqual(two, { protocol: 'Pioneer 32 Bit 2', bits: 32,
                          frames: ['c53a9966', 'f50a5da2'] });
});

test('a family whose name states no width is refused, and the catalogue has none', () => {
  // The library's reader takes its widths from the family name and refuses a name without one, where the
  // reader this file used to import accepted it and left the width out. Neither behaviour costs anything
  // measurable: every one of the 33 families in the census states a width, so the refusal has no
  // population. It is asserted because it is a real difference between the two readers, and because a
  // family arriving without one would be a new shape rather than a command to store half of.
  assert.equal(catalogueCode('G:Nec1:()(0x20DF10EF)():3'), undefined);
});

/**
 * The whole recorded catalogue, which is the only check that can see a family being missed.
 *
 * The counts are the point. The reader this file used to import took 1221 of the 5219 commands and read
 * nothing at all on 60 of the 102 appliances, and every test in this file passed the whole time, because a
 * test written from one family's shape cannot see a family it does not mention.
 */
test('the recorded catalogue reads whole, and the one refusal is named', () => {
  const census = LAB === undefined
    ? undefined
    : join(LAB, 'work', 'myharmony', 'responses', 'ProtocolCensusWide.json');
  if (census === undefined || !existsSync(census)) return;
  const rows = JSON.parse(readFileSync(census, 'utf8')).rows as
    { family: string; keyCode: string }[];
  const distinct = new Map<string, string>();
  for (const row of rows) distinct.set(row.keyCode, row.family);
  const refused = new Set<string>();
  let read = 0;
  for (const [keyCode, family] of distinct) {
    if (catalogueCode(keyCode) === undefined) refused.add(family);
    else read += 1;
  }
  assert.equal(distinct.size, 2921, 'the distinct codes in the recorded census');
  assert.equal(read, 2852, 'read, against 1221 for the reader this file used to carry');
  // Named rather than counted, because which family is refused is the finding: its values are quaternary
  // digits, so reading them as hexadecimal overstates them threefold and the refusal is correct.
  assert.deepEqual([...refused], ['Galaxis 16 Bit Quad Toggle']);
});

test('a catalogue device becomes a definition with names and no signals at all', () => {
  // **The shape of what Logitech serves, and the limit that comes with it.** They state a protocol family
  // and a frame value per command and never the pulses: `Raw` was null on all 419 commands fetched across
  // six devices. So this definition cannot send anything, and that has to be visible in the data rather
  // than written in a comment: every signal here has a frame and no `once`.
  const made = asDefinition(
    { manufacturer: 'Sony', model: 'KDL-32W705B', kind: 'television', commandsId: 71913 },
    [{ name: 'ChannelUp', protocol: 'Sony 12 Bit', bits: 12, frame: '090' },
     { name: 'Football', protocol: 'Sony 15 Bit', bits: 15, frame: '3758' }],
    '2026-08-22T12:00:00.000Z');

  assert.equal(made.origin, 'from-logitech');
  assert.equal(made.manufacturer, 'Sony');
  assert.equal(made.model, 'KDL-32W705B');
  assert.equal(made.name, undefined, 'no name of its own, so the make and model are what a screen shows');
  assert.deepEqual(made.commands.map((one) => one.name), ['ChannelUp', 'Football']);
  assert.deepEqual(made.commands.map((one) => one.slot), [0, 1]);
  for (const command of made.commands) {
    assert.equal(command.signal.once, undefined, 'nothing here can be sent');
    assert.equal(command.signal.held, undefined);
    assert.ok(command.signal.frame !== undefined, 'and every one of them states a code');
  }
  // Their category translated into ours. Their enumeration has sixty values and ours nine, so the mapping
  // is lossy on purpose and in one direction only.
  assert.equal(made.kind, 'television');
  assert.equal(asDefinition({ manufacturer: 'x', model: 'y', kind: 'laserdisc', commandsId: 1 }, [], 'now')
    .kind, 'other', 'a category of theirs we have no answer for becomes other, not a broken one');
});

/** An appliance whose codes are frames, which is what a configuration gives after decoding. */
function appliance(codes: readonly (readonly [number, number, string])[]): DeviceDefinition {
  return {
    id: 'appliance-under-test',
    kind: 'television',
    commands: codes.map(([slot, bits, frame]) => ({
      slot, signal: { bits, frame }, origin: 'from-a-configuration' as const,
    })),
    properties: [],
    timing: {},
    origin: 'from-a-configuration',
    addedAt: '2026-08-22T12:00:00.000Z',
  };
}

test('a name lands where the code is the same code, and nowhere else', () => {
  // **The claim the whole route rests on.** A word drawn on a remote's screen says where a code sits;
  // this says what it is. Measured on 22 August 2026: 52 of the 58 commands Logitech states for one
  // Panasonic television are byte for byte equal to a code on the television attached to the bench
  // Harmony 600, which is a different model of the same family.
  const matched = matchNames(
    appliance([[0, 48, '400401002829'], [1, 48, 'ffffffffffff'], [2, 12, '910']]),
    [{ name: '5', bits: 48, frame: '400401002829' },
     { name: '0', bits: 12, frame: '910' },
     { name: 'Nothing here has this', bits: 48, frame: '123456789abc' }]);

  assert.deepEqual(matched.names, [{ slot: 0, name: '5' }, { slot: 2, name: '0' }]);
  assert.equal(matched.comparable, 3, 'and it says how many could be compared at all');
  assert.equal(matched.offered, 3);
});

test('a frame only matches beside its own width', () => {
  // The same hexadecimal at two widths is two different codes, in two different protocol families. A match
  // on the value alone would hand somebody a name out of a protocol their appliance does not speak, and it
  // would look exactly like a correct answer.
  const matched = matchNames(
    appliance([[0, 32, '10ef']]),
    [{ name: 'Wrong protocol', bits: 16, frame: '10ef' }]);
  assert.deepEqual(matched.names, []);
  assert.equal(matched.comparable, 1, 'the code was comparable; it simply did not match');
});

test('a name somebody typed is left alone unless asked for', () => {
  // Their own word beats a catalogue's, and a page that quietly replaced it would be a page that loses
  // work. The other behaviour exists and the only honest caller for it is a button that says so.
  const held: DeviceDefinition = {
    ...appliance([[0, 48, '400401002829']]),
    commands: [{ slot: 0, name: 'The one for the news', signal: { bits: 48, frame: '400401002829' },
                 origin: 'from-a-configuration' }],
  };
  const theirs = [{ name: '5', bits: 48, frame: '400401002829' }];

  assert.deepEqual(matchNames(held, theirs).names, []);
  assert.deepEqual(matchNames(held, theirs, { overNames: true }).names, [{ slot: 0, name: '5' }]);
});

test('a code that cannot be read as a number is not counted as comparable', () => {
  // The honest denominator. An appliance whose codes do not decode to frames cannot be matched at all, and
  // saying "0 of 81" would read as "Logitech does not have it" when the truth is that nothing was compared.
  const matched = matchNames(appliance([]), [{ name: 'Power', bits: 48, frame: '400401002829' }]);
  assert.equal(matched.comparable, 0);
  assert.equal(matched.offered, 1);
  assert.deepEqual(matched.names, []);
});

test('the password is encrypted on disk and the email is not', async (t) => {
  const { store, root } = await settings();
  t.after(() => rm(root, { recursive: true, force: true }));

  await store.rememberAccount('someone@example.test', 'a-secret');

  // The address is readable on purpose: it is not a secret and it sits in a folder somebody is invited to
  // look in. The password is not there at all.
  const readable = await readFile(join(root, 'preferences.json'), 'utf8');
  assert.match(readable, /someone@example\.test/);
  assert.ok(!readable.includes('a-secret'), 'and the password is not in the readable file');

  // **The assertion that matters**: what is on disk is not the password. The stand-in cipher reverses, so
  // this also proves the password went through the cipher rather than around it.
  const stored = await readFile(join(root, 'logitech.credential'), 'utf8');
  assert.notEqual(stored, 'a-secret');
  assert.equal(stored, 'terces-a');
});

test('what a screen may know is an address and a yes or no', async (t) => {
  const { store, root } = await settings();
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.deepEqual(await store.accountState(), { hasPassword: false });
  await store.rememberAccount('someone@example.test', 'a-secret');
  // Two fields and neither of them is the password or a masked form of it: a row of dots of the right
  // length is itself a fact about somebody's password.
  assert.deepEqual(await store.accountState(), { email: 'someone@example.test', hasPassword: true });
  assert.deepEqual(Object.keys(await store.accountState()).sort(), ['email', 'hasPassword']);
});

test('an empty password keeps the stored one, and is refused when there is none', async (t) => {
  const { store, root } = await settings();
  t.after(() => rm(root, { recursive: true, force: true }));

  // What the field on the screen means when somebody fixes a typo in their address and leaves the password
  // alone. Storing an empty string there would silently destroy a working credential.
  await assert.rejects(() => store.rememberAccount('someone@example.test', ''), /password is needed/);
  await store.rememberAccount('someone@example.test', 'a-secret');
  await store.rememberAccount('corrected@example.test', '');

  assert.deepEqual(await store.accountState(),
                   { email: 'corrected@example.test', hasPassword: true });
  assert.deepEqual(await store.credentialForSigningIn(),
                   { email: 'corrected@example.test', password: 'a-secret' });
  await assert.rejects(() => store.rememberAccount('   ', 'x'), /email address is needed/);
});

test('forgetting takes the password off the disk', async (t) => {
  const { store, root } = await settings();
  t.after(() => rm(root, { recursive: true, force: true }));

  await store.rememberAccount('someone@example.test', 'a-secret');
  await store.forgetAccount();

  assert.deepEqual(await store.accountState(), { hasPassword: false });
  assert.equal(await store.credentialForSigningIn(), undefined);
  await assert.rejects(() => readFile(join(root, 'logitech.credential')), /ENOENT/);
  // And the address goes with it, since half an account is a state nothing can use.
  assert.ok(!(await readFile(join(root, 'preferences.json'), 'utf8')).includes('someone'));
});

test('a system that cannot encrypt is told so rather than given plain text', async (t) => {
  const { store, cipher, root } = await settings();
  t.after(() => rm(root, { recursive: true, force: true }));

  // A real case, on a Linux session with no keyring. Falling back to a readable file is the quiet
  // downgrade that makes a promise about a password worthless, so it refuses and says why.
  cipher.available = false;
  await assert.rejects(() => store.rememberAccount('someone@example.test', 'a-secret'),
                       /no way to store a password safely/);
  assert.deepEqual(await store.accountState(), { hasPassword: false });
});

test('ciphertext this machine can no longer read reads as no password', async (t) => {
  const { store, root } = await settings();
  t.after(() => rm(root, { recursive: true, force: true }));

  // Which happens for an ordinary reason: the key belongs to this login on this computer, so a settings
  // folder copied from another machine brings a file nobody here can open. Reported as "no password",
  // which is what it amounts to, and the screen then offers to type one in.
  await store.rememberAccount('someone@example.test', 'a-secret');
  await writeFile(join(root, 'logitech.credential'), Buffer.from([0xff, 0xfe, 0x00]));

  const held = await store.accountState();
  assert.equal(held.email, 'someone@example.test', 'the address is still known');
  assert.equal(held.hasPassword, true, 'and the bytes are there, so this is not the unreadable case');

  // Now genuinely unreadable: a cipher that throws is what the real one does on foreign ciphertext.
  const broken = new Settings({
    root,
    cipher: {
      isEncryptionAvailable: () => true,
      encryptString: () => Buffer.alloc(0),
      decryptString: () => { throw new Error('not ours'); },
    },
  });
  assert.deepEqual(await broken.accountState(), { email: 'someone@example.test', hasPassword: false });
  assert.equal(await broken.credentialForSigningIn(), undefined);
});

test('a preferences file somebody has broken by hand is an empty preference set', async (t) => {
  const { store, root } = await settings();
  t.after(() => rm(root, { recursive: true, force: true }));

  // It sits in a folder people are invited to open, so this is a real thing to survive. Nothing in here is
  // irreplaceable, unlike a remote's entry, which is why the store next door refuses to guess instead.
  await writeFile(join(root, 'preferences.json'), '{ this is not json', 'utf8');
  assert.deepEqual(await store.read(), {});
  assert.deepEqual(await store.accountState(), { hasPassword: false });
});

# Working brief

FreeHarmony is a local, offline application for configuring Logitech Harmony remotes. **This
repository holds the product and none of the knowledge**: the reverse engineering, the specification
and the libraries live in [harmony-explorations](https://github.com/dannybloe/harmony-explorations),
checked out beside this one. Read its `README.md` and `docs/status.md` before working here, because
almost every question about what a config contains is answered there and nowhere else.

**Status: the boundary works and there is no interface.** It stopped being a placeholder on 14 August
2026: `bin/inventory.ts` takes a config file, hands it to `@harmony/codec` and prints the architecture,
the build date, the devices with the route that named each one, and the activities with the devices each
drives. Run against a real Harmony 600 config it names four devices and three activities. That is the
whole application so far, and it is deliberately a script rather than a window.

The format knowledge it stands on is in the other repository: a config reads off a remote byte for byte,
every byte of it is attributed, and a config's devices, activities, button bindings and drawn screens all
come back by name.

## The boundary, and the one rule that protects it

FreeHarmony **consumes** `@harmony/codec` and `@harmony/usb`. It does not reimplement them, and a hand
maintained copy of any of that code here is the one thing that must not happen. The reason is the other
repository's oldest rule: two copies of a derivation stay two copies right up until one of them moves,
which has happened there twice, and both times a test could see both copies. Across a repository
boundary no test can. So a finding could land there and never reach the product, which is the failure
this split is arranged to avoid.

If distribution ever demands vendoring, vendor a **generated** copy with a check that it matches a
commit. That is a dependency wearing a hat, not a second source.

**How it is consumed, today**: a link dependency on the sibling checkout.

```json
{ "packageManager": "pnpm@11.20.0", "dependencies": { "@harmony/codec": "link:../harmony-explorations/packages/codec" } }
```

**This said `file:` until 14 August 2026 and that spelling does not work here.**<!--superseded--> The
mechanism in the old wording was right and the spelling was wrong for the package manager this project
uses. All four combinations were measured the day the dependency was first installed for real:

| tool | spelling | result |
|---|---|---|
| npm | `file:` | works, a direct symlink to the sibling |
| npm | `link:` | installs nothing at all |
| pnpm | `file:` | fails: the package is copied into `node_modules/.pnpm`, so its real path is inside `node_modules` |
| pnpm | `link:` | works, a direct symlink to the sibling |

So **no single spelling works under both tools**, which is why `packageManager` is stated in
`package.json` and `test/boundary.test.ts` asserts that the spelling matches it. The earlier measurement
was taken with npm and generalised. The failure under pnpm reports
`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, which names types and `node_modules` and says nothing
about the real cause, so the test asserts the **resolved real path is outside `node_modules`**: the
mechanism, not the symptom.

The sibling layout is load bearing rather than a convention. **Later**, when that API stops moving, the
libraries get published and this repository pins an exact version. A **git dependency was tried and does
not work** for the same underlying reason: Node refuses to strip types for any file whose real path is
inside `node_modules`, whatever the flag.

**The first thing to write here was not the interface**, and that is done: the dependency plus one
script that opens a config and prints its inventory, so the boundary was proven before there is an
Electron shell to hide a problem in. It earned its keep immediately, since installing it for real is what
refuted the spelling above.

## Never write to a remote

Version 1 is read only, and the rails that enforce it live in `@harmony/usb`, not here: writes are
refused unless `HARMONY_ENABLE_WRITES=1`, an architecture with no write target refuses by
construction, and internal memory reads with an odd byte count are refused because they hang a remote.
A rail enforced by an interface is enforced until somebody writes a script, so this repository must
never reach past the library to a device, and must never grow its own copy of a rail.

These remotes are irreplaceable and Logitech's service can be withdrawn without notice. Treat every
hardware path as something that gets one chance.

## This repository is public, and it handles other people's equipment

* **No config or firmware binaries, ever**, including as test fixtures. A config is Logitech generated
  data with an infrared database compiled from Logitech's own, so it is a copyright matter; a remote's
  info output carries serial GUIDs, which is personal data. `.gitignore` lists them already, before
  there is a single fixture, because a fixture is the first thing anybody reaches for.
* **No screenshots of a real config's screens.** A drawn screen is a picture of somebody's equipment.
* **No brand names out of a contributor's config** in a document or a test. Counts and shapes.
* When this repository does start holding code with fixtures, bring over the other one's
  `bin/check-publishable.py` pre-commit hook, which checks **staged content** and so catches a rename
  or a `git add -f` that `.gitignore` misses.

## The network, and the one field that has to exist before the rest is designed

**Offline is the floor.** Reading a remote, showing a config, editing it and writing it back are local
operations and must never acquire a runtime dependency on anything remote. No account is ever required.
A build with the network unplugged is a working application, and that is testable: it should be tested.

**Logitech's service is an optional import, by the user's own hand.** It is still running, and while it
is, it can still say which infrared codes a given television uses. So FreeHarmony offers fetching a
device the user owns, converting it into this project's own device definition format, and storing it
locally so it outlives the service. The user decides, supplies their own credentials if it needs them,
and can see what was fetched. Two routes exist and the cheap one needs no new protocol work: base slot
5 is fully read, so a config Logitech compiled can be read off the remote and converted with the codec
as it stands. A direct client against `svcs.myharmony.com` is the other route, and nobody has looked at
what it serves; that is reconnaissance for the other repository, where a client sourced fact belongs in
`docs/host-client.md`.

**A device definition carries its provenance, from the first version of the format.** Learned from
hardware, derived from Logitech's data, or from a shared database. Only the first may ever be shared:
anything derived from Logitech's data stays on the machine that fetched it, for the same reason the
other repository refuses to commit a config. Everything else about a community database is undecided
and can stay that way, but **this field cannot be added later**: retrofitting provenance means auditing
a database whose origins nobody kept, and the only safe thing to do with that is discard it.

## Conventions carried over

* **Every dependency pinned exactly. No `^`, no `~`, ever**, including transitive additions, and the
  lock file committed. This matters far more here than in a research repository: an Electron and
  interface stack is hundreds of packages, and retrofitting pinning is painful where starting pinned is
  free. Check what a dependency pulls in before adding it; an audit is the floor, not the check.
* **No em-dashes or en-dashes in documents.** Nothing enforces it here yet, so it is a habit rather
  than a check. Verify with a command written in escapes, so that the check does not itself contain
  the characters it looks for, which is a mistake made once already while writing this file:

  ```
  python3 -c "import sys; d=open(sys.argv[1]).read(); print(sum(d.count(c) for c in '\u2014\u2013'))" <file>
  ```
* **A claim carries its evidence.** The other repository's rule is that a confirmed fact lands as a
  structured fact, a written argument and a regression test. Product code is not a finding, but the
  spirit transfers: if this application states something about a remote, it should be able to say which
  section of `docs/findings.md` says so.

## Licence

GPLv3 for the application, MIT for the libraries it builds on. Plain GPLv3 rather than the Affero
variant on purpose, and `README.md` carries the argument: compatibility with concordance and
harmony-decompiler has to run in **both** directions, and Affero's extra clause covers software offered
over a network, which this application never does. Anything that grows a server later gets its own
licence decision at that point.

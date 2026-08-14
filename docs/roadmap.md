# Roadmap: from a codec to an application

## What this document is

The plan of record for **the product**. The plan of record for the format and the libraries is
`docs/roadmap.md` in [harmony-explorations](https://github.com/dannybloe/harmony-explorations), and the
two are deliberately different documents with different units of progress:

| | moves when | milestones |
|---|---|---|
| harmony-explorations | something about the format becomes provable | M0 to M6 |
| this document | somebody can do something with their remote | P0 to P6 |

**Where they touch, this document names the M number and does not restate it.** That is the same rule
that keeps a reader out of this repository: a summary is a copy of a fact with no test, and a copy across
a repository boundary is a copy nothing can compare. So the rows in "What this stands on" below are
pointers, and when one of them is wrong the fix is next door.

**Written on 14 August 2026, after the first code, on purpose.** The owner's decision, taken when the
question was whether to combine the two plans or split them: a product roadmap written before any product
code is a list of guesses about what the hard parts are, and the first thing written here immediately
refuted a claim both repositories had carried for weeks. So P0 came first and this document came second.

## The shape of it, in one paragraph

The libraries can already read a config off a remote and say almost everything about it. What they cannot
yet do is put one back. So the honest shape of this application's life is: **an inspector first, an editor
second**, with the boundary between them being a milestone next door rather than a design choice here.
That is not a limitation to work around; it is the sequence the hardware demands, because the first write
to an irreplaceable remote should happen after everything about the config is understood, not before.

## What this stands on

Every row is work in the other repository, and the status column carries **no figures on purpose**. That
repository computes its numbers from the corpus and fails a check when a document disagrees with the code;
this one has no such check, so a percentage copied into this table is a number that can only rot. Read the
figures next door, from `docs/status.md` or `make coverage`, and read this table for what depends on what.

| what the product needs | where it comes from | status there |
|---|---|---|
| read a whole config off a remote | M1, `@harmony/usb` | done, and verified against each unit's own dump |
| know what every byte of it means | M2 parts 1 and 2 | done, on every architecture the corpus covers |
| put an unchanged config back together | M2 part 3, `emit.ts` | done, byte identical across the corpus |
| name the devices and the activities | sections 120, 121, 125, 126 | done, every one of both |
| say what each button sends | section 126 | done, and every binding in the corpus is a press |
| draw a config's screens | section 129, `render.ts` | done, every mode page of every container |
| change a field without changing a length | `edit.ts`, with `FIELD_RULES` | done, and it refuses to resize anything |
| change a length | not scheduled | open, and it is what an insert needs |
| write to a remote | M4 | not started, and the Harmony One is the only write target |
| learn an infrared code | M5 | not started, and it needs an encoder nobody has written |

**Two rows carry the whole difference between an inspector and an editor**, and neither is a product
task. Changing a length relocates every picture above it, and writing to a remote has one legal target on
one architecture.

## Where it stands

**P0 is done and nothing else is started.** There is one script and four tests. `bin/inventory.ts` takes
a config file and prints what it holds; `test/boundary.test.ts` asserts that the library imports, that its
resolved real path is outside `node_modules`, that the dependency's spelling matches the stated package
manager, and that nothing here parses a byte itself.

## Milestones

Each one is written as something a person could say, because that is this document's unit. The library
work each depends on is named rather than described.

### P0 The boundary, proven by something that runs. Done, 14 August 2026

The dependency, one script, and the probe that exercises it. It is here rather than folded into P1
because a shell hides a resolution problem and a script cannot, which is exactly what happened: the
`file:` spelling both repositories stated as fact fails under this project's own package manager, and
installing it for real is what said so. `CLAUDE.md` carries the four measured combinations.

### P1 "Plug in my remote and show me what is on it"

The first thing a user can do, and it is the second library rather than an interface. `@harmony/usb`
becomes a second link dependency, `listHarmony` says what is attached, `readConfig` reads it, and the
inventory printer already exists.

**The first thing to measure is whether the native dependency resolves across the link.** `@harmony/usb`
imports `node-hid` dynamically, from a file whose real path is inside the sibling checkout, so the
resolution happens there and the prebuilt binary that checkout already has should be found. Should is not
measured. If it is not, the answer is not to install `node-hid` here: it is one more thing about the
boundary that a test has to state, and approving a native build in this repository is a separate decision
with its own commit.

Two rails, both inherited and neither reimplemented here: enumeration must not open a device, and every
command goes through the library so that its refusals are in the path. See `CLAUDE.md`.

**Deliberately still a terminal.** The risk in P1 is the USB path and the resolution of a native module,
and neither is easier to see through a window.

### P2 "Show it to me properly"

The window. The inventory as a screen, the activities and the devices, each button with what it sends,
and the config's own screens drawn beside the keys they bind. Everything it draws comes from the codec,
including the rasters, because a second renderer here would be the second copy the split exists to
prevent.

**The shell is the decision this milestone forces, and it has not been taken.** Electron is the standing
intent, named in both briefs and in the end goal, and nothing about it has been measured: not the
packaged size against a self-contained cross-platform promise, not whether the main process needs the
libraries bundled or as sources, and not what the alternatives cost. That last one matters because it is
also the input the other repository is waiting on before it decides what publishing a package means: a
bundler compiles TypeScript sources itself, an unbundled main process does not. So P2 begins by choosing
the shell with a measurement rather than by installing the one everybody assumed.

**No local listening port.** The bench instrument next door serves a page to a browser and is allowed to,
because it is a bench instrument. A product gets a content security policy and no socket, and the
difference is written down in both places so nobody has to infer it.

**The application must build and run with the network unplugged, and that gets a test rather than a
promise.** It is the claim `README.md` makes to a user in the first paragraph, so it is the claim most
worth being able to fail.

### P3 "Change the name of that activity and put it back"

The first write, and it is two milestones stacked. The codec side exists: `edit.ts` replaces a run with a
run of the same length, refuses an edit outside every claim the byte accounting makes, refuses two edits
on one byte, and refuses a mode page's list without its copy. `saveEdits` stamps the two fields a save
must not carry over, where `applyEdits` reproduces them.

**What does not exist is M4**, the write path, its rails and the read-back-and-compare. That is library
work, first exercised on the spare Harmony One through the bench instrument next door, and it belongs
there for the reason all rails do: a rail enforced by an interface is enforced until somebody writes a
script.

**Version 1 is read only and this milestone is therefore version 2.** That is decision 8 in the other
repository and it is not up for renegotiation here. What it means concretely, and what should be said out
loud rather than discovered by a user: **version 1 of FreeHarmony is an inspector.** It reads a remote,
explains it, draws it, and cannot change it.

**Only the Harmony One can be written to, and that is a hardware fact rather than a policy.**
`ARCHITECTURES_WITH_A_WRITE_TARGET` is a list of one, because a first write needs a spare unit whose
original contents are in the lab byte for byte, and the Harmony 600's architecture has no spare. So P3
ships for one model before it ships for the rest, and the interface has to be honest about which remote
it will refuse.

**Same-length editing is a narrow door and the narrowness is deliberate.** Renaming an activity to a
shorter string works; renaming it to a longer one is the unscheduled row in the table above. An
interface that offers a text field and then refuses half of what is typed into it is worse than one that
says what the limit is, so P3's design problem is honesty about the limit rather than the edit.

### P4 "Teach it a code from my old remote"

M5 next door: the capture arrives as unsolicited reports over USB, already in the shape a config record
wants on one architecture, and what is missing is the encoder from raw timings to a stored record. That
encoder replaces a decision Logitech's own server used to make, which is why three of the four infrared
encoding classes appear in no config anybody has: the service chose the storage form, and the service
that chose it is the discontinued one.

Product side, this is the milestone with a physical ritual in it: point a remote at a receiver, press a
button, see whether it took. So it needs feedback a user can act on, and a way to try the code out on the
equipment, which is a write to the remote and therefore lands after P3.

### P5 "Set up a device I have never had on this remote"

A device definition has to come from somewhere. Three sources, and the field that distinguishes them is
already decided: **provenance**, from the first version of the format, because it cannot be retrofitted.
See `CLAUDE.md`.

* **Learned from hardware**, which is P4, and the only kind that may ever be shared.
* **Imported from Logitech's service**, which is optional, by the user's own hand, and stays on the
  machine that fetched it. The cheap route needs no new protocol work at all, since a config Logitech
  compiled can be read off a remote and converted with the codec as it stands. The direct route has been
  measured next door rather than only mapped, and it serves symbolic codes rather than pulses, so it
  needs an infrared encoder per protocol family: that is a real work item and it is nobody's yet.
* **A shared database**, which is undecided in every respect but that one field.

### P6 "Give it to somebody else"

Packaging, signing, cross-platform builds, and a release that a person who has never seen a terminal can
install. It is last because everything above it changes what has to be packaged, and it is the milestone
that turns the boundary from a convenience into an obligation: at that point the libraries have to be
consumable by somebody who does not have the sibling checkout, which is what publishing them is for.

## What this plan deliberately does not sequence

* **The interface design.** What the screens are, what the interaction is, what it looks like. P2 forces
  a shell decision and not a design one, and a wireframe written now would be written before anybody has
  used P1.
* **The device database's shape, licence, hosting or review process.** One field is decided and the rest
  waits until P5 needs it.
* **Whether a picture can be edited.** It needs the codec to frame image bodies rather than carry them,
  which is 60 to 80 points of a number next door and, by that repository's own argument, adds no
  understanding. It is a product question and the product has not asked it.
* **Anything about a remote nobody here owns.** Four remotes are on the bench and the corpus reaches two
  more architectures through contributed configs. A model with no hardware behind it gets read support
  when the format says so and never a write path.

## What would change this plan

* **Logitech's service going dark.** It is alive and answering, and it can be withdrawn without notice.
  It would cost the import in P5 and nothing else, which is the whole reason offline is the floor rather
  than a feature.
* **A second remote of the Harmony 600's architecture.** It is the only thing that unblocks writing to
  anything but a Harmony One.
* **A length-changing editor becoming possible.** It moves P3's limit and it is the one row in the table
  above with no owner.
* **Somebody else contributing.** The licence is settled while the owner is the only author, and both
  repositories are pinned and gated so that a first contribution lands in a place with checks in it. What
  changes is this document's tone: it is currently written for one person who knows why every rail is
  there.

# The document model

Written 21 August 2026 before any of it existed, so that it could be argued with rather than
discovered in the code. **Most of it exists now**, and the sections below say which parts and where.
Nothing here is decided except where it says so.

## Why the model comes first

A config is a **compiled artefact**. It is the result of somebody's choices, not the choices
themselves, and the remote is its interpreter. So the document is the source and the config is the
output, and the model holding more than a config does is the normal relationship between the two,
not a luxury.

That also means most of this application can be built before anything is compiled. Filling the
model from a remote works today, because reading a config is finished. Everything after that is
interface over the model.

## Three sources, and what each is for

**Logitech's own editor gives the vocabulary.** The client we hold in the lab is the editor people
actually used, and its own model is legible in it: a device is a manufacturer, a model number and a
type, with a list of commands; an activity is a **kind** plus a set of named **roles**, each role
filled by one of your devices, together with what happens when it starts and when it stops; a button
map binds a named button to a command, per device and per mode; and the timings are named, how long
between two key presses, how long between two devices, how many repeats a press needs at minimum.
None of that is copied. It is what the people who built this had learned about the problem, and it
is worth starting from.

**Our own findings say what the remote executes.** That is the floor. Anything the model holds that
cannot be expressed down there can never reach a remote, however sensible it looks on screen.

**And the emitter says what we can put back.** That is the column nobody can guess, and it is
measured below.

## Where it is

`src/shared/library.ts` is the device library, `src/shared/content.ts` is what a document holds,
`src/shared/writeback.ts` is the table below as code, and `src/main/import.ts` fills the model from a
configuration that was read off a remote. The first three are plain data with no library behind them,
by the same rule as the rest of `src/shared`; the fourth is the only file here that turns the library's
values into ours, which is why it sits in the main process.

**And it is wired up end to end now.** `src/main/configuration.ts` reads a configuration off an
attached remote and reads one back off a disk, `src/main/store/library.ts` keeps the appliances in
`Documents/FreeHarmony/devices`, and `src/renderer/src/views/Inventory.tsx` is the first screen in
FreeHarmony that shows somebody their own configuration. The transfer itself is the sibling
repository's `readConfig`, imported through the `@harmony/corpus/read` subpath, because it carries two
checks nothing here should reimplement: the end marker has to sit where the header said, and the
trailer checksum has to recompute.

**The table is enforced by the compiler**, not by a habit: every entry in `writeback.ts` is a mapped
type over the interface it describes, so adding a field to the model fails the typecheck until somebody
has said what happens to it.

## The model, in plain words

A **document** is one remote.

* **What it is.** Its name, its model, when it was added, where it came from, and the configuration
  we read off it, kept as it arrived.
* **Devices.** One per real appliance. A label, a type, the commands it knows, its timings, and its
  **state machine**: what about it can be in more than one state, how many states each of those has,
  and which commands move it from one to another.
* **A command.** A name, what it sends, and where that came from. What it sends is either a
  protocol and a value, or the measured pulses, and those are two forms of one thing rather than two
  kinds of command.
* **Activities.** A name, a kind, the devices it uses and the role each one plays, and above all
  **what state it wants everything to be in**: the television on and showing input 3, the amplifier on.
  Not a list of commands to send, which is what makes switching activity leave alone what is already
  right.
* **Buttons.** Per activity and per device, which button sends which command. Two populations, the
  keys the screen speaks for and the keys on the keypad, which the format keeps strictly apart.
* **Screens.** What the remote shows: the pages, the words on them, and the artwork.

## What the model holds that a config cannot

This is the list that justifies the whole exercise.

* **The whole command set of a device.** A config keeps only the commands that something is bound
  to. A television knows hundreds.
* **The original learned signal.** A config keeps one chosen encoding of it and the measurement is
  gone. Keeping the capture is what lets us encode it again later, differently.
* **Where a definition came from.** Learned from hardware here, or taken from Logitech. This is
  already decided, and it is decided early because it cannot be established in hindsight: only
  something learned from hardware may ever be shared with anybody.
* **The kind of an activity, and the role each device plays in it.** A config has the resulting
  instructions. That a receiver is the one doing the sound is not in there, and it cannot be
  recovered from the compiled form.
* **The names a person chose**, for a button or a command. The config knows a scan code.

## Can we put it back? Measured, not assumed

Two of our own configurations, one from a Harmony One and one from a Harmony 600, run through
`node packages/codec/bin/emit.ts --detail` in the sibling repository on 21 August 2026. The number is
the share of a structure's bytes that the emitter computes from named fields rather than copying
through as an opaque run. Only the first kind can be produced from a model.

| what the model holds | in the config | rebuilt from fields |
|---|---|---|
| devices and their infrared codes | base slot 5, groups, headers, blocks | 100%, and headers 95% |
| what a button does | base slot 10's action lists | 100% |
| activities and their key maps | base slot 9's sets | 100% |
| the pages and their structure | base slot 6 | 100% |
| device state, which drives everything | base slot 13 | 91% to 94% |
| the names in the config | base slot 0 | 100% |
| timings and parameters | base slot 15 | 100% |
| where a touch lands | base slot 17 | 100% |
| the words on a screen | base slot 11's programs | 21% to 26% |
| the artwork | the picture bank | 0% |
| the typeface | base slot 7's glyphs | 1% |

So everything a person would edit is rebuildable from fields, and the two structures that are not
are the images and the font. That is not a gap in the reading: several different encodings draw the
same image, so re-encoding one produces a valid file that is not the original. An editor carries an
image it did not change through unchanged, which is what it should do anyway.

The screen programs sit in between because the instructions are framed and the pixels and strings
they carry are not.

**And the artwork turns out not to be a constraint at all**, decided on 21 August 2026 on the
grounds that Logitech's own icons are dated and worth replacing rather than preserving. Writing a
picture needs no new reading: the format has a **raw** kind, which is a header and the pixels, and
that is already what most pictures are. Measured on the two configurations above: 65 of a Harmony
One's 98 pictures and 15 of a Harmony 600's 16 are stored raw, and emitting every one of them raw
would grow the whole picture bank by **2%** on the One and by nothing measurable on the 600. So
"generate our own bitmaps" costs a couple of percent of space and no format work, which is a much
cheaper answer than reproducing an encoder we cannot reproduce anyway. What stays true is that a
picture we did not make is carried through untouched, since re-encoding it is the thing that cannot
be done.

## The state machine, which is the part that makes a Harmony feel clever

Pointed out by Danny on 21 August 2026 and it was missing from the first version of this page.

The remote keeps track of what state it believes every appliance is in. An activity does not say "send
these six commands", it says what everything should be doing, and the remote sends only the difference.
That is why switching from watching television to listening to music does not turn the television off
and on again, and why it gets it wrong if you turned the television off with its own remote: its belief
is now stale.

All of it is in the file, per appliance, and the library next door already reads it. Measured on the
four configurations the tests use, 27 properties and 89 transitions:

* a `Power` with two states, on every appliance
* an `Input` with as many states as the appliance has inputs, 19 on one of them
* and per pair of states, which commands to send to make the move

So the model holds this on the **appliance**, because it is a fact about the appliance: a television
with one power button needs a toggle where one with separate buttons does not. And an activity holds the
**wanted state** rather than a list of actions.

**Logitech's own editor agrees, which was checked afterwards rather than copied.** Their records for the
two activities that produced our calibration configurations were read on 21 August 2026. An activity
there carries one **role** per appliance, typed by the job it does, and each role names the input that
appliance has to be switched to, by name, plus its position in the power up and power down order. Their
own lists of actions to run on entering and leaving are **empty on both**. So a role with an input and an
order is the shape, and the commands are what a compiler works out. Two things of theirs the model
adopted on the strength of that: the power order, which was missing and is needed, since an amplifier
that powers on after the television has been told which input to use has missed the instruction; and the
input as a **name** rather than a number, because that is what a person picks and what their television
prints on its own screen.

**One closure worth keeping.** Which appliance a property belongs to comes from the names in the file;
which codes a transition sends comes from the action lists. Those are two unrelated readings, and they
agree on all 89 transitions: not one sends another appliance's code. A single crossing would mean one of
them is wrong, so the count is asserted at zero, and pairing every property with the wrong appliance
makes both tests fail.

**What is still not read**: what an activity wants. The values are in the file, written by the
activity's own enter handler, and it waits on the same open question as its start and stop actions,
which of a key map's handlers is the enter one. There is a candidate answer, that the enter handler is
the one recording the activity as running, and establishing it belongs next door with a measurement
behind it.

## Two things building it taught, both of which would have been wrong

**Marks and spaces are stated, not implied.** The obvious way to hold an infrared code is a list of
durations that alternate, starting with a mark, which is how raw infrared is written nearly everywhere.
Measured across four configurations: of 1729 duration blocks, 599 begin with a **space** and only 154
strictly alternate. Both reasons are ordinary. A code that repeats begins with the gap before it, and a
single duration caps at 32767 microseconds, so a long pause is several spaces in a row. Assuming the
alternation would have silently mangled 91% of the codes in the corpus, and nothing would have failed
until somebody pressed a button.

**There are two kinds of absence and they must not be confused.** What an activity was for, and which
device does the sound in it, are gone because the compiler discarded them: no amount of better reading
brings them back, and that is the argument for the model. But an activity's **start** and **stop**
actions are in the file, in its key map's own enter and leave handlers, and they come out empty today
only because which of three tags is the leave handler has never been established next door. The first
version of the import filled the start actions from the button that starts the activity, which reads
correctly and measures zero, because that button selects the key map and the codes live one hop
further along. So the model marks these two as waiting on a reading rather than as lost, and the test
asserts they are empty, which is what stops the next person filling them from a guess.

## What this means for version 1

Version 1 is read only, so none of this is written to a remote yet. What it does mean is that the
model can be authoritative for everything in the top half of that table from the start, and that the
bytes we read stay authoritative for the artwork and the font. Saving, when it arrives, is a minimal
change against the configuration we read, not a file built from nothing: the codec cannot generate a
config out of nothing and is not going to be asked to.

The one thing to carry per field is whether it can be written back. That belongs beside the model,
not in the emitter, because otherwise we build interface for something that can never reach a
remote.

## Decided: the device library sits outside the document

Settled on 21 August 2026. A device definition lives in a library beside the documents, and a
document refers to it. The same television is in three documents and is defined once; it is the unit
a shared collection would exchange, and the unit provenance is recorded on, so it is the same object
in both directions.

Three things follow, and they are work rather than objections.

* **A document is no longer self contained.** Anything that moves a document to another machine has
  to take the definitions it refers to, or say what is missing. A folder that cannot be opened
  because a device is unknown would be the failure to avoid.
* **A definition can change under a document.** Teaching a better code for a television improves
  every document that uses it, which is the point, and it also means a document can stop matching
  the configuration that was built from it. Which of the two a change is has to be a stated answer
  and not an accident.
* **Provenance lives in the library**, one flag per definition, and only something learned from
  hardware may ever be shared. That was already decided; putting the definitions in one place is
  what makes it enforceable rather than a convention.

### What an appliance is called, decided by building it

**A definition is named after what it sends**, hashed, so the identifier is a property of the appliance
and not of the read that found it. Three consequences, and all three are what was wanted: reading the
same remote twice leaves the library exactly as it was, the same television on two remotes is one
definition, and renaming a document changes nothing.

It was **not** the first answer. The identifier started as the document's name plus a position, which
a test caught immediately: a remote called `living room` produced `living room-device-0`, and the store
refuses that because an identifier is a file name. Spelling it acceptably would have hidden the real
fault, which is that a definition's identity is permanent and a document's name is something a person
changes on a whim.

**An appliance with no commands falls back to the configuration's digest**, and it has to. Every
appliance nobody has taught anything to sends the same nothing, so addressing them by content would
make them all one definition. There is no content to address, so the read that found it is the honest
identity.

**Nothing is ever overwritten and nothing is merged.** Filing the appliances of a document that has
already been filed reports them as kept, because a definition may have been corrected by hand since it
arrived. And two definitions that send the same things are **reported** as probably one appliance and
never joined: merging changes what every document pointing at either one is pointing at, which is a
decision for a person.

Whether that library is ever shared with other people is still open, and nothing above depends on
it.

# The document model, a proposal

Written 21 August 2026, before any of it exists, so that it can be argued with rather than
discovered in the code. Nothing here is decided except where it says so.

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

## The model, in plain words

A **document** is one remote.

* **What it is.** Its name, its model, when it was added, where it came from, and the configuration
  we read off it, kept as it arrived.
* **Devices.** One per real appliance. A label, a type, the commands it knows, and its timings.
* **A command.** A name, what it sends, and where that came from. What it sends is either a
  protocol and a value, or the measured pulses, and those are two forms of one thing rather than two
  kinds of command.
* **Activities.** A name, a kind, the devices it uses and the role each one plays, and what happens
  on start and on stop.
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

## What this means for version 1

Version 1 is read only, so none of this is written to a remote yet. What it does mean is that the
model can be authoritative for everything in the top half of that table from the start, and that the
bytes we read stay authoritative for the artwork and the font. Saving, when it arrives, is a minimal
change against the configuration we read, not a file built from nothing: the codec cannot generate a
config out of nothing and is not going to be asked to.

The one thing to carry per field is whether it can be written back. That belongs beside the model,
not in the emitter, because otherwise we build interface for something that can never reach a
remote.

## Open, and it is the fork that shapes the model

**Does a device definition belong to the document, or to a shared library?**

The same television will be in three documents. It is also exactly the unit a community database
would exchange, and the unit provenance is recorded on. Put it in the document and every document is
self contained and duplicates its neighbours. Put it in a library and a document holds references,
and there is a second place where things live.

Not decided. Everything above works either way, which is why it can wait for one conversation.

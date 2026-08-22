# Roadmap

What FreeHarmony will be able to do, in the order it will be able to do it.

Each step below is something you can see appear. There is no code in this document and no jargon: if
a step mentions a limit, it is because the limit is something you would run into, not because it is
technically interesting. The technical plan, which milestone depends on which piece of reverse
engineering, lives in the
[harmony-explorations](https://github.com/dannybloe/harmony-explorations) repository next door and is
written for whoever is building this.

**Nothing here has a date.** The steps are in order and each one waits on the one before it. How fast
they arrive depends on how fast a remote's configuration file gives up its secrets, and that is not
something anybody can schedule.

## Where it stands

**Step 2 is done and step 1 works.** There is a window: it keeps a list of your remotes, each one a
folder in your own documents, and you can add one, name it, rename it, copy it and remove it.

Open one with the remote plugged in and it offers to **import** what is on it. It reads the remote,
which takes a minute or so and changes nothing on it, and then shows you what it found: your devices
with the number of commands each one has, your activities, and how many buttons are set up. Nothing is
written down until you say so, so this is also how you simply look at what is on a remote. Say yes and
the page lists your devices with the number of buttons each one answers to, and your activities with
the devices each one drives. The names are yours: the ones you typed into Logitech's software, and for
an activity the words the remote draws on its own screen.

**It is an import and never a synchronisation**, and that is worth being plain about because the two
look alike from the outside. What comes off the remote replaces what is in that entry, and the way
back, when it exists, will be built from the entry rather than merged into it. Every reading is kept as
its own file, so nothing you have imported is ever thrown away, and if an entry already holds something
you are told what it is before anything is replaced. Copy it first if you want to keep both.

Devices it recognises are matched on what they send rather than on a name, which is the only thing a
configuration states about them: it names no manufacturer, no model and not one command. So a
television already in your library keeps the words you gave it, and the buttons that used it keep
sending exactly what they sent, which is not free. Of the devices that turn up in more than one
configuration next door, a quarter are described with their commands in a different order, by
Logitech's own software.

**Every device now has a page with your remote drawn on it**, and the buttons on that drawing are
coloured by what they do: the ones that drive this device, the ones another device has taken, and the
ones nothing uses yet. Press one and it says which command it sends, and lets you point it at a
different one.

The keypad is shown **one activity at a time**, and that is not a simplification: on a Harmony, a button
means something different in each activity, which is the whole point of an activity. The volume key sends
to the amplifier while you are listening to music and to the television while you are watching it. So
there is nothing to show for a device no activity uses yet, and the page says so.

Two limits it tells you about rather than hiding. Some buttons cannot be pointed at anything, because what
they send has never been measured on that model: 36 of a Harmony 600's 54, 34 of a Harmony One's 44, and
none at all of a Harmony 525's 50. Those are drawn faded and say why when you press one. And the buttons
**on the screen** are a separate set that this page does not touch yet.

What step 1 still owes you is the screens, drawn the way the remote draws them. They can be read today,
next door, and they are not on screen yet.

Your devices are kept in their own place, beside the remotes rather than inside one, because the same
television belongs to every remote that drives it. Reading the same remote twice does not describe
its television twice: a device is recognised by what it sends.

**That place is the device library, and it opens over whatever you are doing.** There is a button at the
top right of the window, on every screen, and pressing it slides a panel over the application without
taking you away from it. That is deliberate: looking up which remotes drive your amplifier is a glance,
not a trip, and when you close the panel you are exactly where you were.

Inside it, a grid with one tile per device: a picture of what it is, a television or an amplifier or a
games console, the kind underneath, and a small number in the corner saying how many of your remotes use
it. A remote's own page carries the same kind of tiles, for its devices, its activities and its settings,
each badged with how many there are.

The first tile in the library writes a new device down, on its own page, and needs four words at most: a
category, a make, a model, and a name only if you want one. No codes behind it, which is worth having on the day you
discover the application cannot read your amplifier yet.

Open a device and you get its own page: the picture and the name at the top, the remotes using it as a
row of pictures underneath, drawn the same way they are drawn on the front page, and what can be done to
it along the bottom. If you opened the panel from inside a remote, that remote is marked in the row, and pressing it just closes the panel rather than sending you to its
front page. If it is **not** in the row, the row offers to add the device to it there and then, which is
the second way round: from a remote you pick a device out of the library, and from the library you push a
device onto the remote you came from.

**Three buttons on that page are drawn and switched off**, which is on purpose rather than unfinished
work left showing. Commands is where you will name and learn codes and build sequences of them, Inputs is
where you say which input on the amplifier belongs to which thing plugged into it, and Settings is where
the waiting times live: how long your television takes after being switched on before it will listen to
anything. That last one is not waiting on the interface. Logitech's own software asked you for those
numbers, so the file holds them somewhere, and where has not been read yet. See "Deliberately not decided
yet" below.

**Every screen says where you are, and that trail is the whole of the navigation.** It runs along the top
of the window, starting at FreeHarmony and adding a step for every level down, and every step is a way
back to it. There is no back arrow: a trail says where you are, where an arrow only says where you were,
and having both meant two controls for one job that could disagree with each other. The panel keeps its
own trail, starting at Device library, separate from the application's, so opening the library and closing
it again cannot move the application underneath.

**The panel is always the same size**, and so is a device's page inside it, which is worth a sentence
because it was tried the other way first. A sheet that grew and shrank with its contents moved its own
close button under your pointer every time you went one level in, and empty space at the bottom is a much
smaller price than that.

**Copying is there for a reason that only turns up once you have two of something.** Two televisions of
one model send the same codes, so importing both describes them once, and the only way to tell them apart
is to say so. That is why a device carries a name of its own alongside the name each remote gives it, and
why the name each remote gives it is optional: leave it and the remote shows the library's name.

**A device also records where it came from**, and says so on its own page: learned from your own hardware,
downloaded from Logitech, read off a particular remote, or typed in by hand. That is the one field that
cannot be worked out afterwards, and it is what decides whether a device could ever be shared with anybody
else.

One thing to expect and it is not a fault: **a configuration never says what a device is.** It states
codes and positions and no words at all. So everything that arrives by importing a remote is filed as
"something else" until somebody says otherwise, and the pictures only start meaning something once they
have.

## The steps

### 1. See what is on your remote

You open FreeHarmony, plug your remote in, and it shows you what is on it. Your devices. Your
activities, and which devices each one switches on. What every button sends, including the buttons on
the screen. And the screens themselves, drawn the way the remote draws them.

Nothing is changed. This step is a window onto a remote you already own, and it is the step that has
to be trustworthy before any other one is allowed to exist.

**What has to be true first:** reading a remote works and is proven byte for byte, and almost
everything in the file can be explained. Both are done. And somewhere to **put** what was read, which
is a description of a remote holding more than a configuration file does: that exists now, and
`docs/data-model.md` is both its argument and its description.

**Where it stands:** your devices and your activities are on screen, read off the remote by the
application itself. Buttons and screens are what is left.

### 2. Keep your remotes in one place

You have more than one remote, or you had one and bought another second hand. So FreeHarmony keeps a
list: add a remote, give it a name you recognise, remove one you no longer have.

The reason this is its own step, rather than a detail of step 1, is **backups**. The first time
FreeHarmony reads a remote it keeps a complete copy of what was on it, with the date, and it never
throws that away on its own. These remotes cannot be bought new. A safety net that exists before the
first change is worth more than any feature after it.

**What has to be true first:** step 1, and a decision about where those copies live on your machine
and how you get at them. **Done**, ahead of step 1 and for the reason given above: a remote is a
folder in your own documents, named by you, and nothing here deletes one without asking.

### 3. Change something, without touching the remote

Rename an activity. Correct a device's name. Then look at exactly what changed, side by side with what
was there.

Nothing is sent to the remote in this step, on purpose. Your remote keeps working exactly as it did,
and the change lives in a file on your computer. That sounds like half a feature and it is deliberate:
it lets the part that makes changes be built, checked and trusted while the worst that can happen is
that a file on your disk is wrong.

**The limit you will run into:** a new name has to fit in the space the old one used. A shorter name is
fine. A longer one is not, yet, and step 6 is where that changes. FreeHarmony will say so plainly
rather than letting you type and then refusing.

**Version 1 ends here.** Steps 1 to 3 are an application that looks, keeps and edits a copy. It never
writes to a remote. That is not caution for its own sake: see the next step for what writing actually
costs.

### 4. Put it back, changing nothing

The first time FreeHarmony writes to a remote, it writes back exactly what it read. Not a single byte
different. Then it reads the remote again and compares.

That is the whole step, and it is the most important one in this document. A write that changes
nothing either works perfectly or reveals a problem while there is still an original to go back to.
Every step after this one rests on it having been done boringly, on a spare remote, many times.

**What you will see:** a very plain screen that says what it is about to do, does it, and tells you
whether the remote came back identical.

**The honest bit:** this will arrive for one model before the others. Writing needs a spare remote of
that exact kind to practise on, and there is only one spare on the bench. A remote FreeHarmony cannot
safely write to will be told so, rather than being written to hopefully.

### 5. Change what your remote does

Now the two halves meet. Rename an activity and put it on the remote. Change which command a button
sends. Adjust how fast a held button repeats.

This is the step where FreeHarmony becomes the thing it exists to be: a remote you own outright
becomes a remote you can change again.

**What has to be true first:** step 4, done often enough to be dull.

### 6. Add and remove devices and activities

Add a television you just bought. Delete the amplifier you sold. Build an activity that turns on three
things and switches to the right input.

This is the largest step in the list by a long way, and it is honest to say why: adding something
means the file gets longer, and everything after the insertion point moves. Steps 3 and 5 avoid that
entirely by only ever swapping something for something the same size. And a new device needs to come
from somewhere, which is the next step.

### 7. Teach it a code from your old remote

Point your old original remote at your Harmony, press a button, and FreeHarmony learns what that
button sends and stores it.

The remotes have always been able to do this. What they cannot do any more is the second half: the
original software sent the recorded signal to Logitech's servers, which worked out what it meant and
sent back the answer. Those servers made that judgement, and they are gone. So this step is not about
capturing the signal, which is comparatively easy, but about doing the thinking that used to happen
somewhere else.

A device you have taught FreeHarmony yourself is also the only kind that could ever be shared with
other people, if a shared collection of devices is ever built. Anything that came out of Logitech's
own data stays on your machine, because it is their data and not ours to hand around.

### 8. An application you can install

A download, for Windows, macOS and Linux, that installs like anything else and needs no account, no
server and no terminal.

It is last because everything above it changes what has to be packaged, and because the audience for
steps 1 to 7 is the small number of people who can run a command. This step is what makes it useful to
everybody else.

## About the network, at every step

Every step above works with the network unplugged, and that will not quietly change. No account is
required, nothing has to phone home, and none of it stops working when a server somewhere is switched
off.

One thing sits on top of that, and only if you ask for it. Logitech's own service is still running
today, and while it is, it can still tell you which codes your television or amplifier uses. So
FreeHarmony will be able to fetch a device you own and keep it on your machine, so it outlives the
service. You decide whether to use that. Somebody who never touches it gets exactly the same
application.

## Deliberately not decided yet

* **What the screens for step 1 look like.** The ones that exist were designed against something
  real, which was the rule. Showing a configuration has nothing to design against yet.
* ~~Whether it is a desktop window or something else.~~ **Decided.** A normal desktop application,
  one window, built on the same technology as several applications you probably already have open, so
  one codebase can cover macOS, Windows and Linux. Chosen on 18 August 2026 by building it rather than
  by arguing about it. Only macOS has actually been run; giving it to the other two is step 8.
* **A shared collection of devices.** Whether it exists, who runs it, how a contribution is checked.
  Two things about it are settled. Every device definition records where it came from, because that
  is impossible to work out afterwards and the answer decides whether it may be shared at all. And
  the definitions live in their **own place beside the documents** rather than inside them, decided
  on 21 August 2026: the same television belongs to three remotes and should be described once.
  `docs/data-model.md` carries what follows from that.
* **What a device's settings page can actually offer.** The Settings button on a device is drawn and
  switched off, and it will stay that way until one thing is read next door. Logitech's own software
  asked you how long a device takes to wake up before it will listen, how long to leave between two
  commands, and how it prefers to be switched on and off; that is in their own setup questions, so the
  numbers exist in the file. The place they almost certainly live is a block of numbered parameter
  groups whose lengths the remote checks, and a group of the wrong length is thrown away and replaced
  with the remote's own defaults, without complaint. So guessing is worse than waiting: it produces a
  configuration that looks accepted and quietly does nothing. Inputs is in the same position for a
  different reason, that the choice of input is stored as a value with no word attached to it anywhere.
  Written down on 22 August 2026 so that a button greyed out today is not a button forgotten about
  next month.
* **Editing the pictures on the screen.** The icons and images a remote shows can be read and drawn
  today. Changing them is a separate problem and nobody has asked for it yet, but it is **not** the
  hard problem it looked like: the format stores most pictures uncompressed, so drawing our own
  costs a couple of percent of space and no new format work. Reproducing Logitech's own encoder is
  the thing that cannot be done, and replacing its artwork means never needing to.

## What could change the order

* **Logitech's service being switched off.** It is alive today and can go at any time without notice.
  It would cost the optional import in step 7 and nothing else, which is exactly why nothing depends
  on it.
* **A second spare remote of another kind.** Writing needs something to practise on. More spares means
  step 4 arrives for more models at once instead of one at a time.
* **The file format giving up the last thing it is holding back.** Step 6 needs the ability to make
  the file longer safely, and that is the one item in the list with nobody assigned to it.

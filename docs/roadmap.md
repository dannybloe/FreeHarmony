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

Appliances it recognises are matched on what they send rather than on a name, which is the only thing a
configuration states about them: it names no manufacturer, no model and not one command. So a
television already in your library keeps the words you gave it, and the buttons that used it keep
sending exactly what they sent, which is not free. Of the appliances that turn up in more than one
configuration next door, a quarter are described with their commands in a different order, by
Logitech's own software.

What step 1 still owes you is the rest of the picture: what every individual button sends, and the
screens drawn the way the remote draws them. Both can be read today, next door, and neither is on
screen yet.

Appliances are kept in their own place, beside the remotes rather than inside one, because the same
television belongs to every remote that drives it. Reading the same remote twice does not describe
its television twice: an appliance is named after what it sends.

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

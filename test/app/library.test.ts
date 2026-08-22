/**
 * The device manager, in a running window: from Home to a written down appliance and back.
 *
 * **Needs no lab**, unlike every other test in this folder, and that is the point of it. Everything else
 * here starts from a real configuration, so the whole library has only ever been exercised with
 * descriptions read out of one: nameless, kindless, and every one of them `from-a-configuration`. This
 * walks the other route, the one a person takes on the day they install the application and have nothing
 * to import yet.
 *
 * What only this test can see is the draft crossing the bridge. Everything over it is structured cloned,
 * so a form's fields becoming a definition is a seam, and the unit tests on either side of it cannot tell
 * whether the words arrive.
 *
 * The words asserted here are our own invention, not anybody's equipment, so unlike `inventory.test.ts`
 * this one may read them off the page.
 *
 * **One thing to know before writing another test that drives a modal.** The window these tests run in is
 * never shown, so it never composites, so `requestAnimationFrame` never fires and a CSS entry transition
 * never completes. A modal left in its entering state renders, and a press on something inside it goes
 * nowhere. This cost an afternoon and produced a real answer rather than a workaround: the library panel
 * does not animate, because it is a place you go to glance at something rather than an event. If a modal
 * that does animate ever has to be driven from here, the window has to be shown.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { DeviceDefinition } from '../../src/shared/library.ts';
import { API_NAMESPACE } from '../../src/shared/api.ts';
import { launch } from './electron.ts';

const NAME = 'The study amplifier';

test('a device can be written down from the bar and comes back as a tile', async (t) => {
  const app = await launch();
  t.after(() => app.close());

  /**
   * Presses whatever says this, waiting for it to appear, **inside the open panel where there is one**.
   *
   * That scoping is not tidiness. A click issued from a script ignores the sheet lying over the
   * application, so a search across the whole page reaches buttons a person could not possibly press. It
   * cost an afternoon here: the library panel has an "Add..." tile and so does Home, and with the panel
   * open this pressed Home's, underneath, which sent the application to the add-a-remote screen while the
   * panel sat on its list. Then it waited for a form that was never going to appear.
   *
   * So the rule is the one a person is bound by: while a modal is up, only what is in it can be pressed.
   */
  const press = async (what: string): Promise<boolean> => {
    const wanted = JSON.stringify(what);
    return app.evaluate<boolean>(`(async () => {
      for (let tries = 0; tries < 40; tries += 1) {
        const within = document.querySelector('.mantine-Modal-content') ?? document;
        for (const it of within.querySelectorAll('button')) {
          const says = (it.textContent ?? '').includes(${wanted});
          if (says || it.getAttribute('aria-label') === ${wanted}) { it.click(); return true; }
        }
        await new Promise((wake) => setTimeout(wake, 100));
      }
      return false;
    })()`);
  };

  /**
   * Opens the panel from the application's bar.
   *
   * Its own helper because it is the one press that must look outside the panel: the way in is on the
   * application's bar and there is no panel yet to look inside.
   */
  const openLibrary = async (): Promise<boolean> => app.evaluate<boolean>(`(async () => {
    for (let tries = 0; tries < 40; tries += 1) {
      for (const it of document.querySelectorAll('button')) {
        if (it.getAttribute('aria-label') === 'Device library') { it.click(); return true; }
      }
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return false;
  })()`);

  /**
   * Types into the field with this label.
   *
   * Through the value setter on the prototype rather than by assigning `input.value`, which is the one
   * awkward thing in this file and is not optional: React holds its own copy of what it thinks the value
   * is, and a plain assignment leaves the two disagreeing so the change event is treated as a no-op. This
   * is what a real key press does from React's point of view.
   */
  const type = async (label: string, text: string): Promise<boolean> => {
    const wanted = JSON.stringify(label);
    return app.evaluate<boolean>(`(async () => {
      for (let tries = 0; tries < 40; tries += 1) {
        for (const it of document.querySelectorAll('input')) {
          const says = it.labels?.[0]?.textContent ?? '';
          if (says === ${wanted}) {
            const setter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype, 'value')?.set;
            setter?.call(it, ${JSON.stringify(text)});
            it.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        }
        await new Promise((wake) => setTimeout(wake, 100));
      }
      return false;
    })()`);
  };

  /** How many device tiles the library is showing, once it has drawn one. */
  const tiles = async (): Promise<number> => app.evaluate<number>(`(async () => {
    for (let tries = 0; tries < 40; tries += 1) {
      // Inside the panel, and found by the attribute rather than by shape: the add tile carries a
      // different value, so this counts devices and not the way to make one. There is no heading to
      // anchor on, on purpose, since the panel's own bar already says where you are.
      const panel = document.querySelector('.mantine-Modal-content');
      if (panel) {
        const drawn = panel.querySelectorAll('[data-tile=""]');
        if (drawn.length > 0) return drawn.length;
      }
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return -1;
  })()`);

  // The bar offers the library, from every screen, which is the placement decision on a screen: a device
  // belongs to no remote, so the way to it is not through one. It is found by its label rather than its
  // text, since it is a drawing.
  assert.equal(await openLibrary(), true, 'the bar offers the library');

  assert.equal(await press('Add...'), true, 'and the library offers to write one down');
  // The category, through the field's own list. Amplifier rather than the default, so the assertion below
  // cannot pass on the form having done nothing at all. It waits before looking, like `press` does: the
  // page is drawn when React is ready and a query issued straight after a click runs against the old one.
  assert.equal(await app.evaluate<boolean>(`(async () => {
    const find = (what) => [...document.querySelectorAll(what)];
    // Wait for the field, then open it **once**. Clicking it on every turn of a retry loop toggles the
    // list open and shut, so it was found open on one pass and closed on the next: the test failed about
    // half the time and looked like a race in the application rather than in the test.
    let field;
    for (let tries = 0; tries < 40 && field === undefined; tries += 1) {
      field = find('input').find((one) => (one.labels?.[0]?.textContent ?? '') === 'Category');
      if (field === undefined) await new Promise((wake) => setTimeout(wake, 100));
    }
    if (field === undefined) return false;
    field.click();

    for (let tries = 0; tries < 40; tries += 1) {
      const option = find('[role="option"]').find((one) => (one.textContent ?? '').includes('Amplifier'));
      if (option) { option.click(); return true; }
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return false;
  })()`), true, 'a category can be picked');
  assert.equal(await type('Name (optional)', NAME), true, 'and a name typed');
  assert.equal(await press('Add'), true);

  // Straight onto its own page, because writing something down and then having to find it in a grid is the
  // wrong end of the interaction. Read inside the panel, for the third time in this file and for the same
  // reason: the application underneath still has its own heading, and it is the first one in the document.
  const heading = await app.evaluate<string>(`(async () => {
    const said = () => document.querySelector('.mantine-Modal-content h2')?.textContent ?? '';
    for (let tries = 0; tries < 40; tries += 1) {
      if (said().includes(${JSON.stringify(NAME)})) return said();
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return said();
  })()`);
  assert.match(heading, new RegExp(NAME), 'the new device has its own page');

  // On disk, over the bridge, with the provenance the route implies. This is the assertion the whole test
  // exists for: nothing was learned from any hardware, so this may never be shared, and no other route
  // into the library can produce that value.
  const held = await app.evaluate<DeviceDefinition[]>(`window['${API_NAMESPACE}'].library.list()`);
  assert.equal(held.length, 1);
  assert.equal(held[0]?.name, NAME);
  assert.equal(held[0]?.kind, 'receiver');
  assert.equal(held[0]?.origin, 'typed-here');
  assert.deepEqual(held[0]?.commands, [], 'and it has no codes, which is allowed and is the point');

  // Back to the list, where it is now a tile. The count is what says the page reloaded rather than showing
  // what it had before the write. One and not two: the add tile carries `data-tile="add"`, which is what
  // that attribute's second value is for.
  //
  // Pressed on the panel's own root crumb, since the arrow went on 22 August 2026 and the trail is the
  // navigation. It is inside the panel, so the scoping the helper does is what keeps it off the
  // application's bar, where the very same words sit on the button that opens this panel.
  assert.equal(await press('Device library'), true);
  assert.equal(await tiles(), 1, 'the device, the add tile aside');
});

test('a copy is a second device with the same words and a different identity', async (t) => {
  const app = await launch();
  t.after(() => app.close());

  // Made over the bridge rather than through the form, because the form is what the test above walks and
  // repeating it here would be testing the same seam twice. What is being checked is the copy.
  await app.evaluate(
    `window['${API_NAMESPACE}'].library.create({ kind: 'television', name: 'The big one' })`);
  await app.reload();

  // Scoped to the panel where there is one, per the note on the helper in the test above: a scripted click
  // reaches straight through a modal, and Home has a button saying the same word.
  const press = async (what: string): Promise<boolean> => {
    const wanted = JSON.stringify(what);
    return app.evaluate<boolean>(`(async () => {
      for (let tries = 0; tries < 40; tries += 1) {
        const within = document.querySelector('.mantine-Modal-content') ?? document;
        for (const it of within.querySelectorAll('button')) {
          if ((it.textContent ?? '').includes(${wanted})
              || it.getAttribute('aria-label') === ${wanted}) { it.click(); return true; }
        }
        await new Promise((wake) => setTimeout(wake, 100));
      }
      return false;
    })()`);
  };

  const openLibrary = async (): Promise<boolean> => app.evaluate<boolean>(`(async () => {
    for (let tries = 0; tries < 40; tries += 1) {
      for (const it of document.querySelectorAll('button')) {
        if (it.getAttribute('aria-label') === 'Device library') { it.click(); return true; }
      }
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return false;
  })()`);

  /**
   * The same, but on the whole label rather than on a substring.
   *
   * Needed exactly once and for a reason worth writing down: the button that opens the copy dialogue says
   * "Duplicate..." and the one inside it says "Duplicate", so a substring match presses the opener again
   * and the test waits for something that already happened.
   */
  const pressExactly = async (what: string): Promise<boolean> => {
    const wanted = JSON.stringify(what);
    return app.evaluate<boolean>(`(async () => {
      for (let tries = 0; tries < 40; tries += 1) {
        for (const it of document.querySelectorAll('button')) {
          if ((it.textContent ?? '').trim() === ${wanted}) { it.click(); return true; }
        }
        await new Promise((wake) => setTimeout(wake, 100));
      }
      return false;
    })()`);
  };

  assert.equal(await openLibrary(), true);
  assert.equal(await press('The big one'), true, 'the device is on the list');
  // Two presses, because the ellipsis on the button is a promise that something appears: it asks for a
  // name, prefilled with the old one plus "copy", which is what makes the two tellable apart.
  assert.equal(await press('Duplicate...'), true);
  assert.equal(await pressExactly('Duplicate'), true, 'and the dialogue confirms it');

  const held = await app.evaluate<DeviceDefinition[]>(`(async () => {
    for (let tries = 0; tries < 40; tries += 1) {
      const all = await window['${API_NAMESPACE}'].library.list();
      if (all.length > 1) return all;
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return window['${API_NAMESPACE}'].library.list();
  })()`);

  assert.equal(held.length, 2, 'two devices, which is what somebody with two televisions has');
  // The same codes and a name of its own, which is the whole reason a device carries a name: without one
  // the two would be a single row twice over in every list. The suggestion is the old name plus "copy",
  // so nobody has to think of something before they can make the copy at all.
  assert.deepEqual(held.map((one) => one.name).sort(), ['The big one', 'The big one copy']);
  assert.notEqual(held[0]?.id, held[1]?.id);
  assert.deepEqual(held[0]?.commands, held[1]?.commands);
});

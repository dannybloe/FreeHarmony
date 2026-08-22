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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { DeviceDefinition } from '../../src/shared/library.ts';
import { API_NAMESPACE } from '../../src/shared/api.ts';
import { launch } from './electron.ts';

const NAME = 'The study amplifier';

test('an appliance can be written down from Home and comes back as a tile', async (t) => {
  const app = await launch();
  t.after(() => app.close());

  /** Presses whatever says this, waiting for it to appear. The same helper as `inventory.test.ts`. */
  const press = async (what: string): Promise<boolean> => {
    const wanted = JSON.stringify(what);
    return app.evaluate<boolean>(`(async () => {
      for (let tries = 0; tries < 40; tries += 1) {
        for (const it of document.querySelectorAll('button')) {
          const says = (it.textContent ?? '').includes(${wanted});
          if (says || it.getAttribute('aria-label') === ${wanted}) { it.click(); return true; }
        }
        await new Promise((wake) => setTimeout(wake, 100));
      }
      return false;
    })()`);
  };

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

  /** How many appliance tiles the library is showing, once it has drawn one. */
  const tiles = async (): Promise<number> => app.evaluate<number>(`(async () => {
    for (let tries = 0; tries < 40; tries += 1) {
      const section = [...document.querySelectorAll('section')]
        .find((one) => (one.querySelector('h2')?.textContent ?? '').includes('appliance'));
      if (section) {
        const drawn = section.querySelectorAll('[data-tile=""]');
        if (drawn.length > 0) return drawn.length;
      }
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return -1;
  })()`);

  // Home offers the library, which is the placement decision on a screen: an appliance belongs to no
  // remote, so the way to it is not through one.
  assert.equal(await press('Appliances'), true, 'Home offers the library');

  assert.equal(await press('Add...'), true, 'and the library offers to write one down');
  // A kind is chosen from the drawings, which is what the nine pictures are for. Amplifier rather than
  // the default, so the assertion below cannot pass on the form having done nothing.
  // Waits, like `press` does, and for the same reason: the modal is drawn when React is ready and a
  // query issued straight after the click that opened it runs against the page that was there before.
  assert.equal(await app.evaluate<boolean>(`(async () => {
    for (let tries = 0; tries < 40; tries += 1) {
      const it = document.querySelector('[data-kind="receiver"]');
      if (it) { it.click(); return true; }
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return false;
  })()`), true, 'a kind can be picked');
  assert.equal(await type('Name', NAME), true, 'and a name typed');
  assert.equal(await press('Write it down'), true);

  // Straight onto its own page, because writing something down and then having to find it in a row of
  // tiles is the wrong end of the interaction.
  const heading = await app.evaluate<string>(`(async () => {
    for (let tries = 0; tries < 40; tries += 1) {
      const said = document.querySelector('h2')?.textContent ?? '';
      if (said.includes(${JSON.stringify(NAME)})) return said;
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return document.querySelector('h2')?.textContent ?? '';
  })()`);
  assert.match(heading, new RegExp(NAME), 'the new appliance has its own page');

  // On disk, over the bridge, with the provenance the route implies. This is the assertion the whole test
  // exists for: nothing was learned from any hardware, so this may never be shared, and no other route
  // into the library can produce that value.
  const held = await app.evaluate<DeviceDefinition[]>(`window['${API_NAMESPACE}'].library.list()`);
  assert.equal(held.length, 1);
  assert.equal(held[0]?.name, NAME);
  assert.equal(held[0]?.kind, 'receiver');
  assert.equal(held[0]?.origin, 'typed-here');
  assert.deepEqual(held[0]?.commands, [], 'and it has no codes, which is allowed and is the point');

  // Back to the list, where it is now a tile. The count is what says the page reloaded rather than
  // showing what it had before the write. One and not two: the add tile carries `data-tile="add"`, which
  // is what that attribute's second value is for.
  assert.equal(await press('Back'), true);
  assert.equal(await tiles(), 1, 'the appliance, the add tile aside');
});

test('a copy is a second appliance with the same words and a different identity', async (t) => {
  const app = await launch();
  t.after(() => app.close());

  // Made over the bridge rather than through the form, because the form is what the test above walks and
  // repeating it here would be testing the same seam twice. What is being checked is the copy.
  await app.evaluate(
    `window['${API_NAMESPACE}'].library.create({ kind: 'television', name: 'The big one' })`);
  await app.reload();

  const press = async (what: string): Promise<boolean> => {
    const wanted = JSON.stringify(what);
    return app.evaluate<boolean>(`(async () => {
      for (let tries = 0; tries < 40; tries += 1) {
        for (const it of document.querySelectorAll('button')) {
          if ((it.textContent ?? '').includes(${wanted})
              || it.getAttribute('aria-label') === ${wanted}) { it.click(); return true; }
        }
        await new Promise((wake) => setTimeout(wake, 100));
      }
      return false;
    })()`);
  };

  assert.equal(await press('Appliances'), true);
  assert.equal(await press('The big one'), true, 'the appliance is on the list');
  assert.equal(await press('Make a copy'), true);

  const held = await app.evaluate<DeviceDefinition[]>(`(async () => {
    for (let tries = 0; tries < 40; tries += 1) {
      const all = await window['${API_NAMESPACE}'].library.list();
      if (all.length > 1) return all;
      await new Promise((wake) => setTimeout(wake, 100));
    }
    return window['${API_NAMESPACE}'].library.list();
  })()`);

  assert.equal(held.length, 2, 'two appliances, which is what somebody with two televisions has');
  // Same words, different identity. That asymmetry is the whole reason a description has a name of its
  // own: without it the two would be one row twice over in every list.
  assert.deepEqual(held.map((one) => one.name), ['The big one', 'The big one']);
  assert.notEqual(held[0]?.id, held[1]?.id);
});

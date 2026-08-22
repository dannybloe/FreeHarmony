/**
 * Our own stylesheets carry one value per property, because there is one colour scheme.
 *
 * The companion to `test/app/scheme.test.ts`, and it asks the question that belongs in the source
 * rather than in a window. `main.tsx` forces the light scheme, so a declaration of ours written for
 * the dark one compiles, ships and can never apply, and a rule that cannot fire is worse than a
 * missing one because it reads as covered.
 *
 * It asks about **our** stylesheets only. Mantine's own is full of dark scheme rules and that is
 * correct: it does not know what this application forces, and pruning somebody else's stylesheet is
 * not a thing to do. An earlier version of this check read the built CSS out of the running page and
 * tried to tell our rules from Mantine's by the shape of a hashed class name. It could not: Vite spells
 * ours `_shell_s9o8s_1` and Mantine spells its own `m_c44ba933`, and the pattern that was supposed to
 * separate them matched both. Asking the source is exact, and the source is the part we decide.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RENDERER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer');

/** Every stylesheet under the renderer, whatever the directory layout becomes. */
async function stylesheets(within: string = RENDERER): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(within, { withFileTypes: true })) {
    const here = join(within, entry.name);
    if (entry.isDirectory()) found.push(...await stylesheets(here));
    else if (/\.s?css$/.test(entry.name)) found.push(here);
  }
  return found.sort();
}

test('every stylesheet of ours is found, so the sweep below cannot be empty', async () => {
  // Named rather than counted, because this population grows with the interface: a count would move on
  // every new component, where a missing name means a file was renamed and the sweep stopped seeing it.
  const found = (await stylesheets()).map((path) => relative(RENDERER, path));
  // Named rather than counted, and the names move when a view does: this list found the removal of
  // `RemotesView.module.scss` the moment Home replaced it, which is what it is for.
  for (const wanted of ['src/App.module.scss', 'src/_mantine.scss',
                        'src/views/AppBar.module.scss', 'src/views/ApplianceView.module.scss',
                        'src/views/Carousel.module.scss',
                        'src/views/DeviceView.module.scss', 'src/views/DevicesView.module.scss',
                        'src/views/HomeView.module.scss', 'src/views/ImportView.module.scss',
                        'src/views/LibraryView.module.scss',
                        'src/views/PickDeviceView.module.scss', 'src/views/RemoteTile.module.scss',
                        'src/views/RemoteView.module.scss', 'src/views/SectionTile.module.scss',
                        'src/views/SettingsView.module.scss', 'src/views/Silhouette.module.scss']) {
    assert.ok(found.includes(wanted), `${wanted} is no longer where the sweep looks. Found: ${found}`);
  }
});

test('no stylesheet of ours states a colour for a scheme that cannot be selected', async () => {
  const guilty: string[] = [];
  for (const path of await stylesheets()) {
    const text = await readFile(path, 'utf8');
    for (const [line, content] of text.split('\n').entries()) {
      // The two ways to write one: Mantine's `light-dark()` function, which the PostCSS preset expands
      // into a rule per scheme, and the attribute selector those rules are keyed on.
      if (/light-dark\(/.test(content) || /data-mantine-color-scheme/.test(content)) {
        // A comment saying the mixins were removed and how they come back is the point of this file's
        // own docstring, so prose is allowed to name what code may not do.
        if (/^\s*(\/\/|\/\*|\*|\/\/\/)/.test(content)) continue;
        guilty.push(`${relative(RENDERER, path)}:${line + 1}: ${content.trim()}`);
      }
    }
  }

  assert.deepEqual(guilty, [], 'these cannot apply while the light scheme is forced');
});

test('the colours a drawing is made of are declared in one place', async () => {
  // The rule this project is named for, applied to CSS: a palette written per stylesheet is a
  // derivation with as many copies as there are views. It **was** three copies, in the tile, the naming
  // page and the remote page, and they drifted the day one of them was touched: the tiles were darkened
  // and the two large drawings stayed a shade paler, which reads as two different products rather than
  // as one at two sizes. So the palette is `m.drawing-palette` and nothing else may state one.
  //
  // Every fill and stroke in a silhouette reads one of these, which is what makes the check exhaustive
  // rather than a sample: the list is `packages/silhouettes/src/svg.ts`'s own.
  const properties = ['--case-fill', '--case-stroke', '--recess-fill',
                      '--key-fill', '--key-stroke', '--key-text', '--accent'];
  const declaring: string[] = [];
  for (const path of await stylesheets()) {
    const text = await readFile(path, 'utf8');
    for (const [line, content] of text.split('\n').entries()) {
      if (/^\s*(\/\/|\/\*|\*)/.test(content)) continue;
      if (properties.some((property) => new RegExp(`${property}\\s*:`).test(content))) {
        declaring.push(`${relative(RENDERER, path)}:${line + 1}: ${content.trim()}`);
      }
    }
  }

  const files = [...new Set(declaring.map((where) => where.split(':')[0]))];
  assert.deepEqual(files, ['src/_mantine.scss'],
                   `a drawing's colours belong in the mixin, not here:\n${declaring.join('\n')}`);
  // And the mixin has to state all of them bar the accent, which the library's own default is right
  // for: a red key is red on every screen. Six, so a palette cannot half exist.
  assert.equal(declaring.length, 6, declaring.join('\n'));
});

test('every view that draws a remote takes its colours from that mixin', async () => {
  // The other half, and it is the one a missing include would slip through: a stage with no palette
  // falls back to the library's defaults, which are paler than these and still render, so nothing
  // fails and one screen quietly looks like a different application.
  for (const view of ['views/RemoteTile.module.scss', 'views/NameRemoteView.module.scss',
                      'views/RemoteView.module.scss']) {
    const text = await readFile(join(RENDERER, 'src', view), 'utf8');
    assert.match(text, /@include m\.drawing-palette;/, `${view} draws a remote in unstated colours`);
  }
});

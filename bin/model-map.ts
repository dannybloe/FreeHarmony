/**
 * Draws the stored model as a diagram, out of the source rather than beside it.
 *
 * Danny asked for this on 22 August 2026, and the ask was exact: there is no way to see the document
 * model at a glance. `docs/data-model.md` argues about it at length and never shows it, and the types
 * themselves are spread over three files because each sits next to the values that keep it honest.
 *
 * **It is generated, and that is the whole point.** A diagram drawn by hand is a copy of a fact with no
 * test, which is the failure the sibling repository named after auditing eleven of them: the document
 * that summarises drifts, the code does not. So this reads the interfaces with the compiler's own parser
 * and `test/model-map.test.ts` fails when the committed picture stops matching them. Adding a field to
 * the model therefore shows up in the diagram in the same commit or the check refuses it.
 *
 * **The writeback column comes from the type argument and not from a second list.** `writeback.ts`
 * declares each of its tables as `Verdicts<DeviceDefinition>`, so which table describes which interface
 * is already written down once, in the source, as that type argument. Reading it here rather than
 * keeping a name-to-name map beside it is the same rule as everything else in this workspace: two
 * copies of a derivation are two copies until one of them moves.
 *
 * Usage:
 *
 *   pnpm model-map            print the diagram
 *   pnpm model-map --write    put it into docs/data-model.md between its markers
 *
 * Mermaid's entity syntax rather than its class syntax, deliberately: an attribute there is a type, a
 * name and a quoted comment, with no room for punctuation to be misread, and the multiplicity lives on
 * the relation where a reader looks for it. The class syntax wants square brackets and question marks
 * inside member names, which is exactly the sort of thing that renders on one viewer and not the next.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The files the stored model lives in, and nothing else.
 *
 * Named rather than swept, because "every type in `src/shared`" is not the model: the same directory
 * holds the bridge's own shapes, what an attached remote reports, and what an import is about to do.
 * Those are messages rather than things that are kept, and a diagram that mixed them would answer a
 * different question from the one asked.
 */
const SOURCES = ['src/shared/remote.ts', 'src/shared/content.ts', 'src/shared/library.ts'];

/**
 * Which file puts a structure on which side of the split, which is the one thing the diagram must not
 * blur: what a document holds, and what the library beside it holds.
 *
 * **The file and not a list of names**, which is what this was for an hour. A hand written list would be
 * a second statement of something the directory layout already says, and it would be the copy that rots:
 * add a structure to `library.ts` and it would quietly be drawn on the document side.
 */
const LIBRARY_FILE = 'src/shared/library.ts';

/**
 * A reference from one side to the other, carried by identifier rather than by type.
 *
 * The only edge here that is written by hand, and the reason it has to be is the interesting fact about
 * it: a device position holds a **string**, so nothing in the types says which structure it names, and a
 * diagram derived from the types alone draws the two halves as unconnected. That single thread is why a
 * document is not self contained, so leaving it out would be leaving out the point.
 *
 * It cannot rot silently: generating throws if the field it names has stopped existing.
 */
const REFERENCES = [
  { from: 'DeviceUse', field: 'definition', to: 'DeviceDefinition', says: 'by identifier' },
] as const;

interface Field {
  readonly name: string;
  readonly optional: boolean;
  /** The type as written, so a reader sees `readonly Step[]` as `Step` plus a many relation. */
  readonly type: string;
  /** The model type this field points at, where it points at one. */
  readonly points?: string;
  readonly many: boolean;
  readonly verdict?: string;
}

interface Structure {
  readonly name: string;
  /** The first sentence of its docstring, which is what a box is captioned with. */
  readonly summary: string;
  readonly fields: readonly Field[];
  readonly extends?: string;
  /** Which file it was declared in, which is what puts it on one side of the split. */
  readonly from: string;
}

/** A union of string literals, drawn as a note rather than as a box: it has no fields to show. */
interface Choice {
  readonly name: string;
  readonly values: readonly string[];
}

function program(): ts.Program {
  return ts.createProgram(SOURCES.map((one) => join(ROOT, one)), {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    noEmit: true,
  });
}

/** The first sentence of a declaration's docstring, or nothing where it has none. */
function summaryOf(node: ts.Node, source: ts.SourceFile): string {
  const ranges = ts.getLeadingCommentRanges(source.getFullText(), node.getFullStart()) ?? [];
  const last = ranges[ranges.length - 1];
  if (last === undefined) return '';
  const text = source.getFullText().slice(last.pos, last.end);
  if (!text.startsWith('/**')) return '';
  const prose = text
    .replace(/^\/\*\*|\*\/$/g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .join(' ')
    .trim();
  // The first sentence, and the markers stripped: a caption in a table renders as text.
  //
  // Split on a full stop and not on any punctuation, which was the first attempt: several of these
  // docstrings open with a file name followed by a colon, so "remote.json:" came out as the summary of
  // the largest structure in the model.
  const first = /^(.*?\.)(\s|$)/.exec(prose);
  return (first?.[1] ?? prose).replace(/\*\*/g, '').replace(/`/g, '').trim();
}

/**
 * Which interface each writeback table describes, read off its own type argument.
 *
 * The reason this is not a table of names here: it is already stated once, in `writeback.ts`, as
 * `Verdicts<DeviceDefinition>`. A second statement of it would be the second copy this workspace's
 * oldest rule is about, and it would rot silently, because nothing compares two lists nobody compares.
 */
function verdictsByStructure(source: ts.SourceFile): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const annotated = declaration.type;
      if (annotated === undefined || !ts.isTypeReferenceNode(annotated)) continue;
      if (annotated.typeName.getText(source) !== 'Verdicts') continue;
      const argument = annotated.typeArguments?.[0];
      if (argument === undefined) continue;
      const describes = argument.getText(source);
      const verdicts = new Map<string, string>();
      const value = declaration.initializer;
      if (value === undefined || !ts.isObjectLiteralExpression(value)) continue;
      for (const property of value.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const field = property.name.getText(source).replace(/['"]/g, '');
        const written = property.initializer.getText(source);
        const verdict = /writeback:\s*'([a-z]+)'/.exec(written)?.[1];
        if (verdict !== undefined) verdicts.set(field, verdict);
      }
      found.set(describes, verdicts);
    }
  }
  return found;
}

/** Everything the model states, read out of the three files. */
function read(): { structures: Structure[]; choices: Choice[] } {
  const compiled = program();
  const structures: Structure[] = [];
  const choices: Choice[] = [];

  const writeback = compiled.getSourceFile(join(ROOT, 'src/shared/writeback.ts'))
    ?? ts.createSourceFile('writeback.ts',
                           readFileSync(join(ROOT, 'src/shared/writeback.ts'), 'utf8'),
                           ts.ScriptTarget.ES2023, true);
  const verdicts = verdictsByStructure(writeback);

  for (const path of SOURCES) {
    const source = compiled.getSourceFile(join(ROOT, path));
    if (source === undefined) throw new Error(`${path} did not compile`);

    for (const statement of source.statements) {
      // Only what the module exports, since an internal helper type is not part of the model. The cast
      // is through `unknown` because the compiler's own `Statement` and `Declaration` do not overlap on
      // paper, and every statement that reaches this line has already been narrowed to a declaration by
      // the two guards below it.
      const exported = ts.getCombinedModifierFlags(statement as unknown as ts.Declaration)
        & ts.ModifierFlags.Export;
      if (!exported) continue;

      if (ts.isTypeAliasDeclaration(statement)) {
        // A union of string literals is a choice. Anything else is a helper and not part of the shape.
        const union = statement.type;
        if (!ts.isUnionTypeNode(union)) continue;
        const values = union.types
          .filter(ts.isLiteralTypeNode)
          .map((one) => one.literal.getText(source).replace(/'/g, ''));
        if (values.length === union.types.length && values.length > 0) {
          choices.push({ name: statement.name.text, values });
        }
        continue;
      }

      if (!ts.isInterfaceDeclaration(statement)) continue;
      const fields: Field[] = [];
      const table = verdicts.get(statement.name.text);
      for (const member of statement.members) {
        if (!ts.isPropertySignature(member) || member.type === undefined) continue;
        const written = member.type.getText(source);
        // `readonly X[]` and `readonly X[] | undefined` alike: what is wanted is the element.
        const many = /\[\]/.test(written);
        const bare = written.replace(/readonly\s+/g, '').replace(/\[\]/g, '').trim();
        const name = member.name.getText(source);
        fields.push({
          name,
          optional: member.questionToken !== undefined,
          type: written.replace(/readonly\s+/g, ''),
          ...(/^[A-Z]\w*$/.test(bare) ? { points: bare } : {}),
          many,
          ...(table?.get(name) === undefined ? {} : { verdict: table.get(name)! }),
        });
      }
      const inherits = statement.heritageClauses?.[0]?.types?.[0]?.expression.getText(source);
      structures.push({
        name: statement.name.text,
        summary: summaryOf(statement, source),
        fields,
        from: path,
        ...(inherits === undefined ? {} : { extends: inherits }),
      });
    }
  }
  return { structures, choices };
}

/** What a field's verdict is worth saying in a box, in the fewest words that are still true. */
const VERDICT_WORDS: Readonly<Record<string, string>> = {
  rebuilt: 'reaches a remote',
  carried: 'reaches a remote, same length only',
  unknown: 'a config states it somewhere, unread',
  ours: 'ours, never in a config',
};

/**
 * A field's type, spelled so that Mermaid will take it.
 *
 * An attribute type there is one word of letters, digits and underscores, so a list becomes `_list` and
 * a union of words becomes `choice`, with the words themselves in their own table at the bottom. The last
 * arm is a fallback and it showed up in the first run: `readonly number[]` came out as `number__`,
 * because the pattern above it only allowed a capital letter to start a list.
 */
function shown(type: string): string {
  const bare = type.replace(/\s*\|\s*undefined/, '').trim();
  if (/^\w+(\[\])?$/.test(bare)) return bare.replace('[]', '_list');
  if (/^'.*'(\s*\|\s*'.*')*$/.test(bare)) return 'choice';
  if (bare.startsWith('Readonly<Record')) return 'table';
  return bare.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24);
}

/**
 * One diagram for a named set of structures.
 *
 * **Two diagrams and not one**, which the first version got wrong: everything at once is twenty boxes
 * and it draws the two halves of the model as though they were one thing. The split between what a
 * document holds and what the library holds is the load bearing decision in this model, so the picture
 * has to show it, and a reader asking about a remote should not have to look past infrared timings.
 *
 * No comments in the diagram either. Mermaid takes them and then, correctly, does not render them, so
 * the captions went into the table below instead, where they can actually be read.
 */
function diagram(structures: readonly Structure[], all: readonly Structure[]): string {
  const drawn = new Set(structures.map((one) => one.name));
  const known = new Set(all.map((one) => one.name));
  const lines: string[] = ['erDiagram'];

  for (const structure of structures) {
    lines.push(`  ${structure.name} {`);
    for (const field of structure.fields) {
      const notes = [
        field.optional ? 'optional' : '',
        field.verdict === undefined ? '' : VERDICT_WORDS[field.verdict] ?? field.verdict,
      ].filter((one) => one !== '').join(', ');
      lines.push(`    ${shown(field.type)} ${field.name}${notes === '' ? '' : ` "${notes}"`}`);
    }
    lines.push('  }');
  }

  for (const structure of structures) {
    if (structure.extends !== undefined && drawn.has(structure.extends)) {
      lines.push(`  ${structure.extends} ||--|| ${structure.name} : "is also"`);
    }
    for (const field of structure.fields) {
      if (field.points === undefined || !known.has(field.points)) continue;
      const shape = field.many ? '}o--||' : (field.optional ? '|o--||' : '||--||');
      lines.push(`  ${structure.name} ${shape} ${field.points} : ${field.name}`);
    }
  }

  // The crossing, drawn on whichever diagram holds the side it leaves from.
  for (const reference of REFERENCES) {
    if (!drawn.has(reference.from)) continue;
    lines.push(`  ${reference.from} }o--|| ${reference.to} : "${reference.field}, ${reference.says}"`);
  }

  return lines.join('\n');
}

/** The captions, as a table, since a diagram has nowhere to put a sentence. */
function captions(structures: readonly Structure[]): string {
  const rows = structures.map((one) =>
    `| \`${one.name}\` | ${one.summary === '' ? '' : one.summary} |`);
  return ['| structure | what it is |', '|---|---|', ...rows].join('\n');
}

/** The words a field may hold, where its type is a fixed set of them. */
function choiceTable(choices: readonly Choice[]): string {
  const rows = choices.map((one) => `| \`${one.name}\` | ${one.values.map((v) => `\`${v}\``).join(', ')} |`);
  return ['| choice | one of |', '|---|---|', ...rows].join('\n');
}

const START = '<!-- model-map:start -->';
const END = '<!-- model-map:end -->';

/** The whole block, markers included, so a document can hold it and a test can compare it. */
export function block(): string {
  const { structures, choices } = read();
  // The hand written crossing, checked against the source rather than trusted.
  for (const reference of REFERENCES) {
    const holder = structures.find((one) => one.name === reference.from);
    if (holder?.fields.some((one) => one.name === reference.field) !== true) {
      throw new Error(`${reference.from}.${reference.field} is gone, so REFERENCES is stale`);
    }
    if (!structures.some((one) => one.name === reference.to)) {
      throw new Error(`${reference.to} is gone, so REFERENCES is stale`);
    }
  }

  const library = structures.filter((one) => one.from === LIBRARY_FILE);
  const document = structures.filter((one) => one.from !== LIBRARY_FILE);

  return [START,
          '',
          '<!-- Generated by `pnpm model-map --write`. Do not edit by hand: `pnpm check` compares this',
          '     with the interfaces and fails when they disagree. -->',
          '',
          '### What a remote document holds',
          '',
          'One `RemoteDocument` per folder in your documents. A quoted note on a field says whether a',
          'change to it could ever reach a remote, which is `src/shared/writeback.ts`\'s answer and not a',
          'guess.',
          '',
          '`DeviceUse.definition` is the one thread out of this diagram and into the next, and it carries an',
          'identifier rather than a structure. That is what makes a document not self contained: anything',
          'moving one to another machine has to take the definitions it names, or say what is missing.',
          '',
          '```mermaid',
          diagram(document, structures),
          '```',
          '',
          captions(document),
          '',
          '### What the device library holds',
          '',
          'One `DeviceDefinition` per appliance in the household, however many remotes drive it.',
          '',
          '```mermaid',
          diagram(library, structures),
          '```',
          '',
          captions(library),
          '',
          '### The fixed sets of words',
          '',
          choiceTable(choices),
          '',
          END].join('\n');
}

function main(): void {
  const text = block();
  const asPage = process.argv.indexOf('--page');
  if (asPage !== -1) {
    const to = process.argv[asPage + 1];
    if (to === undefined) throw new Error('--page needs a path to write to');
    writeFileSync(to, page());
    process.stdout.write(`${to} written\n`);
    return;
  }
  if (!process.argv.includes('--write')) {
    process.stdout.write(`${text}\n`);
    return;
  }
  const path = join(ROOT, 'docs/data-model.md');
  const document = readFileSync(path, 'utf8');
  const at = document.indexOf(START);
  const to = document.indexOf(END);
  if (at === -1 || to === -1) throw new Error(`docs/data-model.md has no ${START} ... ${END} markers`);
  writeFileSync(path, document.slice(0, at) + text + document.slice(to + END.length));
  process.stdout.write(`${relative(ROOT, path)} updated\n`);
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  main();
}

/**
 * The same model as a page, for looking at rather than for reading in a diff.
 *
 * **Generated from the same pass as the markdown, deliberately.** A page written by hand would be a
 * second copy of the model, which is the one thing this workspace's oldest rule forbids, and it would be
 * the copy that rots because nobody diffs a web page. So both come out of `read()` and neither can be
 * ahead of the other.
 *
 * What the page has that the document cannot: the field tables filter by whether a change could reach a
 * remote. That is the question somebody actually arrives with, and answering it in a document means
 * reading four hundred lines with a finger on the writeback table.
 */
export function page(): string {
  const { structures, choices } = read();
  const library = structures.filter((one) => one.from === LIBRARY_FILE);
  const document = structures.filter((one) => one.from !== LIBRARY_FILE);
  const noted = structures.flatMap((one) => one.fields).filter((one) => one.verdict !== undefined);

  return `<title>The FreeHarmony model</title>
<style>
/*
  Tokens on the bare :root, so the un-stamped "system" state gets a complete palette, and redefined
  twice below so an explicit choice wins in either direction. The neutrals are pulled towards the
  accent rather than being a pure grey, which is the application's own arrangement: its shadows are
  mixed from 16 24 40 rather than from black.
*/
:root {
  --ground: #f4f6fb;
  --surface: #ffffff;
  --edge: #e3e7f0;
  --ink: #101828;
  --quiet: #67708a;
  --accent: #4263eb;
  --accent-soft: #edf0fe;
  --carried: #6741d9;
  --carried-soft: #f1ecfd;
  --ours: #5c6579;
  --ours-soft: #eef0f4;
  --unread: #a15c07;
  --unread-soft: #fdf3e3;
  --shadow: 16 24 40;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0e1015;
    --surface: #171b23;
    --edge: #262c38;
    --ink: #e6e9f2;
    --quiet: #8b93a8;
    --accent: #93a7fb;
    --accent-soft: #1b2340;
    --carried: #b197fc;
    --carried-soft: #241d3d;
    --ours: #9aa3b7;
    --ours-soft: #1d222c;
    --unread: #e8b467;
    --unread-soft: #2c2314;
    --shadow: 0 0 0;
  }
}
:root[data-theme="dark"] {
  --ground: #0e1015;
  --surface: #171b23;
  --edge: #262c38;
  --ink: #e6e9f2;
  --quiet: #8b93a8;
  --accent: #93a7fb;
  --accent-soft: #1b2340;
  --carried: #b197fc;
  --carried-soft: #241d3d;
  --ours: #9aa3b7;
  --ours-soft: #1d222c;
  --unread: #e8b467;
  --unread-soft: #2c2314;
  --shadow: 0 0 0;
}

/*
  Two faces and a reason. The identifiers in this model are code, so they are set in the monospace the
  reader's own editor uses, and the commentary is prose about a format, so it is set in a serif. The
  pairing is the subject: a box holds names a compiler checks, a caption holds a sentence somebody wrote.
*/
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: ui-serif, "Iowan Old Style", Palatino, Georgia, serif;
  font-size: 17px;
  line-height: 1.6;
}
code, .mono, th, .field, .type, .chip, .name {
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
}
main { max-width: 68rem; margin: 0 auto; padding: 2.5rem 1.5rem 6rem; }
header { display: flex; flex-direction: column; gap: 0.6rem; }
h1 {
  margin: 0;
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1.55rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.lead { margin: 0; max-width: 62ch; color: var(--quiet); }
h2 {
  margin: 3.5rem 0 0.4rem;
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}
h2 + p { margin-top: 0; max-width: 62ch; }
.rule { height: 1px; background: var(--edge); border: 0; margin: 0.9rem 0 1.4rem; }

/* The legend, which is also the control: a chip is a filter over every field row below. */
.legend {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem 0;
  margin-top: 1.75rem;
  background: color-mix(in srgb, var(--ground) 88%, transparent);
  backdrop-filter: blur(8px);
}
.legend .what { color: var(--quiet); font-size: 0.9rem; margin-inline-end: 0.25rem; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.7rem;
  font-size: 0.76rem;
  border: 1px solid var(--edge);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.chip .dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--tone); }
.chip[aria-pressed="false"] { opacity: 0.42; }
.chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chip[data-key="rebuilt"] { --tone: var(--accent); }
.chip[data-key="carried"] { --tone: var(--carried); }
.chip[data-key="ours"] { --tone: var(--ours); }
.chip[data-key="unknown"] { --tone: var(--unread); }
.chip[data-key="none"] { --tone: var(--edge); }

/* A diagram is the one thing here allowed to be wider than the text. */
.diagram {
  overflow-x: auto;
  padding: 1rem;
  border: 1px solid var(--edge);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgb(var(--shadow) / 4%), 0 12px 28px rgb(var(--shadow) / 5%);
}

.cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); margin-top: 1.5rem; }
.card {
  border: 1px solid var(--edge);
  border-radius: 12px;
  background: var(--surface);
  padding: 1rem 1.1rem 0.6rem;
}
.card .name { font-size: 0.95rem; font-weight: 600; }
.card .says { margin: 0.15rem 0 0.7rem; font-size: 0.9rem; color: var(--quiet); }
.rows { display: flex; flex-direction: column; }
.row {
  display: grid;
  grid-template-columns: minmax(6rem, auto) 1fr auto;
  gap: 0.5rem;
  align-items: baseline;
  padding: 0.35rem 0;
  border-top: 1px solid var(--edge);
  font-size: 0.82rem;
}
.field { font-weight: 600; }
.field .opt { color: var(--quiet); font-weight: 400; }
.type { color: var(--quiet); overflow-wrap: anywhere; }
.tag { font-size: 0.68rem; letter-spacing: 0.04em; padding: 0.1rem 0.45rem; border-radius: 999px; white-space: nowrap; }
[data-verdict="rebuilt"] .tag { color: var(--accent); background: var(--accent-soft); }
[data-verdict="carried"] .tag { color: var(--carried); background: var(--carried-soft); }
[data-verdict="ours"] .tag { color: var(--ours); background: var(--ours-soft); }
[data-verdict="unknown"] .tag { color: var(--unread); background: var(--unread-soft); }
[data-verdict="none"] .tag { color: var(--quiet); background: var(--ours-soft); }

/* What the chips do. Hiding a row rather than fading it, so a card with nothing left reads as empty. */
body.hide-rebuilt [data-verdict="rebuilt"],
body.hide-carried [data-verdict="carried"],
body.hide-ours [data-verdict="ours"],
body.hide-unknown [data-verdict="unknown"],
body.hide-none [data-verdict="none"] { display: none; }

table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 1rem; }
th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--edge); vertical-align: top; }
th { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--quiet); font-weight: 600; }
td code { font-size: 0.85em; }
footer { margin-top: 4rem; color: var(--quiet); font-size: 0.85rem; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>

<main>
  <header>
    <h1>The FreeHarmony model</h1>
    <p class="lead">Everything the application keeps, drawn out of the interfaces themselves. A remote
      document on one side, the device library on the other, and one thread between them. Every field
      says whether changing it could ever reach a remote, which is read from the writeback table rather
      than remembered.</p>
  </header>

  <div class="legend">
    <span class="what">Can a change reach a remote?</span>
    ${[['rebuilt', 'yes'], ['carried', 'yes, same length only'], ['unknown', 'unread'],
       ['ours', 'never, it is ours'], ['none', 'no verdict recorded']]
      .map(([key, label]) =>
        `<button class="chip" data-key="${key}" aria-pressed="true"><span class="dot"></span>${label}</button>`)
      .join('\n    ')}
  </div>

  <h2>What a remote document holds</h2>
  <p>One of these per folder in your documents. <code>DeviceUse.definition</code> is the only thread out
    of here and into the library, and it carries an identifier rather than a structure, which is exactly
    why a document is not self contained.</p>
  <hr class="rule">
  <div class="diagram"><pre class="mermaid">${escape_(diagram(document, structures))}</pre></div>
  ${cards(document)}

  <h2>What the device library holds</h2>
  <p>One of these per appliance in the household, however many remotes drive it. Recognised by what it
    sends, because a configuration states no manufacturer, no model and not one command name.</p>
  <hr class="rule">
  <div class="diagram"><pre class="mermaid">${escape_(diagram(library, structures))}</pre></div>
  ${cards(library)}

  <h2>The fixed sets of words</h2>
  <p>Where a field's type is a set of words rather than a number or a name, these are the words.</p>
  <hr class="rule">
  <table>
    <thead><tr><th>choice</th><th>one of</th></tr></thead>
    <tbody>
      ${choices.map((one) => `<tr><td><code>${one.name}</code></td><td>${
        one.values.map((v) => `<code>${escape_(v)}</code>`).join(', ')}</td></tr>`).join('\n      ')}
    </tbody>
  </table>

  <footer>
    ${structures.length} structures, ${noted.length} fields with a recorded verdict, ${choices.length}
    sets of words. Generated by <code>pnpm model-map</code> from <code>src/shared/remote.ts</code>,
    <code>content.ts</code> and <code>library.ts</code>, with the verdicts joined on from
    <code>writeback.ts</code>. A test compares the committed copy in <code>docs/data-model.md</code>
    with the source, so neither this page nor that document can quietly fall behind the code.
  </footer>
</main>

<script>
  // The chips, as a set of classes on the body. Nothing is stored and nothing is in the URL: this is a
  // page somebody looks at for a minute, and a filter that outlived the visit would be a surprise.
  for (const chip of document.querySelectorAll('.chip')) {
    chip.addEventListener('click', () => {
      const on = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', on ? 'false' : 'true');
      document.body.classList.toggle('hide-' + chip.dataset.key, on);
    });
  }
</script>
`;
}

/** One card per structure: what it is, then its fields with the verdict as a tag. */
function cards(structures: readonly Structure[]): string {
  return `<div class="cards">\n${structures.map((structure) => {
    const rows = structure.fields.map((field) => {
      const verdict = field.verdict ?? 'none';
      const tag = field.verdict === undefined ? 'no verdict' : VERDICT_WORDS[field.verdict] ?? field.verdict;
      return `      <div class="row" data-verdict="${verdict}">`
        + `<span class="field">${field.name}${field.optional ? '<span class="opt">?</span>' : ''}</span>`
        + `<span class="type">${escape_(field.type)}</span>`
        + `<span class="tag">${escape_(tag)}</span></div>`;
    }).join('\n');
    return `    <div class="card">\n      <div class="name">${structure.name}</div>\n`
      + `      <p class="says">${escape_(structure.summary)}</p>\n`
      + `      <div class="rows">\n${rows}\n      </div>\n    </div>`;
  }).join('\n')}\n  </div>`;
}

/** Markup safe, because a caption is prose out of a docstring and a type can hold angle brackets. */
function escape_(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

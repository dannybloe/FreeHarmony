/**
 * A document's own contents, on disk beside its manifest.
 *
 * **The document is the truth and the configuration is where it came from**, decided on 22 August 2026,
 * and this file is that decision expressed as a file name. Until now the contents were worked out from
 * the configuration bytes on every single look, which was cheap, always consistent, and left nowhere at
 * all for anything a person adds. A television typed in by hand had no place to be.
 *
 * So the projection happens **once**, at the moment of an import, and is written down. From then on this
 * file is what is being edited and the bytes beside it are what the remote said on the day it was read.
 *
 * The price is stated rather than hidden: the two can drift apart. That is already recorded as the known
 * seam in `docs/data-model.md`, and it is the direct consequence of importing rather than synchronising.
 * A document knows when it was imported, so a screen can say how old the agreement is.
 *
 * Every change goes through `editContent`, so there is one writer. Two writers of one file is the state
 * the sibling repository's oldest rule is about, and here it would show up as an edit landing on top of
 * a stale read.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { RemoteContent } from '../shared/content.ts';
import type { RemoteStore } from './store/remotes.ts';

const CONTENT = 'content.json';

function fileFor(store: RemoteStore, name: string): string {
  return join(store.folderOf(name), CONTENT);
}

/**
 * What a document holds, or `undefined` because nothing has been written for it yet.
 *
 * `undefined` has one meaning and it is narrow: **this file is not there**. It does not mean the document
 * is empty and it does not mean the import failed. Callers that have configuration bytes fall back to
 * projecting them, which is what carries the documents written before this file existed; callers that
 * have nothing have nothing.
 */
export async function storedContentOf(
  store: RemoteStore, name: string,
): Promise<RemoteContent | undefined> {
  try {
    return JSON.parse(await readFile(fileFor(store, name), 'utf8')) as RemoteContent;
  } catch {
    return undefined;
  }
}

/**
 * Write a document's contents, whether that is an import landing or an edit being saved.
 *
 * Deliberately not called `save`: there is no dirty state anywhere in this application and adding one
 * would invite a screen that holds unwritten work. Every change is written when it is made.
 */
export async function writeContent(
  store: RemoteStore, name: string, content: RemoteContent,
): Promise<RemoteContent> {
  // `store.get` first, so writing contents for a document that does not exist fails the same way every
  // other operation on a missing document fails, rather than creating a stray file in a folder.
  await store.get(name);
  await writeFile(fileFor(store, name), `${JSON.stringify(content, undefined, 2)}\n`, 'utf8');
  return content;
}

/**
 * Change a document's contents: read, apply, write.
 *
 * The one route every edit takes, which is what makes the read and the write impossible to get out of
 * order. It refuses on a document with nothing in it rather than inventing an empty one, because an empty
 * `RemoteContent` is a claim about somebody's equipment and the honest answer for a document nobody has
 * imported into is that there is nothing to change.
 */
export async function editContent(
  store: RemoteStore, name: string, change: (content: RemoteContent) => RemoteContent,
): Promise<RemoteContent> {
  const held = await storedContentOf(store, name);
  if (held === undefined) throw new Error(`${name} has no contents to change yet`);
  return writeContent(store, name, change(held));
}

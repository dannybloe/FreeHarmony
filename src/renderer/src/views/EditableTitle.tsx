/**
 * A heading you can rename in place: double click it, or press the pencil that appears on hover.
 *
 * **One component and not two**, which is the reason it exists as a file. The remote's page had this
 * behaviour written into it and a device's page needed the same thing on 22 August 2026, and two copies of
 * an interaction are two copies until one of them moves: this project's oldest rule, learned on an opcode
 * table and then again on a date field. So the remote page now asks for this too, and the pencil Danny
 * asked for arrived on both pages in one edit rather than one.
 *
 * **The pencil is not decoration, it is the discoverability half.** Double clicking a title is fast and
 * invisible: nothing on the screen says it can be done. The pencil says it, and it stays out of the way
 * until the pointer is near, which is why it fades in rather than sitting there permanently.
 *
 * It keeps `refuse` as a function rather than validating anything itself, because the two callers disagree
 * about the empty string: a remote must have a name and refuses it, and a device position's label is
 * optional and clearing it is a real thing to want. So the rule belongs to whoever owns the field.
 */
import { TextInput, Title } from '@mantine/core';
import { useState } from 'react';

import { PencilGlyph } from './Glyphs.tsx';
import classes from './EditableTitle.module.scss';

interface EditableTitleProps {
  /** What is shown. */
  readonly value: string;
  /**
   * What the field starts with, where that is not what is shown.
   *
   * A device position shows the library's name for the appliance when it has no label of its own, and
   * typing over that name would silently turn somebody else's name into your own label. So the field opens
   * empty there, and the placeholder shows what it will keep saying if it is left that way.
   */
  readonly draft?: string;
  readonly placeholder?: string;
  /** Why this cannot be the new name, shown under the field, or `undefined` to accept it. */
  readonly refuse?: (typed: string) => string | undefined;
  readonly onCommit: (to: string) => void;
  /** What the heading looks like, which belongs to the page and not here. */
  readonly className?: string | undefined;
}

export function EditableTitle({
  value, draft, placeholder, refuse, onCommit, className,
}: EditableTitleProps) {
  const [typed, setTyped] = useState<string | undefined>(undefined);

  const refusal = typed === undefined || typed === '' ? undefined : refuse?.(typed);
  const accept = () => {
    const was = typed;
    setTyped(undefined);
    if (was === undefined || refusal !== undefined) return;
    // Only when it is a change. The commonest way out of an open field is to click elsewhere without
    // having typed anything, and that must not write a file.
    if (was.trim() !== (draft ?? value)) onCommit(was.trim());
  };

  if (typed !== undefined) {
    return (
      <TextInput
        size="md"
        autoFocus
        value={typed}
        error={refusal}
        {...(placeholder === undefined ? {} : { placeholder })}
        onChange={(event) => setTyped(event.currentTarget.value)}
        onBlur={accept}
        onKeyDown={(event) => {
          if (event.key === 'Enter') accept();
          if (event.key === 'Escape') setTyped(undefined);
        }}
      />
    );
  }

  const open = () => setTyped(draft ?? value);

  return (
    <div className={classes.row}>
      <Title
        order={2}
        className={className === undefined ? classes.title : `${classes.title} ${className}`}
        title="double click to rename"
        onDoubleClick={open}
      >
        {value}
      </Title>
      {/* A real button, so it is reachable by keyboard and announces itself. That is also the whole
          accessible route to renaming: a double click is not one, and it was the only route before this. */}
      <button type="button" className={classes.pencil} aria-label={`Rename ${value}`} onClick={open}>
        <PencilGlyph size={15} />
      </button>
    </div>
  );
}

import { Extension, InputRule } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

/**
 * Typora-style table creation: type a GFM delimiter row (`| --- | --- |`)
 * directly under a pipe header row and the two paragraphs become a table.
 */

/** Split a pipe row into trimmed cell texts (`a | b` and `| a | b |` both work). */
export function parsePipeRow(text: string): string[] {
  let t = text.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

const DELIM_CELL = /^:?-+:?$/;

/**
 * If `text` is a full GFM delimiter row, return its cells (used for column
 * count/validation). Returns null for anything else. Alignment colons are
 * accepted but currently dropped — the schema has no cell alignment.
 */
export function parseDelimiterRow(text: string): string[] | null {
  const t = text.trim();
  if (!t.includes('-') || !t.includes('|')) return null;
  const cells = parsePipeRow(t);
  if (cells.length === 0) return null;
  for (const c of cells) {
    if (!DELIM_CELL.test(c)) return null;
  }
  return cells;
}

export const TableFromPipes = Extension.create({
  name: 'tableFromPipes',

  addInputRules() {
    return [
      new InputRule({
        // Candidate delimiter row before the cursor; the handler validates
        find: /^\|?[\s:|-]*-+[\s:|-]*$/,
        handler: ({ state, match }) => {
          const { $from } = state.selection;
          const para = $from.parent;
          if (para.type.name !== 'paragraph') return;

          // Only convert once the row is complete: the matched text must end
          // with the closing pipe and the cursor must be at the block end —
          // otherwise the rule fires mid-row and later keystrokes would land
          // inside the new table's first cell
          if (!match[0].trimEnd().endsWith('|')) return;
          if ($from.parentOffset !== para.textContent.length) return;

          // The whole block must be the delimiter row (guards against
          // converting when typing mid-paragraph)
          const delimCells = parseDelimiterRow(para.textContent);
          if (!delimCells) return;

          // The block directly above must be the header pipe row with the
          // same column count
          const before = $from.before();
          const prev = state.doc.resolve(before).nodeBefore;
          if (prev?.type.name !== 'paragraph') return;
          if (!prev.textContent.includes('|')) return;
          const headerCells = parsePipeRow(prev.textContent);
          const cols = delimCells.length;
          if (headerCells.length !== cols) return;

          const schema = state.schema;
          const cellPara = (text: string) =>
            schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
          const header = schema.nodes.tableRow.create(
            null,
            headerCells.map((c) => schema.nodes.tableHeader.create(null, cellPara(c))),
          );
          const body = schema.nodes.tableRow.create(
            null,
            Array.from({ length: cols }, () => schema.nodes.tableCell.create(null, cellPara(''))),
          );
          const table = schema.nodes.table.create(null, [header, body]);

          try {
            const tableStart = before - prev.nodeSize;
            const tr = state.tr.replaceWith(tableStart, $from.after(), table);
            // Cursor into the first body cell
            tr.setSelection(TextSelection.near(tr.doc.resolve(tableStart + header.nodeSize + 2)));
          } catch {
            // Structure rejected by the schema — leave the text as typed
          }
        },
      }),
    ];
  },
});

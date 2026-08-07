import { Extension } from '@tiptap/core';
import type { Mark } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Typora-style live preview: the block under the cursor reveals its raw
 * markdown markers (heading hashes, ** * ~~ ` and [link](url) delimiters)
 * while every other block stays fully rendered. Markers are decorations —
 * visible, but not part of the editable document.
 */

function markSyntax(mark: Mark): { open: string; close: string } | null {
  switch (mark.type.name) {
    case 'bold':
      return { open: '**', close: '**' };
    case 'italic':
      return { open: '*', close: '*' };
    case 'strike':
      return { open: '~~', close: '~~' };
    case 'code':
      return { open: '`', close: '`' };
    case 'link':
      return { open: '[', close: `](${mark.attrs.href ?? ''})` };
    default:
      return null;
  }
}

function markerEl(text: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'tl-syntax';
  span.textContent = text;
  return span;
}

function buildDecorations(state: EditorState): DecorationSet {
  const { $from } = state.selection;
  const block = $from.parent;
  if (!block.isTextblock) return DecorationSet.empty;

  const decorations: Decoration[] = [];

  // Heading prefix: "# ", "## ", "### "
  if (block.type.name === 'heading') {
    const level = Number(block.attrs.level) || 1;
    decorations.push(
      Decoration.widget($from.before() + 1, () => markerEl(`${'#'.repeat(level)} `), {
        side: -1,
        ignoreSelection: true,
      }),
    );
  }

  // Inline mark delimiters, placed at the edges of each contiguous marked range
  const start = $from.start();
  const children: { node: (typeof block.children)[number]; pos: number }[] = [];
  block.forEach((node, offset) => {
    children.push({ node, pos: start + offset });
  });

  children.forEach(({ node, pos }, i) => {
    for (const mark of node.marks) {
      const syntax = markSyntax(mark);
      if (!syntax) continue;
      const prev = children[i - 1]?.node;
      const next = children[i + 1]?.node;
      if (!prev?.marks.some((m) => mark.eq(m))) {
        decorations.push(
          Decoration.widget(pos, () => markerEl(syntax.open), { side: -1, ignoreSelection: true }),
        );
      }
      if (!next?.marks.some((m) => mark.eq(m))) {
        decorations.push(
          Decoration.widget(pos + node.nodeSize, () => markerEl(syntax.close), {
            side: 1,
            ignoreSelection: true,
          }),
        );
      }
    }
  });

  return DecorationSet.create(state.doc, decorations);
}

export const LivePreview = Extension.create({
  name: 'livePreview',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('livePreview'),
        props: {
          decorations: (state) => buildDecorations(state),
        },
      }),
    ];
  },
});

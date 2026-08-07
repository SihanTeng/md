import { mergeAttributes, Node } from '@tiptap/core';
import { decodeComment, encodeComment } from '../../lib/markdown/comments';

/**
 * Editor-side half of HTML comment preservation (see lib/markdown/comments).
 * Placeholder `<div/span data-tl-comment>` elements parse into atom nodes;
 * node views render the comment as a muted chip while renderHTML re-emits
 * the placeholder form so the turndown rule in io.ts can restore the exact
 * `<!-- ... -->` text on save.
 */

const commentAttribute = {
  comment: {
    default: '',
    parseHTML: (element: HTMLElement) =>
      decodeComment(element.getAttribute('data-tl-comment') ?? ''),
    renderHTML: (attributes: Record<string, unknown>) => ({
      'data-tl-comment': encodeComment(String(attributes.comment ?? '')),
    }),
  },
};

function commentChip(tag: 'div' | 'span', className: string) {
  return ({ node }: { node: { attrs: Record<string, unknown> } }) => {
    const dom = document.createElement(tag);
    dom.className = className;
    dom.contentEditable = 'false';
    dom.textContent = String(node.attrs.comment ?? '');
    return { dom };
  };
}

export const MdCommentBlock = Node.create({
  name: 'mdCommentBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return commentAttribute;
  },

  parseHTML() {
    return [{ tag: 'div[data-tl-comment]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // The zero-width space payload keeps turndown's blank rule from
    // deleting the element before our rule can restore the comment
    return ['div', mergeAttributes(HTMLAttributes, { class: 'tl-comment-block' }), '\u200b'];
  },

  addNodeView() {
    return commentChip('div', 'tl-comment tl-comment-block');
  },
});

export const MdCommentInline = Node.create({
  name: 'mdCommentInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return commentAttribute;
  },

  parseHTML() {
    return [{ tag: 'span[data-tl-comment]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'tl-comment-inline' }), '\u200b'];
  },

  addNodeView() {
    return commentChip('span', 'tl-comment tl-comment-inline');
  },
});

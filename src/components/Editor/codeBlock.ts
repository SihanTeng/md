import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import type { Node } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { createLowlight } from 'lowlight';

type Lowlight = ReturnType<typeof createLowlight>;

/**
 * Code block with syntax highlighting and an editable language badge
 * (top-right). Typing ```lang + Enter sets the language at creation
 * (Obsidian-style); clicking the badge edits it afterwards.
 */
export function createCodeBlock(lowlight: Lowlight) {
  return CodeBlockLowlight.extend({
    addNodeView() {
      return ({
        node,
        view,
        getPos,
      }: {
        node: Node;
        view: EditorView;
        getPos: () => number | undefined;
      }) => {
        let currentNode = node;

        const pre = document.createElement('pre');
        pre.className = 'tl-code-block';
        const code = document.createElement('code');
        if (node.attrs.language) code.className = `language-${node.attrs.language}`;
        pre.appendChild(code);

        const badge = document.createElement('input');
        badge.className = 'cb-lang';
        badge.value = node.attrs.language ?? 'text';
        badge.spellcheck = false;
        badge.title = 'Click to set language';
        badge.setAttribute('aria-label', 'Code block language');
        pre.appendChild(badge);

        const commit = () => {
          const raw = badge.value.trim().toLowerCase();
          const language = raw === 'text' || raw === '' ? null : raw;
          badge.value = language ?? 'text';
          const pos = getPos();
          if (language !== currentNode.attrs.language && pos != null) {
            view.dispatch(
              view.state.tr.setNodeMarkup(pos, undefined, {
                ...currentNode.attrs,
                language,
              }),
            );
          }
        };

        badge.addEventListener('click', () => {
          badge.focus();
          badge.select();
        });
        badge.addEventListener('blur', commit);
        badge.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            badge.blur();
          } else if (e.key === 'Escape') {
            badge.value = currentNode.attrs.language ?? 'text';
            badge.blur();
          }
        });

        return {
          dom: pre,
          contentDOM: code,
          update: (updated) => {
            if (updated.type.name !== 'codeBlock') return false;
            currentNode = updated;
            code.className = updated.attrs.language ? `language-${updated.attrs.language}` : '';
            if (document.activeElement !== badge) {
              badge.value = updated.attrs.language ?? 'text';
            }
            return true;
          },
          // Badge edits are not document content — keep PM out of them
          ignoreMutation: (mutation) => !code.contains(mutation.target),
          stopEvent: (event) => event.target === badge,
        };
      };
    },
  }).configure({
    lowlight,
    HTMLAttributes: {
      class: 'tl-code-block',
    },
  });
}

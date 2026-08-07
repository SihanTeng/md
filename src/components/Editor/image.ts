import Image from '@tiptap/extension-image';
import { resolveImageSrc } from '../../lib/images';
import { openHref } from '../../lib/openHref';

/** Parse `![alt](src)` markdown back into attributes; null if it doesn't match. */
export function parseImageMarkdown(text: string): { alt: string; src: string } | null {
  const m = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/.exec(text.trim());
  return m ? { alt: m[1], src: m[2] } : null;
}

/**
 * Typora-style image: renders as rich media, but selecting it reveals the
 * raw markdown source (`![alt](assets/pic.png)` — the canonical asset path,
 * never the resolved URL) in an editable bar. Ctrl/Cmd+click reveals the
 * file in the system file manager. getHTML() uses the schema serializer,
 * not this node view, so saving always writes the original src.
 */
export function createImage() {
  return Image.extend({
    addNodeView() {
      return ({ node, view, getPos }) => {
        let currentNode = node;

        const dom = document.createElement('div');
        dom.className = 'tl-image';
        const img = document.createElement('img');
        const input = document.createElement('input');
        input.className = 'tl-image-src';
        input.spellcheck = false;
        input.setAttribute('aria-label', 'Image source (markdown)');
        dom.append(img, input);

        const rawMarkdown = (attrs: Record<string, unknown>) =>
          `![${typeof attrs.alt === 'string' ? attrs.alt : ''}](${typeof attrs.src === 'string' ? attrs.src : ''})`;

        const sync = (attrs: Record<string, unknown>) => {
          const src = typeof attrs.src === 'string' ? attrs.src : '';
          img.src = resolveImageSrc(src);
          if (typeof attrs.alt === 'string') img.setAttribute('alt', attrs.alt);
          if (typeof attrs.title === 'string') img.setAttribute('title', attrs.title);
          // Embedded data URIs are uneditable as text — show a placeholder
          const embedded = src.startsWith('data:');
          input.readOnly = embedded;
          input.value = embedded
            ? `![${attrs.alt ?? ''}](embedded image data)`
            : rawMarkdown(attrs);
        };
        sync(node.attrs);

        // Ctrl/Cmd+click: reveal the asset in the system file manager
        // (openHref routes file paths to revealItemInDir, URLs to the browser)
        img.addEventListener('click', (e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          const src = typeof currentNode.attrs.src === 'string' ? currentNode.attrs.src : '';
          if (src) void openHref(src);
        });

        const commit = () => {
          if (input.readOnly) return;
          const parsed = parseImageMarkdown(input.value);
          const pos = getPos();
          if (parsed && pos != null) {
            view.dispatch(
              view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...parsed }),
            );
          } else {
            sync(currentNode.attrs); // revert invalid source
          }
        };
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          } else if (e.key === 'Escape') {
            sync(currentNode.attrs);
            input.blur();
          }
        });
        input.addEventListener('blur', commit);

        return {
          dom,
          update: (updated) => {
            if (updated.type.name !== 'image') return false;
            currentNode = updated;
            sync(updated.attrs);
            return true;
          },
          // Source-bar edits are not document content — keep PM out of them
          ignoreMutation: () => true,
          stopEvent: (event) => event.target === input,
        };
      };
    },
  }).configure({
    // data: URIs are how images embed in unsaved documents
    allowBase64: true,
  });
}

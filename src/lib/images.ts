import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import type { EditorView } from '@tiptap/pm/view';
import { useDocumentStore } from '../stores/documentStore';
import { dirNameFromPath, saveImageAsset } from './tauri/files';

/**
 * Image persistence architecture — one rule for every paste path:
 *
 *   image bytes that enter the document  →  assets/ file (saved docs)
 *                                        →  data: URI (unsaved docs, no dir yet)
 *   remote http(s): image references     →  stay links, by design
 *   session-scoped blob: URLs            →  never reach the document
 *
 * Both paste paths (clipboard files, and HTML clipboards carrying images)
 * funnel through `persistImageBytes`, so naming (`pastedImageName`) and the
 * assets-vs-embed decision live in exactly one place.
 */

/**
 * Map a markdown image reference to an absolute filesystem path.
 * Returns null for references that need no local resolution (URLs, data
 * URIs) and for relative paths when no document directory is known.
 */
export function absoluteImagePath(src: string, docDir: string | null): string | null {
  if (/^(data:|blob:|https?:|asset:|file:)/i.test(src)) return null;
  if (/^(\/|[A-Za-z]:[/\\])/.test(src)) return src;
  if (!docDir) return null;
  return `${docDir}/${src}`;
}

/**
 * Turn a markdown image reference into something the webview can load.
 * The document always stores the markdown-canonical form (relative path,
 * absolute path, data/http URL); only the display side resolves it.
 */
export function resolveImageSrc(src: string): string {
  if (!src) return src;
  if (!isTauri()) return src;
  const docPath = useDocumentStore.getState().path;
  const docDir = docPath ? dirNameFromPath(docPath) : null;
  const abs = absoluteImagePath(src, docDir);
  return abs ? convertFileSrc(abs) : src;
}

/** ArrayBuffer → base64 without blowing the call stack on large files. */
export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Sensible name for a pasted image: clipboard name, else timestamp + mime ext. */
export function pastedImageName(file: { name?: string; type: string }): string {
  if (file.name && file.name !== 'image.png') return file.name;
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  return `pasted-${stamp}.${ext}`;
}

/**
 * The single persistence rule. Saved documents store the bytes in
 * `<doc dir>/assets/` and reference the relative path; unsaved ones embed a
 * data URI so nothing is lost (no document directory exists yet).
 */
async function persistImageBytes(data: {
  name?: string;
  type: string;
  bytes: ArrayBuffer;
}): Promise<string> {
  const docPath = useDocumentStore.getState().path;
  if (docPath && isTauri()) {
    return saveImageAsset(
      dirNameFromPath(docPath),
      pastedImageName(data),
      arrayBufferToBase64(data.bytes),
    );
  }
  return `data:${data.type || 'image/png'};base64,${arrayBufferToBase64(data.bytes)}`;
}

/**
 * Paste path 1 — an image file on the clipboard (screenshots, file-manager
 * copies). Persist the bytes, then insert the image node at the selection.
 */
export async function pasteImageIntoEditor(view: EditorView, file: File): Promise<void> {
  const src = await persistImageBytes({
    name: file.name,
    type: file.type,
    bytes: await file.arrayBuffer(),
  });
  const alt = file.name.replace(/\.[^.]+$/, '') || 'image';
  const node = view.state.schema.nodes.image.create({ src, alt });
  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
}

/** base64 decode → ArrayBuffer (inverse of arrayBufferToBase64). */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

/**
 * Sync pre-check for handlePaste: does this HTML clipboard carry images we
 * must localize (session-scoped blob:, or embeddable data: when assets are
 * possible)? If false, the default ProseMirror HTML paste is fine.
 */
export function needsImageLocalization(html: string): boolean {
  if (html.includes('blob:')) return true;
  const docPath = useDocumentStore.getState().path;
  return !!docPath && isTauri() && html.includes('data:image/');
}

/**
 * Paste path 2 — an HTML clipboard carrying images. Every image whose bytes
 * are reachable goes through the same persistImageBytes rule as a file
 * paste: blob: URLs (which would die with the webview session) are fetched,
 * and data: URIs become asset files when a document directory exists.
 * Remote http(s): images intentionally stay links; unreachable blobs are
 * left untouched. Returns the rewritten HTML for the caller to insert.
 */
export async function localizeHtmlImages(html: string): Promise<string> {
  // data: images only need rewriting when they can become asset files
  const docPath = useDocumentStore.getState().path;
  const canMakeAssets = !!docPath && isTauri();
  const dom = new window.DOMParser().parseFromString(html, 'text/html');
  const imgs = Array.from(dom.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') ?? '';
      try {
        if (src.startsWith('blob:')) {
          const blob = await (await fetch(src)).blob();
          img.setAttribute(
            'src',
            await persistImageBytes({ type: blob.type, bytes: await blob.arrayBuffer() }),
          );
        } else if (canMakeAssets && src.startsWith('data:image/')) {
          const match = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(src);
          if (!match) return;
          img.setAttribute(
            'src',
            await persistImageBytes({
              type: match[1],
              bytes: base64ToArrayBuffer(match[2]),
            }),
          );
        }
      } catch {
        // Dead blob or malformed data URI — keep the original src
      }
    }),
  );
  return dom.body.innerHTML;
}

import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import type { EditorView } from '@tiptap/pm/view';
import { useDocumentStore } from '../stores/documentStore';
import { dirNameFromPath, saveImageAsset } from './tauri/files';

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
 * absolute path, data/blob/http URL); only the display side resolves it.
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

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Sensible name for a pasted image: clipboard name, else timestamp + mime ext. */
export function pastedImageName(file: File): string {
  if (file.name && file.name !== 'image.png') return file.name;
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  return `pasted-${stamp}.${ext}`;
}

/**
 * Insert a pasted image file at the selection. Saved documents store the
 * bytes in `<doc dir>/assets/` and reference the relative path; unsaved
 * ones embed a data URI so nothing is lost.
 */
export async function pasteImageIntoEditor(view: EditorView, file: File): Promise<void> {
  const docPath = useDocumentStore.getState().path;
  let src: string;
  if (docPath && isTauri()) {
    const buf = await file.arrayBuffer();
    src = await saveImageAsset(
      dirNameFromPath(docPath),
      pastedImageName(file),
      arrayBufferToBase64(buf),
    );
  } else {
    src = await fileToDataUrl(file);
  }
  const alt = file.name.replace(/\.[^.]+$/, '') || 'image';
  const node = view.state.schema.nodes.image.create({ src, alt });
  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
}

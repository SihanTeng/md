import { isTauri } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { useDocumentStore } from '../stores/documentStore';

// Absolute POSIX path, home-relative path, Windows drive path, or file:// URL
const FILE_PATH_PATTERN = /^(\/|~[/\\]|[A-Za-z]:[/\\]|file:\/\/)/;
// Anything with a URI scheme (https:, mailto:, tel:, data:, …)
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

function isFilePathHref(href: string): boolean {
  return FILE_PATH_PATTERN.test(href);
}

/** Relative link like `./notes.md` or `../docs/x.md`, resolved against the open file's dir. */
function resolveRelativeHref(href: string): string | null {
  if (SCHEME_PATTERN.test(href) || href.startsWith('#')) return null;
  const docPath = useDocumentStore.getState().path;
  if (!docPath) return null;
  const dir = docPath.replace(/[/\\][^/\\]*$/, '');
  return `${dir}/${href}`;
}

/**
 * If the character at `offset` in `text` is part of a file-path-looking
 * token (whitespace-delimited, punctuation trimmed), return that token.
 */
export function filePathAt(text: string, offset: number): string | null {
  let start = offset;
  let end = offset;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  while (end < text.length && !/\s/.test(text[end])) end++;
  const token = text.slice(start, end).replace(/^[(<"']+|[)\].,;:"'>]+$/g, '');
  return isFilePathHref(token) ? token : null;
}

function fileUrlToPath(href: string): string {
  try {
    let p = decodeURIComponent(new URL(href).pathname);
    // Windows file URLs parse as "/C:/…" — drop the leading slash
    if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
    return p;
  } catch {
    return href;
  }
}

/**
 * Open a link target: file paths reveal in the system file manager,
 * web/mail links open in the default browser. No-op outside Tauri.
 */
export async function openHref(href: string): Promise<void> {
  if (!isTauri()) return;
  try {
    if (isFilePathHref(href)) {
      let path = href.startsWith('file://') ? fileUrlToPath(href) : href;
      // revealItemInDir does not expand "~" — resolve it ourselves
      if (/^~[/\\]/.test(path)) {
        path = (await homeDir()) + path.slice(2);
      }
      await revealItemInDir(path);
    } else if (/^(https?:|mailto:|tel:)/i.test(href)) {
      await openUrl(href);
    } else {
      const resolved = resolveRelativeHref(href);
      if (resolved) await revealItemInDir(resolved);
    }
  } catch (err) {
    console.error(`Failed to open link: ${href}`, err);
  }
}

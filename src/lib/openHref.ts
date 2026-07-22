import { isTauri } from '@tauri-apps/api/core';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';

// Absolute POSIX path, home-relative path, Windows drive path, or file:// URL
const FILE_PATH_PATTERN = /^(\/|~[/\\]|[A-Za-z]:[/\\]|file:\/\/)/;

export function isFilePathHref(href: string): boolean {
  return FILE_PATH_PATTERN.test(href);
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
      const path = href.startsWith('file://') ? fileUrlToPath(href) : href;
      await revealItemInDir(path);
    } else if (/^(https?:|mailto:|tel:)/i.test(href)) {
      await openUrl(href);
    }
  } catch (err) {
    console.error(`Failed to open link: ${href}`, err);
  }
}

import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';
import type { Editor } from '@tiptap/react';
import { useCallback, useMemo } from 'react';
import { buildExportHtmlDocument } from '../lib/export';
import { markdownToDocxBase64, type ResolvedImage } from '../lib/markdown/docx';
import { joinFrontmatter, splitFrontmatter } from '../lib/markdown/frontmatter';
import { fileNameFromPath, htmlToMarkdown, markdownToHtml } from '../lib/markdown/io';
import { isLinux } from '../lib/platform';
import {
  clearRecent,
  dirNameFromPath,
  exportPdfToFile,
  fileMtime,
  listRecent,
  loadSession,
  pickDirectory,
  pickExportDocxPath,
  pickExportHtmlPath,
  pickExportPdfPath,
  pickOpenPath,
  pickSavePath,
  printWindow,
  pushRecent,
  readBinaryFileBase64,
  readTextFile,
  removeRecent,
  renameFile,
  saveSession,
  writeBinaryFile,
  writeTextFile,
} from '../lib/tauri/files';
import { useDocumentStore } from '../stores/documentStore';

async function setWindowTitle(title: string, dirty: boolean) {
  try {
    await getCurrentWindow().setTitle(dirty ? `• ${title}` : title);
  } catch {
    document.title = dirty ? `• ${title}` : title;
  }
}

/** Merge a patch into the persisted session (best-effort, fire-and-forget). */
function persistSession(patch: { filePath?: string | null; workspace?: string | null }) {
  const s = useDocumentStore.getState();
  void saveSession({
    filePath: patch.filePath !== undefined ? patch.filePath : s.path,
    workspace: patch.workspace !== undefined ? patch.workspace : s.workspace,
  }).catch(() => {
    /* not in Tauri */
  });
}

/**
 * "Discard unsaved changes?" guard. window.confirm is unreliable in the
 * macOS webview, so go through the native dialog plugin when inside Tauri.
 */
export async function confirmDiscard(): Promise<boolean> {
  if (!isTauri()) return window.confirm('Discard unsaved changes?');
  try {
    return await ask('Discard unsaved changes?', {
      title: 'Unsaved changes',
      kind: 'warning',
      okLabel: 'Discard',
      cancelLabel: 'Cancel',
    });
  } catch {
    return false;
  }
}

/** Current document body as markdown (editor-first, store fallback). */
function currentBodyMarkdown(editor: Editor | null): string {
  if (editor) return htmlToMarkdown(editor.getHTML());
  return useDocumentStore.getState().contentMarkdown;
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Word can only embed these — webp/svg/avif exports drop the image. */
function docxImageType(name: string): ResolvedImage['type'] | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/)?.[1] ?? '';
  if (ext === 'png' || ext === 'gif' || ext === 'bmp') return ext;
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  return null;
}

/** Max content width on a Word page ≈ 6.5in at 96dpi. */
const DOCX_MAX_IMAGE_WIDTH = 624;

async function docxImageSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

/**
 * Image resolver for the DOCX export: local files (relative to the
 * document's folder) and data: URIs from pasted images. Remote URLs and
 * formats Word can't embed are dropped (the lib falls back to alt text).
 */
async function resolveExportImage(src: string, docDir: string | null) {
  try {
    let bytes: Uint8Array;
    let type: ResolvedImage['type'] | null;
    let dataUrl: string;
    if (src.startsWith('data:')) {
      const mime = src.slice(5, src.indexOf(';'));
      type = docxImageType(`.${mime.split('/')[1] ?? ''}`);
      if (!type) return null;
      bytes = base64ToBytes(src.slice(src.indexOf(',') + 1));
      dataUrl = src;
    } else {
      if (!docDir || /^(https?:)?\/\//i.test(src)) return null;
      type = docxImageType(src);
      if (!type) return null;
      const full = src.startsWith('/') ? src : `${docDir}/${src}`;
      const b64 = await readBinaryFileBase64(full);
      bytes = base64ToBytes(b64);
      dataUrl = `data:image/${type === 'jpg' ? 'jpeg' : type};base64,${b64}`;
    }
    const size = await docxImageSize(dataUrl);
    if (!size) return null;
    const scale = Math.min(1, DOCX_MAX_IMAGE_WIDTH / size.width);
    return {
      data: bytes,
      type,
      width: Math.round(size.width * scale),
      height: Math.round(size.height * scale),
    };
  } catch {
    return null;
  }
}

export function useDocumentActions(editor: Editor | null) {
  const path = useDocumentStore((s) => s.path);
  const title = useDocumentStore((s) => s.title);
  const dirty = useDocumentStore((s) => s.dirty);
  const hasDocument = useDocumentStore((s) => s.hasDocument);
  const setPath = useDocumentStore((s) => s.setPath);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const setDirty = useDocumentStore((s) => s.setDirty);
  const setHasDocument = useDocumentStore((s) => s.setHasDocument);
  const setContentMarkdown = useDocumentStore((s) => s.setContentMarkdown);
  const setRecent = useDocumentStore((s) => s.setRecent);
  const setError = useDocumentStore((s) => s.setError);
  const setPresentOpen = useDocumentStore((s) => s.setPresentOpen);
  const setIsOpening = useDocumentStore((s) => s.setIsOpening);
  const setIsSaving = useDocumentStore((s) => s.setIsSaving);
  const setLastSavedAt = useDocumentStore((s) => s.setLastSavedAt);
  const setWorkspace = useDocumentStore((s) => s.setWorkspace);
  const setSidebarMode = useDocumentStore((s) => s.setSidebarMode);
  const setFileMtime = useDocumentStore((s) => s.setFileMtime);
  const loadDocument = useDocumentStore((s) => s.loadDocument);

  const refreshRecent = useCallback(async () => {
    try {
      const list = await listRecent();
      setRecent(list);
    } catch {
      // ignore when not in Tauri
    }
  }, [setRecent]);

  const loadFromPath = useCallback(
    async (filePath: string) => {
      try {
        setError(null);
        const text = await readTextFile(filePath);
        // Frontmatter is split off and stored verbatim — marked would parse
        // the `---` delimiters as horizontal rules and destroy it on save
        const { frontmatter, body } = splitFrontmatter(text);
        const html = markdownToHtml(body);
        const name = fileNameFromPath(filePath);
        loadDocument({ path: filePath, title: name, markdown: body, html, frontmatter });
        setFileMtime(await fileMtime(filePath).catch(() => null));
        const recent = await pushRecent(filePath);
        setRecent(recent);
        await setWindowTitle(name, false);
        persistSession({ filePath });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [loadDocument, setError, setFileMtime, setRecent],
  );

  const openWorkspace = useCallback(async () => {
    try {
      setError(null);
      const dir = await pickDirectory();
      if (!dir) return;
      setWorkspace(dir);
      setSidebarMode('files');
      persistSession({ workspace: dir });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [setError, setSidebarMode, setWorkspace]);

  /** Restore the last-opened file / workspace from the previous session. */
  const restoreSession = useCallback(async () => {
    try {
      const session = await loadSession();
      if (session.workspace) setWorkspace(session.workspace);
      if (session.filePath) {
        await loadFromPath(session.filePath);
        // File was moved/deleted since last session — forget it instead of
        // failing on every launch
        if (useDocumentStore.getState().error) {
          persistSession({ filePath: null });
        }
      } else if (session.workspace) {
        setSidebarMode('files');
      }
    } catch {
      // not in Tauri, or session unreadable — start empty
    }
  }, [loadFromPath, setSidebarMode, setWorkspace]);

  const newDocument = useCallback(async () => {
    if (dirty && !(await confirmDiscard())) return;
    loadDocument({
      title: 'Untitled',
      markdown: '',
      html: '<p></p>',
      path: null,
    });
    setError(null);
    await setWindowTitle('Untitled', false);
  }, [dirty, loadDocument, setError]);

  const openDocument = useCallback(async () => {
    if (dirty && !(await confirmDiscard())) return;
    if (useDocumentStore.getState().isOpening) return;
    try {
      setIsOpening(true);
      const filePath = await pickOpenPath();
      if (!filePath) {
        setIsOpening(false);
        return;
      }
      await loadFromPath(filePath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsOpening(false);
    }
  }, [dirty, loadFromPath, setError, setIsOpening]);

  const saveDocument = useCallback(async () => {
    // Re-entrancy guard, mirroring openDocument's isOpening: without it, a
    // second trigger (repeat tick, double-click) stacked another save dialog.
    if (useDocumentStore.getState().isSaving) return;
    setIsSaving(true);
    try {
      setError(null);
      const body = currentBodyMarkdown(editor);
      const md = joinFrontmatter(useDocumentStore.getState().frontmatter, body);
      let dest = path;
      if (!dest) {
        dest = await pickSavePath(`${title.endsWith('.md') ? title : `${title}.md`}`);
        if (!dest) return;
      }
      // Edits landing while the write is in flight bump editTick — only clear
      // the dirty flag when the saved content is still current
      const tickAtWrite = useDocumentStore.getState().editTick;
      await writeTextFile(dest, md.endsWith('\n') ? md : `${md}\n`);
      setFileMtime(await fileMtime(dest).catch(() => null));
      const name = fileNameFromPath(dest);
      const stillDirty = useDocumentStore.getState().editTick !== tickAtWrite;
      setPath(dest);
      setTitle(name);
      setContentMarkdown(body);
      setDirty(stillDirty);
      setHasDocument(true);
      setLastSavedAt(Date.now());
      const recent = await pushRecent(dest);
      setRecent(recent);
      await setWindowTitle(name, stillDirty);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  }, [
    editor,
    path,
    setContentMarkdown,
    setDirty,
    setError,
    setFileMtime,
    setHasDocument,
    setIsSaving,
    setLastSavedAt,
    setPath,
    setRecent,
    setTitle,
    title,
  ]);

  const saveDocumentAs = useCallback(async () => {
    // Same re-entrancy guard as saveDocument — it opens the same dialog.
    if (useDocumentStore.getState().isSaving) return;
    setIsSaving(true);
    try {
      setError(null);
      const body = currentBodyMarkdown(editor);
      const md = joinFrontmatter(useDocumentStore.getState().frontmatter, body);
      const dest = await pickSavePath(path ?? `${title.endsWith('.md') ? title : `${title}.md`}`);
      if (!dest) return;
      const tickAtWrite = useDocumentStore.getState().editTick;
      await writeTextFile(dest, md.endsWith('\n') ? md : `${md}\n`);
      setFileMtime(await fileMtime(dest).catch(() => null));
      const name = fileNameFromPath(dest);
      const stillDirty = useDocumentStore.getState().editTick !== tickAtWrite;
      setPath(dest);
      setTitle(name);
      setContentMarkdown(body);
      setDirty(stillDirty);
      setLastSavedAt(Date.now());
      const recent = await pushRecent(dest);
      setRecent(recent);
      await setWindowTitle(name, stillDirty);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  }, [
    editor,
    path,
    setContentMarkdown,
    setDirty,
    setError,
    setFileMtime,
    setIsSaving,
    setLastSavedAt,
    setPath,
    setRecent,
    setTitle,
    title,
  ]);

  const openRecent = useCallback(
    async (filePath: string) => {
      if (dirty && !(await confirmDiscard())) return;
      await loadFromPath(filePath);
    },
    [dirty, loadFromPath],
  );

  /**
   * External-change detection (Typora/ghostwriter behavior): on window focus,
   * compare the file's mtime against the last load/save. Clean documents
   * reload silently; dirty ones ask before discarding edits.
   */
  const checkExternalChange = useCallback(async () => {
    const s = useDocumentStore.getState();
    if (!s.path || s.isOpening || !isTauri()) return;
    try {
      const mtime = await fileMtime(s.path);
      if (s.fileMtime == null || mtime === s.fileMtime) return;
      setFileMtime(mtime);
      if (!s.dirty) {
        await loadFromPath(s.path);
        return;
      }
      const reload = await ask(`"${s.title}" changed on disk. Reload it and discard your edits?`, {
        title: 'File changed on disk',
        kind: 'warning',
        okLabel: 'Reload',
        cancelLabel: 'Keep my changes',
      });
      if (reload) await loadFromPath(s.path);
    } catch {
      // File moved/deleted/unreadable — leave the in-memory document alone
    }
  }, [loadFromPath, setFileMtime]);

  /** Export the current document as a standalone styled HTML file. */
  const exportHtml = useCallback(async () => {
    try {
      setError(null);
      const s = useDocumentStore.getState();
      const base = s.title.replace(/\.(md|markdown|mdown|txt)$/i, '') || 'Untitled';
      const dest = await pickExportHtmlPath(`${base}.html`);
      if (!dest) return;
      const bodyHtml = markdownToHtml(currentBodyMarkdown(editor));
      await writeTextFile(dest, buildExportHtmlDocument(base, bodyHtml));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [editor, setError]);

  /**
   * Export to PDF. Linux writes the file directly via WebKitGTK's
   * print-to-file operation (no print dialog); macOS/Windows keep the
   * system print dialog, whose "Save as PDF" is the native path there.
   */
  const exportPdf = useCallback(async () => {
    try {
      setError(null);
      if (!isLinux) {
        await printWindow();
        return;
      }
      const s = useDocumentStore.getState();
      const base = s.title.replace(/\.(md|markdown|mdown|txt)$/i, '') || 'Untitled';
      const dest = await pickExportPdfPath(`${base}.pdf`);
      if (!dest) return;
      await exportPdfToFile(dest);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [setError]);

  /** Export the current document as a Word (.docx) file. */
  const exportDocx = useCallback(async () => {
    try {
      setError(null);
      const s = useDocumentStore.getState();
      const base = s.title.replace(/\.(md|markdown|mdown|txt)$/i, '') || 'Untitled';
      const dest = await pickExportDocxPath(`${base}.docx`);
      if (!dest) return;
      const docDir = s.path ? dirNameFromPath(s.path) : null;
      const base64 = await markdownToDocxBase64(currentBodyMarkdown(editor), (src) =>
        resolveExportImage(src, docDir),
      );
      await writeBinaryFile(dest, base64);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [editor, setError]);

  /** Copy the rendered document to the clipboard as rich HTML. */
  const copyHtml = useCallback(async () => {
    try {
      setError(null);
      const bodyHtml = buildExportHtmlDocument('', markdownToHtml(currentBodyMarkdown(editor)));
      const plain = currentBodyMarkdown(editor);
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([bodyHtml], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(bodyHtml);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [editor, setError]);

  /**
   * Rename the current document (Obsidian-style inline title edit).
   * Saved files are renamed on disk; unsaved ones just take the new title,
   * which becomes the default save name.
   */
  const renameDocument = useCallback(
    async (newName: string) => {
      const cleaned = newName.trim().replace(/[/\\]/g, '');
      if (!cleaned) return;
      const fileName = /\.(md|markdown|mdown|txt)$/i.test(cleaned) ? cleaned : `${cleaned}.md`;
      if (fileName === title) return;
      try {
        setError(null);
        if (path) {
          const dest = `${dirNameFromPath(path)}/${fileName}`;
          if (dest !== path) {
            await renameFile(path, dest);
            await removeRecent(path);
            const recent = await pushRecent(dest);
            setRecent(recent);
            setPath(dest);
            persistSession({ filePath: dest });
          }
        }
        setTitle(fileName);
        await setWindowTitle(fileName, useDocumentStore.getState().dirty);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [path, setError, setPath, setRecent, setTitle, title],
  );

  const present = useCallback(() => {
    if (!hasDocument) return;
    setPresentOpen(true);
  }, [hasDocument, setPresentOpen]);

  const clearRecentFiles = useCallback(async () => {
    try {
      await clearRecent();
      setRecent([]);
    } catch {
      /* noop */
    }
  }, [setRecent]);

  const hideRecent = useCallback(
    async (path: string) => {
      try {
        setRecent(await removeRecent(path));
      } catch {
        /* noop */
      }
    },
    [setRecent],
  );

  const syncTitle = useCallback(async () => {
    await setWindowTitle(title, dirty);
  }, [dirty, title]);

  // Memoized as a unit: App effects depend on `actions`, so a fresh object
  // every render would re-run listeners/IPC on every keystroke
  return useMemo(
    () => ({
      newDocument,
      openDocument,
      openWorkspace,
      restoreSession,
      saveDocument,
      saveDocumentAs,
      openRecent,
      renameDocument,
      present,
      refreshRecent,
      clearRecentFiles,
      hideRecent,
      syncTitle,
      loadFromPath,
      loadDocument,
      checkExternalChange,
      exportHtml,
      exportPdf,
      exportDocx,
      copyHtml,
    }),
    [
      newDocument,
      openDocument,
      openWorkspace,
      restoreSession,
      saveDocument,
      saveDocumentAs,
      openRecent,
      renameDocument,
      present,
      refreshRecent,
      clearRecentFiles,
      hideRecent,
      syncTitle,
      loadFromPath,
      loadDocument,
      checkExternalChange,
      exportHtml,
      exportPdf,
      exportDocx,
      copyHtml,
    ],
  );
}

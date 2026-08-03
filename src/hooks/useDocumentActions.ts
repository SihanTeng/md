import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';
import type { Editor } from '@tiptap/react';
import { useCallback, useMemo } from 'react';
import { buildExportHtmlDocument } from '../lib/export';
import { joinFrontmatter, splitFrontmatter } from '../lib/markdown/frontmatter';
import { fileNameFromPath, htmlToMarkdown, markdownToHtml } from '../lib/markdown/io';
import {
  clearRecent,
  dirNameFromPath,
  fileMtime,
  listRecent,
  loadSession,
  pickDirectory,
  pickExportHtmlPath,
  pickOpenPath,
  pickSavePath,
  printWindow,
  pushRecent,
  readTextFile,
  removeRecent,
  renameFile,
  saveSession,
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
      const recent = await pushRecent(dest);
      setRecent(recent);
      await setWindowTitle(name, stillDirty);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [
    editor,
    path,
    setContentMarkdown,
    setDirty,
    setError,
    setFileMtime,
    setHasDocument,
    setPath,
    setRecent,
    setTitle,
    title,
  ]);

  const saveDocumentAs = useCallback(async () => {
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
      const recent = await pushRecent(dest);
      setRecent(recent);
      await setWindowTitle(name, stillDirty);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [
    editor,
    path,
    setContentMarkdown,
    setDirty,
    setError,
    setFileMtime,
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

  /** Export to PDF via the system print dialog ("Save as PDF"). */
  const exportPdf = useCallback(async () => {
    try {
      setError(null);
      await printWindow();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [setError]);

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
      copyHtml,
    ],
  );
}

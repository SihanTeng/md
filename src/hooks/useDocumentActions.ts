import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Editor } from '@tiptap/react';
import { useCallback } from 'react';
import { fileNameFromPath, htmlToMarkdown, markdownToHtml } from '../lib/markdown/io';
import {
  clearRecent,
  dirNameFromPath,
  listRecent,
  loadSession,
  pickDirectory,
  pickOpenPath,
  pickSavePath,
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

export function useDocumentActions(editor: Editor | null) {
  const path = useDocumentStore((s) => s.path);
  const title = useDocumentStore((s) => s.title);
  const dirty = useDocumentStore((s) => s.dirty);
  const contentMarkdown = useDocumentStore((s) => s.contentMarkdown);
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
        const html = markdownToHtml(text);
        const name = fileNameFromPath(filePath);
        loadDocument({ path: filePath, title: name, markdown: text, html });
        const recent = await pushRecent(filePath);
        setRecent(recent);
        await setWindowTitle(name, false);
        persistSession({ filePath });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [loadDocument, setError, setRecent],
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
    if (dirty) {
      const ok = window.confirm('Discard unsaved changes?');
      if (!ok) return;
    }
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
    if (dirty) {
      const ok = window.confirm('Discard unsaved changes?');
      if (!ok) return;
    }
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
      const md = editor != null ? htmlToMarkdown(editor.getHTML()) : contentMarkdown;
      let dest = path;
      if (!dest) {
        dest = await pickSavePath(`${title.endsWith('.md') ? title : `${title}.md`}`);
        if (!dest) return;
      }
      await writeTextFile(dest, md.endsWith('\n') ? md : `${md}\n`);
      const name = fileNameFromPath(dest);
      setPath(dest);
      setTitle(name);
      setContentMarkdown(md);
      setDirty(false);
      setHasDocument(true);
      const recent = await pushRecent(dest);
      setRecent(recent);
      await setWindowTitle(name, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [
    contentMarkdown,
    editor,
    path,
    setContentMarkdown,
    setDirty,
    setError,
    setHasDocument,
    setPath,
    setRecent,
    setTitle,
    title,
  ]);

  const saveDocumentAs = useCallback(async () => {
    try {
      setError(null);
      const md = editor != null ? htmlToMarkdown(editor.getHTML()) : contentMarkdown;
      const dest = await pickSavePath(path ?? `${title.endsWith('.md') ? title : `${title}.md`}`);
      if (!dest) return;
      await writeTextFile(dest, md.endsWith('\n') ? md : `${md}\n`);
      const name = fileNameFromPath(dest);
      setPath(dest);
      setTitle(name);
      setContentMarkdown(md);
      setDirty(false);
      const recent = await pushRecent(dest);
      setRecent(recent);
      await setWindowTitle(name, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [
    contentMarkdown,
    editor,
    path,
    setContentMarkdown,
    setDirty,
    setError,
    setPath,
    setRecent,
    setTitle,
    title,
  ]);

  const openRecent = useCallback(
    async (filePath: string) => {
      if (dirty) {
        const ok = window.confirm('Discard unsaved changes?');
        if (!ok) return;
      }
      await loadFromPath(filePath);
    },
    [dirty, loadFromPath],
  );

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

  const syncTitle = useCallback(async () => {
    await setWindowTitle(title, dirty);
  }, [dirty, title]);

  return {
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
    syncTitle,
    loadFromPath,
    loadDocument,
  };
}

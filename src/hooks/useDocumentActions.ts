import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Editor } from "@tiptap/react";
import {
  clearRecent,
  listRecent,
  pickOpenPath,
  pickSavePath,
  pushRecent,
  readTextFile,
  writeTextFile,
} from "../lib/tauri/files";
import { fileNameFromPath, htmlToMarkdown, markdownToHtml } from "../lib/markdown/io";
import { useDocumentStore } from "../stores/documentStore";

async function setWindowTitle(title: string, dirty: boolean) {
  try {
    await getCurrentWindow().setTitle(dirty ? `• ${title}` : title);
  } catch {
    document.title = dirty ? `• ${title}` : title;
  }
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
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [loadDocument, setError, setRecent],
  );

  const newDocument = useCallback(async () => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes?");
      if (!ok) return;
    }
    loadDocument({
      title: "Untitled",
      markdown: "",
      html: "<p></p>",
      path: null,
    });
    setError(null);
    await setWindowTitle("Untitled", false);
  }, [dirty, loadDocument, setError]);

  const openDocument = useCallback(async () => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes?");
      if (!ok) return;
    }
    try {
      const filePath = await pickOpenPath();
      if (!filePath) return;
      await loadFromPath(filePath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dirty, loadFromPath, setError]);

  const saveDocument = useCallback(async () => {
    try {
      setError(null);
      const md =
        editor != null ? htmlToMarkdown(editor.getHTML()) : contentMarkdown;
      let dest = path;
      if (!dest) {
        dest = await pickSavePath(`${title.endsWith(".md") ? title : `${title}.md`}`);
        if (!dest) return;
      }
      await writeTextFile(dest, md.endsWith("\n") ? md : `${md}\n`);
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
      const md =
        editor != null ? htmlToMarkdown(editor.getHTML()) : contentMarkdown;
      const dest = await pickSavePath(
        path ?? `${title.endsWith(".md") ? title : `${title}.md`}`,
      );
      if (!dest) return;
      await writeTextFile(dest, md.endsWith("\n") ? md : `${md}\n`);
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
        const ok = window.confirm("Discard unsaved changes?");
        if (!ok) return;
      }
      await loadFromPath(filePath);
    },
    [dirty, loadFromPath],
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
    saveDocument,
    saveDocumentAs,
    openRecent,
    present,
    refreshRecent,
    clearRecentFiles,
    syncTitle,
    loadFromPath,
    loadDocument,
  };
}

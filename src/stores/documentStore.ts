import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

export interface OutlineItem {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  pos: number;
}

export interface RecentFile {
  path: string;
  name: string;
}

interface DocumentState {
  path: string | null;
  title: string;
  contentMarkdown: string;
  contentHtml: string;
  revision: number;
  dirty: boolean;
  hasDocument: boolean;
  wordCount: number;
  charCount: number;
  outline: OutlineItem[];
  recent: RecentFile[];
  theme: ThemeMode;
  presentOpen: boolean;
  sidebarOpen: boolean;
  error: string | null;

  setPath: (path: string | null) => void;
  setTitle: (title: string) => void;
  setContentMarkdown: (md: string) => void;
  setDirty: (dirty: boolean) => void;
  setHasDocument: (v: boolean) => void;
  setCounts: (words: number, chars: number) => void;
  setOutline: (items: OutlineItem[]) => void;
  setRecent: (files: RecentFile[]) => void;
  setTheme: (theme: ThemeMode) => void;
  setPresentOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setError: (error: string | null) => void;
  loadDocument: (opts: {
    title?: string;
    markdown?: string;
    html?: string;
    path?: string | null;
  }) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  path: null,
  title: "Untitled",
  contentMarkdown: "",
  contentHtml: "<p></p>",
  revision: 0,
  dirty: false,
  hasDocument: false,
  wordCount: 0,
  charCount: 0,
  outline: [],
  recent: [],
  theme: "system",
  presentOpen: false,
  sidebarOpen: true,
  error: null,

  setPath: (path) => set({ path }),
  setTitle: (title) => set({ title }),
  setContentMarkdown: (contentMarkdown) => set({ contentMarkdown }),
  setDirty: (dirty) => set({ dirty }),
  setHasDocument: (hasDocument) => set({ hasDocument }),
  setCounts: (wordCount, charCount) => set({ wordCount, charCount }),
  setOutline: (outline) => set({ outline }),
  setRecent: (recent) => set({ recent }),
  setTheme: (theme) => set({ theme }),
  setPresentOpen: (presentOpen) => set({ presentOpen }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setError: (error) => set({ error }),
  loadDocument: (opts) =>
    set((s) => ({
      path: opts.path ?? null,
      title: opts.title ?? "Untitled",
      contentMarkdown: opts.markdown ?? "",
      contentHtml: opts.html ?? "<p></p>",
      revision: s.revision + 1,
      dirty: false,
      hasDocument: true,
      outline: [],
      wordCount: 0,
      charCount: 0,
      error: null,
    })),
}));

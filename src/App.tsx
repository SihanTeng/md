import { listen } from '@tauri-apps/api/event';
import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useState } from 'react';
import { MarkdownEditor } from './components/Editor/MarkdownEditor';
import { EmptyState } from './components/EmptyState';
import { PresentOverlay } from './components/Present/PresentOverlay';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { useDocumentActions } from './hooks/useDocumentActions';
import { markdownToHtml } from './lib/markdown/io';
import { applyThemeClass, loadThemePreference, saveThemePreference } from './lib/theme';
import { checkForUpdates } from './lib/updater';
import { useDocumentStore } from './stores/documentStore';

const STARTER_MD = `# Welcome to md

A calm, macOS-inspired markdown editor.

## Write naturally

Select text and use the toolbar — or keyboard shortcuts — to format.

- Bullet lists
- **Bold** and *italic*
- \`inline code\`

### Tasks

- [x] Open the app
- [ ] Write something great

## Present

Press **⌘⇧P** (or **Ctrl+Shift+P**) to present slides from your headings.
`;

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const hasDocument = useDocumentStore((s) => s.hasDocument);
  const contentHtml = useDocumentStore((s) => s.contentHtml);
  const revision = useDocumentStore((s) => s.revision);
  const presentOpen = useDocumentStore((s) => s.presentOpen);
  const setPresentOpen = useDocumentStore((s) => s.setPresentOpen);
  const theme = useDocumentStore((s) => s.theme);
  const setTheme = useDocumentStore((s) => s.setTheme);
  const autoSave = useDocumentStore((s) => s.autoSave);
  const dirty = useDocumentStore((s) => s.dirty);
  const docPath = useDocumentStore((s) => s.path);
  const contentMarkdown = useDocumentStore((s) => s.contentMarkdown);

  const actions = useDocumentActions(editor);

  const startWithWelcomeDoc = useCallback(() => {
    actions.loadDocument({
      title: 'Untitled',
      markdown: STARTER_MD,
      html: markdownToHtml(STARTER_MD),
      path: null,
    });
  }, [actions]);

  // Theme bootstrap
  useEffect(() => {
    const pref = loadThemePreference();
    setTheme(pref);
    applyThemeClass(pref);
  }, [setTheme]);

  useEffect(() => {
    applyThemeClass(theme);
    saveThemePreference(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme === 'system') applyThemeClass('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // Window title sync
  const { syncTitle } = actions;
  useEffect(() => {
    void syncTitle();
  }, [syncTitle]);

  // Recent files
  useEffect(() => {
    void actions.refreshRecent();
  }, [actions]);

  // Restore last-opened file / workspace from the previous session
  const { restoreSession } = actions;
  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  // Silent update check on launch (manual checks come from the File menu)
  useEffect(() => {
    void checkForUpdates();
  }, []);

  // Auto-save: write 2s after the last edit, only for files that already
  // have a path (untitled docs wait for an explicit save-as)
  const { saveDocument } = actions;
  // biome-ignore lint/correctness/useExhaustiveDependencies: contentMarkdown is the debounce trigger — each keystroke resets the timer
  useEffect(() => {
    if (!autoSave || !dirty || !docPath) return;
    const timer = setTimeout(() => {
      void saveDocument();
    }, 2000);
    return () => clearTimeout(timer);
  }, [autoSave, dirty, docPath, contentMarkdown, saveDocument]);

  // Native menu events from Rust
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>('menu', (event) => {
      switch (event.payload) {
        case 'file_new':
          if (!useDocumentStore.getState().hasDocument) {
            startWithWelcomeDoc();
          } else {
            void actions.newDocument();
          }
          break;
        case 'file_open':
          void actions.openDocument();
          break;
        case 'file_save':
          void actions.saveDocument();
          break;
        case 'file_save_as':
          void actions.saveDocumentAs();
          break;
        case 'view_present':
          actions.present();
          break;
        case 'app_check_updates':
          void checkForUpdates(true);
          break;
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        /* not in Tauri */
      });
    return () => unlisten?.();
  }, [actions, startWithWelcomeDoc]);

  // Global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'n' && !e.shiftKey) {
        e.preventDefault();
        if (!useDocumentStore.getState().hasDocument) {
          startWithWelcomeDoc();
        } else {
          void actions.newDocument();
        }
      } else if (key === 'o' && !e.shiftKey) {
        e.preventDefault();
        void actions.openDocument();
      } else if (key === 's' && e.shiftKey) {
        e.preventDefault();
        void actions.saveDocumentAs();
      } else if (key === 's' && !e.shiftKey) {
        e.preventDefault();
        void actions.saveDocument();
      } else if (key === 'p' && e.shiftKey) {
        e.preventDefault();
        actions.present();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, startWithWelcomeDoc]);

  const onReady = useCallback((ed: Editor) => {
    setEditor(ed);
  }, []);

  const showEmpty = !hasDocument;

  const handleNew = useCallback(() => {
    if (showEmpty) {
      startWithWelcomeDoc();
      return;
    }
    void actions.newDocument();
  }, [actions, showEmpty, startWithWelcomeDoc]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--color-bg)]">
      <Sidebar editor={editor} onOpenRecent={actions.openRecent} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          editor={editor}
          onNew={handleNew}
          onOpen={() => void actions.openDocument()}
          onSave={() => void actions.saveDocument()}
          onPresent={() => actions.present()}
        />

        <main className="min-h-0 flex-1" style={{ background: 'var(--color-editor-bg)' }}>
          {showEmpty ? (
            <EmptyState
              onNew={startWithWelcomeDoc}
              onOpen={() => void actions.openDocument()}
              onOpenFolder={() => void actions.openWorkspace()}
            />
          ) : (
            <MarkdownEditor
              key={revision}
              initialHtml={contentHtml}
              onReady={onReady}
              onRename={(name) => void actions.renameDocument(name)}
            />
          )}
        </main>

        <StatusBar />
      </div>

      {presentOpen ? (
        <PresentOverlay editor={editor} onClose={() => setPresentOpen(false)} />
      ) : null}
    </div>
  );
}

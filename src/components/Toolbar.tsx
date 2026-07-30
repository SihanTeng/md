import { isTauri } from '@tauri-apps/api/core';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  FilePlus,
  FolderOpen,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Moon,
  PanelLeft,
  Presentation,
  Quote,
  Save,
  Sun,
  Table,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { fileNameFromPath } from '../lib/markdown/io';
import {
  dirNameFromPath,
  importImage,
  pickImagePath,
  readBinaryFileBase64,
} from '../lib/tauri/files';
import { resolveDark } from '../lib/theme';
import { useDocumentStore } from '../stores/documentStore';

interface Props {
  editor: Editor | null;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onPresent: () => void;
}

function ToolButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors',
        'text-[var(--color-ink-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]',
        'disabled:opacity-40 disabled:pointer-events-none',
        active ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-4 w-px bg-[var(--color-hairline)]" aria-hidden />;
}

export function Toolbar({ editor, onNew, onOpen, onSave, onPresent }: Props) {
  const theme = useDocumentStore((s) => s.theme);
  const setTheme = useDocumentStore((s) => s.setTheme);
  const sidebarOpen = useDocumentStore((s) => s.sidebarOpen);
  const setSidebarOpen = useDocumentStore((s) => s.setSidebarOpen);
  const dirty = useDocumentStore((s) => s.dirty);
  const isOpening = useDocumentStore((s) => s.isOpening);
  const isDark = resolveDark(theme);

  // Re-render on editor transactions so the isActive() highlights follow
  // cursor and selection — nothing else re-renders this toolbar per edit
  const [, bump] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    if (!editor) return;
    editor.on('transaction', bump);
    return () => {
      editor.off('transaction', bump);
    };
  }, [editor]);

  // Inline link editor — window.prompt is unreliable in the macOS webview
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.select();
  }, [linkOpen]);

  const openLinkEditor = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    setLinkValue(prev ?? 'https://');
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkValue.trim();
    if (editor) {
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      }
    }
    setLinkOpen(false);
  };

  // Image upload: saved documents copy the file into `<doc dir>/assets/`
  // and reference it relatively; unsaved ones embed a data URI
  const insertImage = async () => {
    if (!editor || !isTauri()) return;
    try {
      const srcPath = await pickImagePath();
      if (!srcPath) return;
      const alt = fileNameFromPath(srcPath).replace(/\.[^.]+$/, '');
      const docPath = useDocumentStore.getState().path;
      if (docPath) {
        const rel = await importImage(srcPath, dirNameFromPath(docPath));
        editor.chain().focus().setImage({ src: rel, alt }).run();
      } else {
        const b64 = await readBinaryFileBase64(srcPath);
        const ext = srcPath.split('.').pop()?.toLowerCase() ?? 'png';
        editor
          .chain()
          .focus()
          .setImage({ src: `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${b64}`, alt })
          .run();
      }
    } catch (e) {
      useDocumentStore.getState().setError(e instanceof Error ? e.message : String(e));
    }
  };

  const icon = 15;

  return (
    <div
      className="flex h-[var(--toolbar-height)] shrink-0 items-center gap-0.5 border-b border-[var(--color-hairline)] px-2 print:hidden"
      style={{ background: 'var(--color-toolbar)' }}
    >
      <ToolButton
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <PanelLeft size={icon} strokeWidth={1.75} />
      </ToolButton>

      <Divider />

      <ToolButton title="New (⌘N)" onClick={onNew}>
        <FilePlus size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton title="Open (⌘O)" disabled={isOpening} onClick={onOpen}>
        <FolderOpen size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton title={dirty ? 'Save (⌘S) · unsaved' : 'Save (⌘S)'} onClick={onSave}>
        <Save size={icon} strokeWidth={1.75} />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Bold"
        disabled={!editor}
        active={!!editor?.isActive('bold')}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Italic"
        disabled={!editor}
        active={!!editor?.isActive('italic')}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Underline"
        disabled={!editor}
        active={!!editor?.isActive('underline')}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={icon} strokeWidth={1.75} />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Heading 1"
        disabled={!editor}
        active={!!editor?.isActive('heading', { level: 1 })}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Heading 2"
        disabled={!editor}
        active={!!editor?.isActive('heading', { level: 2 })}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Heading 3"
        disabled={!editor}
        active={!!editor?.isActive('heading', { level: 3 })}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={icon} strokeWidth={1.75} />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Bullet list"
        disabled={!editor}
        active={!!editor?.isActive('bulletList')}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Numbered list"
        disabled={!editor}
        active={!!editor?.isActive('orderedList')}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Task list"
        disabled={!editor}
        active={!!editor?.isActive('taskList')}
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <ListTodo size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Quote"
        disabled={!editor}
        active={!!editor?.isActive('blockquote')}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Code block"
        disabled={!editor}
        active={!!editor?.isActive('codeBlock')}
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      >
        <Code size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Insert table (or type | --- | under a pipe row)"
        disabled={!editor}
        active={!!editor?.isActive('table')}
        onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 2 }).run()}
      >
        <Table size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton title="Insert image…" disabled={!editor} onClick={() => void insertImage()}>
        <ImageIcon size={icon} strokeWidth={1.75} />
      </ToolButton>
      <div className="relative">
        <ToolButton title="Link" disabled={!editor} active={linkOpen} onClick={openLinkEditor}>
          <LinkIcon size={icon} strokeWidth={1.75} />
        </ToolButton>
        {linkOpen ? (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: click-catcher that dismisses the popover; Escape is handled by the input */}
            <div className="fixed inset-0 z-40" onClick={() => setLinkOpen(false)} />
            <div className="absolute left-0 top-full z-50 mt-1 flex w-64 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-popover)]">
              <input
                ref={linkInputRef}
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setLinkOpen(false);
                    editor?.commands.focus();
                  }
                }}
                placeholder="https://"
                spellCheck={false}
                aria-label="Link URL (empty to remove)"
                className="h-7 min-w-0 flex-1 rounded-[var(--radius-sm)] bg-transparent px-2 text-[12.5px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-tertiary)]"
              />
              <button
                type="button"
                onClick={applyLink}
                className="h-7 shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-2 text-[12px] font-medium text-white hover:brightness-105"
              >
                {linkValue.trim() === '' ? 'Remove' : 'Apply'}
              </button>
            </div>
          </>
        ) : null}
      </div>
      <ToolButton
        title="Horizontal rule"
        disabled={!editor}
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={icon} strokeWidth={1.75} />
      </ToolButton>

      <div className="flex-1" />

      <ToolButton title="Present (⌘⇧P)" onClick={onPresent}>
        <Presentation size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title={isDark ? 'Light mode' : 'Dark mode'}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? <Sun size={icon} strokeWidth={1.75} /> : <Moon size={icon} strokeWidth={1.75} />}
      </ToolButton>
    </div>
  );
}

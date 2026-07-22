import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Link as LinkIcon,
  Minus,
  Presentation,
  Moon,
  Sun,
  PanelLeft,
  FilePlus,
  FolderOpen,
  Save,
} from "lucide-react";
import { useDocumentStore } from "../stores/documentStore";
import { resolveDark } from "../lib/theme";

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
        "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors",
        "text-[var(--color-ink-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]",
        "disabled:opacity-40 disabled:pointer-events-none",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      className="mx-1 h-4 w-px bg-[var(--color-hairline)]"
      aria-hidden
    />
  );
}

export function Toolbar({ editor, onNew, onOpen, onSave, onPresent }: Props) {
  const theme = useDocumentStore((s) => s.theme);
  const setTheme = useDocumentStore((s) => s.setTheme);
  const sidebarOpen = useDocumentStore((s) => s.sidebarOpen);
  const setSidebarOpen = useDocumentStore((s) => s.setSidebarOpen);
  const dirty = useDocumentStore((s) => s.dirty);
  const isDark = resolveDark(theme);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const icon = 15;

  return (
    <div
      className="flex h-[var(--toolbar-height)] shrink-0 items-center gap-0.5 border-b border-[var(--color-hairline)] px-2"
      style={{ background: "var(--color-toolbar)" }}
    >
      <ToolButton
        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <PanelLeft size={icon} strokeWidth={1.75} />
      </ToolButton>

      <Divider />

      <ToolButton title="New (⌘N)" onClick={onNew}>
        <FilePlus size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton title="Open (⌘O)" onClick={onOpen}>
        <FolderOpen size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton title={dirty ? "Save (⌘S) · unsaved" : "Save (⌘S)"} onClick={onSave}>
        <Save size={icon} strokeWidth={1.75} />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Bold"
        disabled={!editor}
        active={!!editor?.isActive("bold")}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Italic"
        disabled={!editor}
        active={!!editor?.isActive("italic")}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Underline"
        disabled={!editor}
        active={!!editor?.isActive("underline")}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={icon} strokeWidth={1.75} />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Heading 1"
        disabled={!editor}
        active={!!editor?.isActive("heading", { level: 1 })}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Heading 2"
        disabled={!editor}
        active={!!editor?.isActive("heading", { level: 2 })}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Heading 3"
        disabled={!editor}
        active={!!editor?.isActive("heading", { level: 3 })}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={icon} strokeWidth={1.75} />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Bullet list"
        disabled={!editor}
        active={!!editor?.isActive("bulletList")}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Numbered list"
        disabled={!editor}
        active={!!editor?.isActive("orderedList")}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Task list"
        disabled={!editor}
        active={!!editor?.isActive("taskList")}
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <ListTodo size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Quote"
        disabled={!editor}
        active={!!editor?.isActive("blockquote")}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        title="Code block"
        disabled={!editor}
        active={!!editor?.isActive("codeBlock")}
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      >
        <Code size={icon} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton title="Link" disabled={!editor} onClick={setLink}>
        <LinkIcon size={icon} strokeWidth={1.75} />
      </ToolButton>
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
        title={isDark ? "Light mode" : "Dark mode"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? (
          <Sun size={icon} strokeWidth={1.75} />
        ) : (
          <Moon size={icon} strokeWidth={1.75} />
        )}
      </ToolButton>
    </div>
  );
}

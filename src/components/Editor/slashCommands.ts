import { Extension } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  type LucideIcon,
  Minus,
  Quote,
  Table,
  Type,
} from 'lucide-react';

/**
 * Notion-style "/" slash commands (modeled on ref/tolaria's BlockNote menu).
 * A state-only ProseMirror plugin tracks the `/query` token at the caret; the
 * React overlay (SlashMenuOverlay) renders the menu and intercepts keys.
 * Applying an item deletes the trigger text itself — `/` is plain text to the
 * LivePreview/ConvertOnLeave pipeline, so nothing else cleans it up.
 */

export interface SlashItem {
  id: string;
  title: string;
  /** Extra search aliases, matched like the title (substring, case-insensitive) */
  keywords: string[];
  /** Group header; rendered where it changes between consecutive items */
  section: string;
  icon: LucideIcon;
  run: (editor: Editor) => void;
}

export interface SlashState {
  active: boolean;
  /** Doc position of the '/' character */
  from: number;
  query: string;
  /** Selected row within the filtered item list */
  index: number;
  /** Position of a '/' whose menu was dismissed with Escape — stays closed
   *  while that same token is edited, cleared once it disappears */
  dismissedFrom: number | null;
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'text',
    title: 'Text',
    keywords: ['paragraph', 'plain', 'p'],
    section: 'Basic',
    icon: Type,
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: 'h1',
    title: 'Heading 1',
    keywords: ['h1', 'title', 'big', '#'],
    section: 'Basic',
    icon: Heading1,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    title: 'Heading 2',
    keywords: ['h2', 'subtitle', '##'],
    section: 'Basic',
    icon: Heading2,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    title: 'Heading 3',
    keywords: ['h3', 'subheading', '###'],
    section: 'Basic',
    icon: Heading3,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'todo',
    title: 'To-do list',
    keywords: ['task', 'checkbox', 'check', 'todo', '[]'],
    section: 'Lists',
    icon: ListTodo,
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'bullet',
    title: 'Bulleted list',
    keywords: ['bullet', 'unordered', 'ul', 'point', '-'],
    section: 'Lists',
    icon: List,
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numbered',
    title: 'Numbered list',
    keywords: ['ordered', 'ol', 'number', '1.'],
    section: 'Lists',
    icon: ListOrdered,
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'quote',
    title: 'Quote',
    keywords: ['blockquote', 'citation', '>'],
    section: 'Blocks',
    icon: Quote,
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'code',
    title: 'Code block',
    keywords: ['code', 'pre', 'snippet', '```'],
    section: 'Blocks',
    icon: Code,
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'divider',
    title: 'Divider',
    keywords: ['horizontal', 'rule', 'hr', 'separator', 'line', '---'],
    section: 'Blocks',
    icon: Minus,
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'table',
    title: 'Table',
    keywords: ['table', 'grid', 'rows', 'columns'],
    section: 'Blocks',
    icon: Table,
    run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 2 }).run(),
  },
];

/** Substring match on title + aliases — same rule as BlockNote's filterSuggestionItems. */
export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}

/**
 * A `/` at the start of a textblock or after whitespace, followed by an
 * unbroken query, up to the caret — like `@tiptap/suggestion`'s default
 * `allow` check. Code blocks are excluded: slashes are literal there.
 */
export function detectSlash(state: EditorState): { from: number; query: string } | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;
  if ($from.parent.type.name === 'codeBlock') return null;
  const textBefore = $from.parent.textBetween(0, $from.parentOffset);
  const match = /(?:^|\s)\/([^\s/]{0,32})$/.exec(textBefore);
  if (!match) return null;
  return { from: selection.from - match[1].length - 1, query: match[1] };
}

const INACTIVE: SlashState = {
  active: false,
  from: 0,
  query: '',
  index: 0,
  dismissedFrom: null,
};

interface SlashMeta {
  index?: number;
  close?: boolean;
}

export const slashCommandsKey = new PluginKey<SlashState>('slashCommands');

const slashCommandsPlugin = new Plugin<SlashState>({
  key: slashCommandsKey,
  state: {
    init: () => INACTIVE,
    apply(tr, value, _oldState, newState) {
      const meta = tr.getMeta(slashCommandsKey) as SlashMeta | undefined;
      const hit = detectSlash(newState);
      if (meta?.close) {
        return { ...INACTIVE, dismissedFrom: value.active ? value.from : (hit?.from ?? null) };
      }
      if (!hit) return INACTIVE;
      // Escaped out of this token: keep the menu closed while it is edited
      if (hit.from === value.dismissedFrom) {
        return { ...INACTIVE, dismissedFrom: value.dismissedFrom };
      }
      let index = value.active && value.query === hit.query ? value.index : 0;
      if (meta?.index !== undefined) index = meta.index;
      return { active: true, from: hit.from, query: hit.query, index, dismissedFrom: null };
    },
  },
});

export const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [slashCommandsPlugin];
  },
});

export function slashState(editor: Editor): SlashState {
  return slashCommandsKey.getState(editor.state) ?? INACTIVE;
}

export function setSlashIndex(editor: Editor, index: number) {
  editor.view.dispatch(editor.state.tr.setMeta(slashCommandsKey, { index }));
}

/** Move the selection by `dir` (±1), wrapping within `count` items. */
export function stepSlash(editor: Editor, dir: 1 | -1, count: number) {
  if (count <= 0) return;
  const st = slashState(editor);
  setSlashIndex(editor, (st.index + dir + count) % count);
}

/** Close the menu (Escape); the `/query` text stays in the document. */
export function closeSlashMenu(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(slashCommandsKey, { close: true }));
}

/**
 * Run an item (default: the selected one). Deletes the `/query` text first;
 * when the slash was typed into a non-empty block, the command gets a fresh
 * block below instead of converting the surrounding text (Notion/BlockNote
 * behavior).
 */
export function applySlashItem(editor: Editor, item?: SlashItem) {
  const st = slashState(editor);
  if (!st.active) return;
  const items = filterSlashItems(SLASH_ITEMS, st.query);
  const target = item ?? items[Math.min(st.index, items.length - 1)];
  if (!target) return;
  editor.chain().focus().deleteRange({ from: st.from, to: editor.state.selection.from }).run();
  const $from = editor.state.selection.$from;
  if ($from.parent.isTextblock && $from.parent.textContent.trim().length > 0) {
    editor.chain().splitBlock().run();
    // Swallow one space left behind by the split ("foo /h bar" → "foo " | " bar")
    const pos = editor.state.selection.from;
    if (editor.state.doc.textBetween(pos, pos + 1, '', '') === ' ') {
      editor.commands.deleteRange({ from: pos, to: pos + 1 });
    }
  }
  target.run(editor);
}

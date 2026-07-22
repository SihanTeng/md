import type { Editor } from "@tiptap/react";
import type { OutlineItem } from "../stores/documentStore";

export function buildOutline(editor: Editor | null): OutlineItem[] {
  if (!editor) return [];
  const items: OutlineItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const level = node.attrs.level as number;
      if (level >= 1 && level <= 3) {
        items.push({
          id: `h-${pos}`,
          level: level as 1 | 2 | 3,
          text: node.textContent || "Untitled",
          pos,
        });
      }
    }
  });
  return items;
}

export function scrollToPos(editor: Editor, pos: number) {
  editor.chain().focus().setTextSelection(pos + 1).run();
  const dom = editor.view.domAtPos(pos + 1);
  const el =
    dom.node instanceof HTMLElement
      ? dom.node
      : (dom.node.parentElement as HTMLElement | null);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

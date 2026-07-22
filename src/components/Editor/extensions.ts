import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import CharacterCount from "@tiptap/extension-character-count";

export function createExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: {
        HTMLAttributes: {
          class: "md-code-block",
        },
      },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "md-link",
      },
    }),
    Placeholder.configure({
      placeholder: "Start writing…",
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    CharacterCount,
  ];
}

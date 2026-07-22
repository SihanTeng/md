import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';

export function createExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: {
        HTMLAttributes: {
          class: 'md-code-block',
        },
      },
      // StarterKit ships Link — configure it here instead of adding a
      // duplicate extension. External opening is handled by the editor's
      // click handler (Ctrl/Cmd+click only).
      link: {
        openOnClick: false,
        HTMLAttributes: {
          class: 'md-link',
        },
      },
    }),
    Placeholder.configure({
      placeholder: 'Start writing…',
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    CharacterCount,
  ];
}

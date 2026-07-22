import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import { htmlToMarkdown } from '../../lib/markdown/io';
import { buildOutline } from '../../lib/outline';
import { useDocumentStore } from '../../stores/documentStore';
import { createExtensions } from './extensions';

interface Props {
  initialHtml: string;
  onReady?: (editor: Editor) => void;
}

export function MarkdownEditor({ initialHtml, onReady }: Props) {
  const setDirty = useDocumentStore((s) => s.setDirty);
  const setContentMarkdown = useDocumentStore((s) => s.setContentMarkdown);
  const setCounts = useDocumentStore((s) => s.setCounts);
  const setOutline = useDocumentStore((s) => s.setOutline);
  const readyRef = useRef(false);

  const editor = useEditor({
    extensions: createExtensions(),
    content: initialHtml || '<p></p>',
    editorProps: {
      attributes: {
        class: 'md-prose focus:outline-none',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      setDirty(true);
      const html = ed.getHTML();
      setContentMarkdown(htmlToMarkdown(html));
      const storage = ed.storage.characterCount;
      const chars = storage?.characters?.() ?? 0;
      const words = storage?.words?.() ?? 0;
      setCounts(words, chars);
      setOutline(buildOutline(ed));
    },
    onCreate: ({ editor: ed }) => {
      const storage = ed.storage.characterCount;
      setCounts(storage?.words?.() ?? 0, storage?.characters?.() ?? 0);
      setOutline(buildOutline(ed));
      setContentMarkdown(htmlToMarkdown(ed.getHTML()));
    },
  });

  useEffect(() => {
    if (editor && !readyRef.current) {
      readyRef.current = true;
      onReady?.(editor);
    }
  }, [editor, onReady]);

  return (
    <div className="mac-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[46rem] px-10 py-8">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

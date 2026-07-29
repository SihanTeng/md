import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createExtensions } from '../components/Editor/extensions';
import { lineAt } from './cursor';

function editorWith(html: string) {
  return new Editor({
    element: document.createElement('div'),
    extensions: createExtensions(),
    content: html,
  });
}

describe('lineAt', () => {
  it('counts block lines from the document start', () => {
    const editor = editorWith('<p>a</p><p>b</p><p>c</p>');
    // Positions: p(a)=0..3, p(b)=3..6, p(c)=6..9 — 4 is inside 'b'
    editor.commands.setTextSelection(4);
    expect(lineAt(editor.state)).toBe(2);
    editor.commands.setTextSelection(7);
    expect(lineAt(editor.state)).toBe(3);
    editor.destroy();
  });

  it('counts newlines inside code blocks', () => {
    const editor = editorWith('<pre><code>line1\nline2</code></pre><p>x</p>');
    // Cursor in the paragraph after the two-line code block
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(lineAt(editor.state)).toBe(3);
    editor.destroy();
  });

  it('is 1 at the start of the document', () => {
    const editor = editorWith('<p>a</p>');
    editor.commands.setTextSelection(1);
    expect(lineAt(editor.state)).toBe(1);
    editor.destroy();
  });
});

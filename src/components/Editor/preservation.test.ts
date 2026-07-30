import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from '../../lib/markdown/io';
import { createExtensions } from './extensions';

function editorWith(html: string) {
  return new Editor({
    element: document.createElement('div'),
    extensions: createExtensions(),
    content: html,
  });
}

/** Round-trip through the real editor pipeline: markdown → HTML → TipTap doc → HTML → markdown. */
function roundTrip(md: string): string {
  const editor = editorWith(markdownToHtml(md));
  const out = htmlToMarkdown(editor.getHTML());
  editor.destroy();
  return out;
}

describe('editor round-trip preservation', () => {
  it('keeps strikethrough created via markdown or toolbar', () => {
    expect(roundTrip('~~gone~~')).toBe('~~gone~~\n');
    const editor = editorWith('<p>x</p>');
    editor.chain().setTextSelection({ from: 1, to: 2 }).toggleStrike().run();
    expect(htmlToMarkdown(editor.getHTML())).toBe('~~x~~\n');
    editor.destroy();
  });

  it('keeps underline created via the toolbar', () => {
    const editor = editorWith('<p>u</p>');
    editor.chain().setTextSelection({ from: 1, to: 2 }).toggleUnderline().run();
    expect(htmlToMarkdown(editor.getHTML())).toBe('<u>u</u>\n');
    editor.destroy();
  });

  it('keeps deep headings instead of flattening them to paragraphs', () => {
    // Regression: the schema capped at level 3, so #### loaded as body text
    expect(roundTrip('#### four')).toBe('#### four\n');
    expect(roundTrip('##### five')).toBe('##### five\n');
    expect(roundTrip('###### six')).toBe('###### six\n');
  });

  it('keeps block HTML comments anchored in the document flow', () => {
    const out = roundTrip('alpha\n\n<!-- section marker -->\n\nomega\n');
    expect(out).toContain('alpha');
    expect(out).toContain('<!-- section marker -->');
    expect(out).toContain('omega');
    expect(out.indexOf('alpha')).toBeLessThan(out.indexOf('<!-- section marker -->'));
    expect(out.indexOf('<!-- section marker -->')).toBeLessThan(out.indexOf('omega'));
  });

  it('keeps inline HTML comments inside paragraphs', () => {
    expect(roundTrip('before <!-- mid --> after\n')).toBe('before <!-- mid --> after\n');
  });
});

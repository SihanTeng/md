import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from '../../lib/markdown/io';
import { createExtensions } from './extensions';
import { parseImageMarkdown } from './image';

describe('image schema round-trip', () => {
  it('keeps the canonical asset path through load and serialize', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createExtensions(),
      content: markdownToHtml('![pic](assets/pic.png)'),
    });
    const html = editor.getHTML();
    // The stored src must stay the relative path — never a resolved URL
    expect(html).toContain('src="assets/pic.png"');
    expect(html).not.toContain('asset.localhost');
    expect(htmlToMarkdown(html)).toBe('![pic](assets/pic.png)\n');
    editor.destroy();
  });

  it('keeps embedded data URIs through the schema', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createExtensions(),
      content: '<img src="data:image/png;base64,AAAA" alt="dot">',
    });
    expect(editor.getHTML()).toContain('data:image/png;base64,AAAA');
    expect(htmlToMarkdown(editor.getHTML())).toBe('![dot](data:image/png;base64,AAAA)\n');
    editor.destroy();
  });
});

describe('parseImageMarkdown', () => {
  it('parses valid image markdown', () => {
    expect(parseImageMarkdown('![alt](assets/a.png)')).toEqual({
      alt: 'alt',
      src: 'assets/a.png',
    });
    expect(parseImageMarkdown('![](x.png)')).toEqual({ alt: '', src: 'x.png' });
    expect(parseImageMarkdown('![a](https://x.com/b.png)')).toEqual({
      alt: 'a',
      src: 'https://x.com/b.png',
    });
  });

  it('rejects non-image text', () => {
    expect(parseImageMarkdown('![a](x.png')).toBeNull();
    expect(parseImageMarkdown('[a](b)')).toBeNull();
    expect(parseImageMarkdown('plain text')).toBeNull();
  });
});

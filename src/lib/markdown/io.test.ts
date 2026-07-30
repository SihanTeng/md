import { describe, expect, it } from 'vitest';
import { fileNameFromPath, htmlToMarkdown, looksLikeMarkdown, markdownToHtml } from './io';

describe('markdownToHtml', () => {
  it('returns an empty paragraph for blank input', () => {
    expect(markdownToHtml('')).toBe('<p></p>');
    expect(markdownToHtml('   \n ')).toBe('<p></p>');
  });

  it('renders headings, emphasis, and lists', () => {
    expect(markdownToHtml('# Title')).toContain('<h1>Title</h1>');
    expect(markdownToHtml('**bold** and *ital*')).toContain('<strong>bold</strong>');
    expect(markdownToHtml('**bold** and *ital*')).toContain('<em>ital</em>');
    expect(markdownToHtml('- one\n- two')).toContain('<li>one</li>');
  });
});

describe('htmlToMarkdown', () => {
  it('returns empty string for empty documents', () => {
    expect(htmlToMarkdown('')).toBe('');
    expect(htmlToMarkdown('<p></p>')).toBe('');
  });

  it('serializes headings with atx style', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toBe('# Title\n');
    expect(htmlToMarkdown('<h2>Sub</h2>')).toBe('## Sub\n');
  });

  it('serializes inline formatting', () => {
    expect(htmlToMarkdown('<p><strong>b</strong> <em>i</em> <code>c</code></p>')).toBe(
      '**b** *i* `c`\n',
    );
  });

  it('round-trips common structures', () => {
    // NB: turndown pads bullet markers to a 4-column indent
    const md = '# Doc\n\nSome **bold** text.\n\n-   one\n-   two\n';
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });

  it('round-trips strikethrough instead of dropping it', () => {
    // Regression: turndown had no strike rule, so ~~x~~ saved as plain x
    expect(htmlToMarkdown(markdownToHtml('~~gone~~'))).toBe('~~gone~~\n');
    expect(htmlToMarkdown('<p><s>x</s></p>')).toBe('~~x~~\n');
    expect(htmlToMarkdown('<p><del>x</del></p>')).toBe('~~x~~\n');
  });

  it('round-trips underline as inline HTML (Typora convention)', () => {
    expect(htmlToMarkdown('<p><u>up</u></p>')).toBe('<u>up</u>\n');
    expect(htmlToMarkdown(markdownToHtml('<u>up</u>'))).toBe('<u>up</u>\n');
  });

  it('round-trips headings of all six levels', () => {
    for (let level = 1; level <= 6; level++) {
      const md = `${'#'.repeat(level)} Title\n`;
      expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
    }
  });

  it('round-trips block and inline HTML comments verbatim', () => {
    expect(htmlToMarkdown(markdownToHtml('<!-- note -->'))).toBe('<!-- note -->\n');
    expect(htmlToMarkdown(markdownToHtml('before <!-- mid --> after'))).toBe(
      'before <!-- mid --> after\n',
    );
  });

  it('preserves comment content with quotes, angle brackets, and unicode', () => {
    const comment = '<!-- "quoted" <tags> ünïcödé -->';
    expect(htmlToMarkdown(markdownToHtml(comment))).toBe(`${comment}\n`);
  });

  it('does not mistake comment-like text inside code fences for comments', () => {
    const md = '```html\n<!-- not a comment node -->\n```\n';
    const out = htmlToMarkdown(markdownToHtml(md));
    expect(out).toContain('```html');
    expect(out).toContain('<!-- not a comment node -->');
  });
});

describe('looksLikeMarkdown', () => {
  it('detects structural markdown', () => {
    expect(looksLikeMarkdown('# Heading')).toBe(true);
    expect(looksLikeMarkdown('#### Deep heading')).toBe(true);
    expect(looksLikeMarkdown('- item')).toBe(true);
    expect(looksLikeMarkdown('1. first')).toBe(true);
    expect(looksLikeMarkdown('> quote')).toBe(true);
    expect(looksLikeMarkdown('```\ncode\n```')).toBe(true);
  });

  it('detects inline markdown', () => {
    expect(looksLikeMarkdown('a **bold** move')).toBe(true);
    expect(looksLikeMarkdown('an *italic* move')).toBe(true);
    expect(looksLikeMarkdown('some `code` here')).toBe(true);
    expect(looksLikeMarkdown('[link](https://example.com)')).toBe(true);
  });

  it('ignores plain prose', () => {
    expect(looksLikeMarkdown('Just a sentence.')).toBe(false);
    expect(looksLikeMarkdown('2 * 3 = 6')).toBe(false);
  });
});

describe('fileNameFromPath', () => {
  it('extracts the file name from posix and windows paths', () => {
    expect(fileNameFromPath('/home/u/notes/todo.md')).toBe('todo.md');
    expect(fileNameFromPath('C:\\docs\\report.md')).toBe('report.md');
  });

  it('falls back to Untitled', () => {
    expect(fileNameFromPath(null)).toBe('Untitled');
    expect(fileNameFromPath(undefined)).toBe('Untitled');
    expect(fileNameFromPath('')).toBe('Untitled');
  });
});

describe('tables', () => {
  const TABLE_MD = '| Name | Age |\n| --- | --- |\n| Ada | 36 |\n';

  it('parses GFM tables into HTML tables', () => {
    const html = markdownToHtml(TABLE_MD);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>Ada</td>');
  });

  it('serializes tables back to pipe syntax', () => {
    expect(htmlToMarkdown(markdownToHtml(TABLE_MD))).toBe(TABLE_MD);
  });

  it('escapes pipes inside cells', () => {
    expect(htmlToMarkdown('<table><tr><td>a|b</td></tr></table>')).toContain('a\\|b');
  });

  it('detects table syntax as markdown', () => {
    expect(looksLikeMarkdown(TABLE_MD)).toBe(true);
    expect(looksLikeMarkdown('| a | b |\n| --- | :---: |')).toBe(true);
  });
});

describe('images', () => {
  it('round-trips image syntax', () => {
    expect(htmlToMarkdown(markdownToHtml('![alt text](assets/pic.png)'))).toBe(
      '![alt text](assets/pic.png)\n',
    );
  });

  it('parses images into img tags', () => {
    expect(markdownToHtml('![a](b.png)')).toContain('<img src="b.png" alt="a">');
  });

  it('detects image syntax as markdown, even with empty alt', () => {
    expect(looksLikeMarkdown('![](assets/pic.png)')).toBe(true);
    expect(looksLikeMarkdown('![alt](https://x.com/p.png)')).toBe(true);
  });
});

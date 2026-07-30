import { describe, expect, it } from 'vitest';
import { joinFrontmatter, splitFrontmatter } from './frontmatter';
import { htmlToMarkdown, markdownToHtml } from './io';

describe('splitFrontmatter', () => {
  it('splits a standard frontmatter block from the body', () => {
    const raw = '---\ntitle: Test\ntags: [a, b]\n---\n# Hello\n';
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toBe('---\ntitle: Test\ntags: [a, b]\n---\n');
    expect(body).toBe('# Hello\n');
  });

  it('returns null frontmatter when there is none', () => {
    expect(splitFrontmatter('# Hello\n')).toEqual({ frontmatter: null, body: '# Hello\n' });
  });

  it('preserves an empty frontmatter block', () => {
    const raw = '---\n---\nbody\n';
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toBe('---\n---\n');
    expect(body).toBe('body\n');
  });

  it('does not treat a leading horizontal rule as frontmatter', () => {
    // No closing delimiter on its own line
    expect(splitFrontmatter('---\njust a paragraph\n').frontmatter).toBeNull();
  });

  it('only matches at the very start of the file', () => {
    expect(splitFrontmatter('\n---\ntitle: x\n---\nbody\n').frontmatter).toBeNull();
  });

  it('handles CRLF line endings', () => {
    const raw = '---\r\ntitle: x\r\n---\r\nbody\r\n';
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toBe('---\r\ntitle: x\r\n---\r\n');
    expect(body).toBe('body\r\n');
  });
});

describe('joinFrontmatter', () => {
  it('returns the body unchanged when there is no frontmatter', () => {
    expect(joinFrontmatter(null, '# Hi\n')).toBe('# Hi\n');
  });

  it('re-prefixes the frontmatter verbatim', () => {
    expect(joinFrontmatter('---\ntitle: x\n---\n', '# Hi\n')).toBe('---\ntitle: x\n---\n# Hi\n');
  });

  it('adds a separating newline when the block lacks one', () => {
    expect(joinFrontmatter('---\ntitle: x\n---', '# Hi\n')).toBe('---\ntitle: x\n---\n# Hi\n');
  });
});

describe('frontmatter through the full load/save pipeline', () => {
  it('round-trips a frontmatter file byte-for-byte', () => {
    const raw = '---\ntitle: Test\n---\n# Hello\n\nSome text.\n';
    const { frontmatter, body } = splitFrontmatter(raw);
    const saved = joinFrontmatter(frontmatter, htmlToMarkdown(markdownToHtml(body)));
    expect(saved).toBe(raw);
  });

  it('never turns frontmatter delimiters into horizontal rules', () => {
    const { body } = splitFrontmatter('---\ntitle: x\n---\n');
    expect(markdownToHtml(body)).not.toContain('<hr');
  });
});

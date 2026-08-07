import { describe, expect, it } from 'vitest';
import { buildExportHtmlDocument, restoreComments } from './export';
import { encodeComment } from './markdown/comments';
import { markdownToHtml } from './markdown/io';

describe('buildExportHtmlDocument', () => {
  it('wraps the body in a standalone styled document', () => {
    const doc = buildExportHtmlDocument('Notes', '<h1>Hi</h1>');
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('<title>Notes</title>');
    expect(doc).toContain('<style>');
    expect(doc).toContain('<h1>Hi</h1>');
  });

  it('escapes the title', () => {
    expect(buildExportHtmlDocument('<script>', '')).toContain('<title>&lt;script&gt;</title>');
  });
});

describe('restoreComments', () => {
  it('turns comment placeholders back into real HTML comments', () => {
    const b64 = encodeComment('<!-- keep me -->');
    expect(restoreComments(`<div data-tl-comment="${b64}">​</div>`)).toBe('<!-- keep me -->');
    expect(restoreComments(`<span data-tl-comment="${b64}" class="x">​</span>`)).toBe(
      '<!-- keep me -->',
    );
  });

  it('produces real comments in the export path (markdown → HTML → document)', () => {
    const bodyHtml = markdownToHtml('text\n\n<!-- annotation -->\n');
    const doc = buildExportHtmlDocument('t', bodyHtml);
    expect(doc).toContain('<!-- annotation -->');
    expect(doc).not.toContain('data-tl-comment');
  });
});

import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from '../../lib/markdown/io';
import { createExtensions } from './extensions';
import { parseDelimiterRow, parsePipeRow } from './tableFromPipes';

const TABLE_MD = '| Name | Age |\n| --- | --- |\n| Ada | 36 |\n| Grace | 85 |\n';

function editorWith(html: string) {
  return new Editor({
    element: document.createElement('div'),
    extensions: createExtensions(),
    content: html,
  });
}

describe('table schema round-trip', () => {
  it('keeps tables as tables through load and serialize', () => {
    const editor = editorWith(markdownToHtml(TABLE_MD));
    const html = editor.getHTML();
    // Regression guard: tables used to flatten into a single paragraph
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).not.toBe('<p>NameAgeAda36Grace85</p>');
    expect(htmlToMarkdown(html)).toBe(TABLE_MD);
    editor.destroy();
  });

  it('keeps inline formatting inside cells', () => {
    const editor = editorWith(markdownToHtml('| a |\n| --- |\n| **b** |\n'));
    const md = htmlToMarkdown(editor.getHTML());
    expect(md).toContain('**b**');
    editor.destroy();
  });
});

describe('parsePipeRow', () => {
  it('splits rows with and without outer pipes', () => {
    expect(parsePipeRow('| a | b |')).toEqual(['a', 'b']);
    expect(parsePipeRow('a | b')).toEqual(['a', 'b']);
    expect(parsePipeRow('| a|b  ')).toEqual(['a', 'b']);
  });

  it('preserves empty cells', () => {
    expect(parsePipeRow('| a || c |')).toEqual(['a', '', 'c']);
  });
});

describe('parseDelimiterRow', () => {
  it('accepts valid delimiter rows', () => {
    expect(parseDelimiterRow('| --- | --- |')).toHaveLength(2);
    expect(parseDelimiterRow('--- | ---')).toHaveLength(2);
    expect(parseDelimiterRow('| :--- | ---: | :---: |')).toHaveLength(3);
    expect(parseDelimiterRow('|-|-|')).toHaveLength(2);
  });

  it('rejects non-delimiter text', () => {
    expect(parseDelimiterRow('| a | b |')).toBeNull();
    expect(parseDelimiterRow('no pipes here --')).toBeNull();
    expect(parseDelimiterRow('just text')).toBeNull();
    expect(parseDelimiterRow('| | --- |')).toBeNull();
  });
});

describe('typed table input rule', () => {
  function typeChar(html: string, char: string) {
    const editor = editorWith(html);
    const view = editor.view;
    const pos = view.state.doc.content.size - 1;
    editor.commands.setTextSelection(pos);
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, pos, pos, char, () => view.state.tr),
    );
    return { editor, handled };
  }

  it('converts when the closing pipe is typed', () => {
    const { editor, handled } = typeChar('<p>| Name | Age |</p><p>| --- | ---</p>', '|');
    expect(handled).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Name');
    expect(html).not.toContain('---');
    editor.destroy();
  });

  it('does not convert mid-row (no closing pipe yet)', () => {
    const { editor, handled } = typeChar('<p>| Name | Age |</p><p>| --- | --</p>', '-');
    expect(handled).toBeFalsy();
    expect(editor.getHTML()).not.toContain('<table');
    editor.destroy();
  });

  it('does not convert without a header row above', () => {
    const { editor, handled } = typeChar('<p>plain text</p><p>| --- | ---</p>', '|');
    expect(handled).toBeFalsy();
    editor.destroy();
  });
});

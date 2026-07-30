import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import {
  computeMatches,
  findMatchCount,
  findReplaceKey,
  replaceActiveMatch,
  replaceAllMatches,
  setFindQuery,
  stepMatch,
} from './findReplace';

function editorWith(html: string) {
  return new Editor({
    element: document.createElement('div'),
    extensions: createExtensions(),
    content: html,
  });
}

describe('computeMatches', () => {
  it('finds all occurrences across nodes, case-insensitive by default', () => {
    const editor = editorWith('<p>Cat in the catalog, category aside</p>');
    const matches = computeMatches(editor.state.doc, 'cat', false);
    expect(matches).toHaveLength(3);
    editor.destroy();
  });

  it('respects case sensitivity', () => {
    const editor = editorWith('<p>Cat cat CAT</p>');
    expect(computeMatches(editor.state.doc, 'cat', true)).toHaveLength(1);
    expect(computeMatches(editor.state.doc, 'cat', false)).toHaveLength(3);
    editor.destroy();
  });

  it('returns nothing for an empty query', () => {
    const editor = editorWith('<p>text</p>');
    expect(computeMatches(editor.state.doc, '', false)).toHaveLength(0);
    editor.destroy();
  });
});

describe('find & replace through the plugin', () => {
  it('tracks matches and cycles the active one', () => {
    const editor = editorWith('<p>one two one two one</p>');
    setFindQuery(editor, 'one', false);
    expect(findMatchCount(editor)).toEqual({ active: 1, total: 3 });
    stepMatch(editor, 1);
    expect(findMatchCount(editor)).toEqual({ active: 2, total: 3 });
    stepMatch(editor, 1);
    stepMatch(editor, 1);
    // Wraps around
    expect(findMatchCount(editor)).toEqual({ active: 1, total: 3 });
    stepMatch(editor, -1);
    expect(findMatchCount(editor)).toEqual({ active: 3, total: 3 });
    editor.destroy();
  });

  it('replaces the active match and advances to the next', () => {
    const editor = editorWith('<p>foo bar foo</p>');
    setFindQuery(editor, 'foo', false);
    replaceActiveMatch(editor, 'baz');
    expect(editor.getText()).toBe('baz bar foo');
    // Active index now points at the remaining match
    expect(findMatchCount(editor)).toEqual({ active: 1, total: 1 });
    editor.destroy();
  });

  it('replaces all matches in one transaction', () => {
    const editor = editorWith('<p>foo bar foo baz foo</p>');
    setFindQuery(editor, 'foo', false);
    const count = replaceAllMatches(editor, 'qux');
    expect(count).toBe(3);
    expect(editor.getText()).toBe('qux bar qux baz qux');
    expect(findMatchCount(editor)).toEqual({ active: 0, total: 0 });
    editor.destroy();
  });

  it('clamps the active index when edits shrink the match list', () => {
    const editor = editorWith('<p>aaa aaa aaa</p>');
    setFindQuery(editor, 'aaa', false);
    stepMatch(editor, 1);
    stepMatch(editor, 1);
    expect(findMatchCount(editor).active).toBe(3);
    // Delete the last two occurrences
    const state = findReplaceKey.getState(editor.state);
    const last = state?.matches[2];
    if (!last) throw new Error('expected a third match');
    editor.view.dispatch(editor.state.tr.insertText('', last.from - 4, last.to));
    expect(findMatchCount(editor).active).toBeLessThanOrEqual(findMatchCount(editor).total);
    editor.destroy();
  });
});

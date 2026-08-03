import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import {
  applySlashItem,
  closeSlashMenu,
  filterSlashItems,
  SLASH_ITEMS,
  slashState,
  stepSlash,
} from './slashCommands';

function editorWith(html: string) {
  return new Editor({
    element: document.createElement('div'),
    extensions: createExtensions(),
    content: html,
  });
}

describe('filterSlashItems', () => {
  it('returns everything for an empty query', () => {
    expect(filterSlashItems(SLASH_ITEMS, '')).toHaveLength(SLASH_ITEMS.length);
  });

  it('matches titles case-insensitively', () => {
    const titles = filterSlashItems(SLASH_ITEMS, 'hEaD').map((i) => i.title);
    expect(titles).toEqual(['Heading 1', 'Heading 2', 'Heading 3']);
  });

  it('matches aliases', () => {
    expect(filterSlashItems(SLASH_ITEMS, 'h1').map((i) => i.id)).toEqual(['h1']);
    expect(filterSlashItems(SLASH_ITEMS, 'checkbox').map((i) => i.id)).toEqual(['todo']);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterSlashItems(SLASH_ITEMS, 'zzzz')).toHaveLength(0);
  });
});

describe('slash detection through the plugin', () => {
  it('opens on "/" at block start and tracks the query', () => {
    const editor = editorWith('<p></p>');
    editor.commands.insertContent('/');
    expect(slashState(editor)).toMatchObject({ active: true, query: '' });
    editor.commands.insertContent('he');
    expect(slashState(editor)).toMatchObject({ active: true, query: 'he' });
    editor.destroy();
  });

  it('opens after whitespace but not mid-word', () => {
    const editor = editorWith('<p></p>');
    editor.commands.insertContent('a/b');
    expect(slashState(editor).active).toBe(false);
    editor.commands.insertContent(' /b');
    expect(slashState(editor)).toMatchObject({ active: true, query: 'b' });
    editor.destroy();
  });

  it('closes when the caret leaves the token and when the token is deleted', () => {
    const editor = editorWith('<p></p>');
    editor.commands.insertContent('/he');
    expect(slashState(editor).active).toBe(true);
    editor.commands.setTextSelection(1); // before the '/'
    expect(slashState(editor).active).toBe(false);
    editor.commands.setTextSelection(4);
    editor.commands.clearContent();
    expect(slashState(editor).active).toBe(false);
    editor.destroy();
  });

  it('stays closed after Escape while the same token is edited, reopens on a fresh one', () => {
    const editor = editorWith('<p></p>');
    editor.commands.insertContent('/he');
    closeSlashMenu(editor);
    expect(slashState(editor).active).toBe(false);
    editor.commands.insertContent('y');
    expect(slashState(editor).active).toBe(false);
    editor.commands.clearContent();
    editor.commands.insertContent('/q');
    expect(slashState(editor)).toMatchObject({ active: true, query: 'q' });
    editor.destroy();
  });

  it('never opens inside a code block', () => {
    const editor = editorWith('<pre><code>/</code></pre>');
    editor.commands.setTextSelection(2);
    expect(slashState(editor).active).toBe(false);
    editor.destroy();
  });

  it('steps the selection with wrapping', () => {
    const editor = editorWith('<p></p>');
    editor.commands.insertContent('/');
    const count = SLASH_ITEMS.length;
    stepSlash(editor, -1, count);
    expect(slashState(editor).index).toBe(count - 1);
    stepSlash(editor, 1, count);
    expect(slashState(editor).index).toBe(0);
    editor.destroy();
  });
});

describe('applySlashItem', () => {
  it('deletes the trigger text and converts an empty block', () => {
    const editor = editorWith('<p></p>');
    editor.commands.insertContent('/h1');
    applySlashItem(editor);
    expect(editor.isActive('heading', { level: 1 })).toBe(true);
    expect(editor.getText()).not.toContain('/h1');
    editor.destroy();
  });

  it('applies the selected item for the current query', () => {
    const editor = editorWith('<p></p>');
    editor.commands.insertContent('/checkbox');
    applySlashItem(editor);
    expect(editor.isActive('taskList')).toBe(true);
    editor.destroy();
  });

  it('starts a fresh block when the slash followed other text', () => {
    const editor = editorWith('<p>hello</p>');
    editor.commands.setTextSelection(6);
    editor.commands.insertContent(' /h1');
    applySlashItem(editor);
    expect(editor.isActive('heading', { level: 1 })).toBe(true);
    expect(editor.getHTML()).toContain('<p>hello </p>');
    editor.destroy();
  });

  it('does nothing when the query matches no item', () => {
    const editor = editorWith('<p></p>');
    editor.commands.insertContent('/zzzz');
    applySlashItem(editor);
    expect(editor.getText()).toBe('/zzzz');
    editor.destroy();
  });
});

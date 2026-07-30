import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/react';

/**
 * Find & replace: a decoration-only ProseMirror plugin (matches are not part
 * of the document) plus plain helper commands the overlay UI dispatches.
 * Matching is a simple substring scan over text nodes — no regex mode.
 */

export interface FindMatch {
  from: number;
  to: number;
}

export interface FindState {
  query: string;
  caseSensitive: boolean;
  activeIndex: number;
  matches: FindMatch[];
  decorations: DecorationSet;
}

interface FindMeta {
  query?: string;
  caseSensitive?: boolean;
  activeIndex?: number;
  clear?: boolean;
}

export const findReplaceKey = new PluginKey<FindState>('findReplace');

const EMPTY: FindState = {
  query: '',
  caseSensitive: false,
  activeIndex: 0,
  matches: [],
  decorations: DecorationSet.empty,
};

export function computeMatches(doc: PMNode, query: string, caseSensitive: boolean): FindMatch[] {
  if (!query) return [];
  const needle = caseSensitive ? query : query.toLowerCase();
  if (!needle) return [];
  const matches: FindMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = caseSensitive ? node.text : node.text.toLowerCase();
    let idx = hay.indexOf(needle);
    while (idx !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + needle.length });
      idx = hay.indexOf(needle, idx + needle.length);
    }
  });
  return matches;
}

function buildState(doc: PMNode, query: string, caseSensitive: boolean, active: number): FindState {
  const matches = computeMatches(doc, query, caseSensitive);
  const activeIndex = matches.length > 0 ? Math.min(Math.max(active, 0), matches.length - 1) : 0;
  const decorations = DecorationSet.create(
    doc,
    matches.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class: i === activeIndex ? 'md-find-match md-find-match-active' : 'md-find-match',
      }),
    ),
  );
  return { query, caseSensitive, activeIndex, matches, decorations };
}

const findReplacePlugin = new Plugin<FindState>({
  key: findReplaceKey,
  state: {
    init: () => EMPTY,
    apply(tr, value) {
      const meta = tr.getMeta(findReplaceKey) as FindMeta | undefined;
      if (!tr.docChanged && !meta) return value;
      let { query, caseSensitive, activeIndex } = value;
      if (meta) {
        if (meta.clear) {
          query = '';
          activeIndex = 0;
        }
        if (meta.query !== undefined && meta.query !== query) {
          query = meta.query;
          activeIndex = 0;
        }
        if (meta.caseSensitive !== undefined && meta.caseSensitive !== caseSensitive) {
          caseSensitive = meta.caseSensitive;
          activeIndex = 0;
        }
        if (meta.activeIndex !== undefined) activeIndex = meta.activeIndex;
      }
      return buildState(tr.doc, query, caseSensitive, activeIndex);
    },
  },
  props: {
    decorations(state) {
      return findReplaceKey.getState(state)?.decorations;
    },
  },
});

export const FindReplace = Extension.create({
  name: 'findReplace',
  addProseMirrorPlugins() {
    return [findReplacePlugin];
  },
});

function findState(editor: Editor): FindState {
  return findReplaceKey.getState(editor.state) ?? EMPTY;
}

export function findMatchCount(editor: Editor): { active: number; total: number } {
  const s = findState(editor);
  return { active: s.matches.length > 0 ? s.activeIndex + 1 : 0, total: s.matches.length };
}

export function setFindQuery(editor: Editor, query: string, caseSensitive: boolean) {
  editor.view.dispatch(editor.state.tr.setMeta(findReplaceKey, { query, caseSensitive }));
}

export function clearFind(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(findReplaceKey, { clear: true }));
}

export function scrollToMatch(editor: Editor) {
  const s = findState(editor);
  const m = s.matches[s.activeIndex];
  if (!m) return;
  const dom = editor.view.domAtPos(m.from);
  const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
  // jsdom (tests) and some webviews lack scrollIntoView
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/** Cycle the active match (direction ±1, wrapping) and scroll it into view. */
export function stepMatch(editor: Editor, direction: 1 | -1) {
  const s = findState(editor);
  if (s.matches.length === 0) return;
  const next = (s.activeIndex + direction + s.matches.length) % s.matches.length;
  editor.view.dispatch(editor.state.tr.setMeta(findReplaceKey, { activeIndex: next }));
  scrollToMatch(editor);
}

/** Replace the active match; the next match becomes active automatically. */
export function replaceActiveMatch(editor: Editor, replacement: string) {
  const s = findState(editor);
  const m = s.matches[s.activeIndex];
  if (!m) return;
  editor.view.dispatch(editor.state.tr.insertText(replacement, m.from, m.to));
  scrollToMatch(editor);
}

/** Replace every match in one transaction (right-to-left keeps positions valid). */
export function replaceAllMatches(editor: Editor, replacement: string): number {
  const s = findState(editor);
  if (s.matches.length === 0) return 0;
  const tr = editor.state.tr;
  for (let i = s.matches.length - 1; i >= 0; i--) {
    const m = s.matches[i];
    tr.insertText(replacement, m.from, m.to);
  }
  editor.view.dispatch(tr);
  return s.matches.length;
}

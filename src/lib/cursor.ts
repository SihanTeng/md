import type { EditorState } from '@tiptap/pm/state';

/**
 * 1-based line number of the cursor: block boundaries and code-block
 * newlines before the selection each count as a line. Approximates the
 * line in the serialized markdown (blank lines between blocks aside).
 */
export function lineAt(state: EditorState): number {
  const { from } = state.selection;
  return state.doc.textBetween(0, from, '\n', '\n').split('\n').length;
}

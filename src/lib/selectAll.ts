/**
 * Ctrl/Cmd+A routing. Editable surfaces keep their native select-all: the
 * ProseMirror editor selects the document, inputs/select their own field.
 * Everywhere else (window chrome, sidebar, buttons…) the keypress is
 * rerouted to the editor, so it never becomes a page-wide selection that
 * sweeps in the document title or other UI text.
 */
const NATIVE_SELECT_ALL = '.ProseMirror, input, textarea, [contenteditable="true"]';

/** True when a Ctrl/Cmd+A keydown on this target should reroute to the editor. */
export function shouldRouteSelectAll(target: EventTarget | null): boolean {
  return !(target instanceof HTMLElement && target.closest(NATIVE_SELECT_ALL));
}

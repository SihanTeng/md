import { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '../../stores/documentStore';

interface Props {
  onRename: (name: string) => void;
}

/**
 * Obsidian-style inline title: shows the file name (extension hidden),
 * editing it renames the file on disk. Commits on Enter/blur, reverts on Esc.
 */
export function DocumentTitle({ onRename }: Props) {
  const title = useDocumentStore((s) => s.title);
  const display = title.replace(/\.(md|markdown|mdown|txt)$/i, '');
  const [value, setValue] = useState(display);
  const [editing, setEditing] = useState(false);
  const cancelledRef = useRef(false);

  // Follow external title changes (file opened/saved) while not editing
  useEffect(() => {
    if (!editing) setValue(display);
  }, [display, editing]);

  const commit = () => {
    setEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setValue(display);
      return;
    }
    if (value.trim() && value.trim() !== display) {
      onRename(value);
    } else {
      setValue(display);
    }
  };

  return (
    <input
      className="doc-title"
      value={value}
      placeholder="Untitled"
      aria-label="Document title (edit to rename file)"
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          cancelledRef.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

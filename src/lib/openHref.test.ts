import { describe, expect, it } from 'vitest';
import { filePathAt } from './openHref';

describe('filePathAt', () => {
  it('finds the path token under the cursor', () => {
    const text = 'see /etc/hosts for details';
    expect(filePathAt(text, 6)).toBe('/etc/hosts');
    expect(filePathAt(text, 13)).toBe('/etc/hosts');
  });

  it('returns null when the cursor is on a non-path token', () => {
    const text = 'see /etc/hosts for details';
    expect(filePathAt(text, 1)).toBeNull();
    expect(filePathAt(text, 17)).toBeNull();
  });

  it('recognizes home-relative and windows paths', () => {
    expect(filePathAt('open ~/notes/a.md now', 8)).toBe('~/notes/a.md');
    expect(filePathAt('open C:\\docs\\b.md now', 8)).toBe('C:\\docs\\b.md');
    expect(filePathAt('open file:///tmp/a.md now', 8)).toBe('file:///tmp/a.md');
  });

  it('trims surrounding punctuation', () => {
    expect(filePathAt('(/tmp/a.md).', 3)).toBe('/tmp/a.md');
    expect(filePathAt('"/tmp/a.md",', 3)).toBe('/tmp/a.md');
  });

  it('rejects urls and relative names', () => {
    expect(filePathAt('go https://example.com/x now', 6)).toBeNull();
    expect(filePathAt('open notes.md now', 7)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { absoluteImagePath, pastedImageName } from './images';

describe('absoluteImagePath', () => {
  const docDir = '/home/u/notes';

  it('resolves relative paths against the document directory', () => {
    expect(absoluteImagePath('assets/pic.png', docDir)).toBe('/home/u/notes/assets/pic.png');
    expect(absoluteImagePath('./assets/pic.png', docDir)).toBe('/home/u/notes/./assets/pic.png');
  });

  it('passes absolute paths through', () => {
    expect(absoluteImagePath('/tmp/pic.png', docDir)).toBe('/tmp/pic.png');
    expect(absoluteImagePath('C:\\img\\pic.png', docDir)).toBe('C:\\img\\pic.png');
  });

  it('returns null for URLs and embedded data', () => {
    expect(absoluteImagePath('https://x.com/p.png', docDir)).toBeNull();
    expect(absoluteImagePath('data:image/png;base64,AAAA', docDir)).toBeNull();
    expect(absoluteImagePath('blob:http://x/1', docDir)).toBeNull();
  });

  it('returns null for relative paths without a document directory', () => {
    expect(absoluteImagePath('assets/pic.png', null)).toBeNull();
  });
});

describe('pastedImageName', () => {
  it('keeps meaningful clipboard names', () => {
    expect(pastedImageName(new File(['x'], 'screenshot.png', { type: 'image/png' }))).toBe(
      'screenshot.png',
    );
  });

  it('replaces generic names with a timestamped one', () => {
    const name = pastedImageName(new File(['x'], 'image.png', { type: 'image/png' }));
    expect(name).toMatch(/^pasted-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.png$/);
  });

  it('derives the extension from the mime type', () => {
    expect(pastedImageName(new File(['x'], '', { type: 'image/jpeg' }))).toMatch(/\.jpg$/);
  });
});

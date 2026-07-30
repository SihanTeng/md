import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  absoluteImagePath,
  localizeHtmlImages,
  needsImageLocalization,
  pastedImageName,
} from './images';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('localizeHtmlImages', () => {
  // Outside Tauri the persistence rule falls back to a data URI — the same
  // outcome as a direct file paste of an unsaved document
  it('rewrites blob: image srcs the same way a file paste persists them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 })),
    );
    const out = await localizeHtmlImages('<p>a <img src="blob:http://localhost/1" alt=""> b</p>');
    expect(out).not.toContain('blob:');
    expect(out).toContain('data:image/png;base64,');
  });

  it('keeps the original src when the blob is unreadable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('dead blob');
      }),
    );
    const html = '<img src="blob:http://localhost/1">';
    expect(await localizeHtmlImages(html)).toContain('blob:http://localhost/1');
  });

  it('leaves remote http(s): images as links, by design', async () => {
    const html = '<p><img src="https://x.com/p.png" alt="x"></p>';
    expect(await localizeHtmlImages(html)).toBe(html);
  });

  it('leaves data: images embedded when no asset directory exists', async () => {
    const html = '<p><img src="data:image/png;base64,iVBORw0KGgo="></p>';
    expect(await localizeHtmlImages(html)).toBe(html);
  });
});

describe('needsImageLocalization', () => {
  it('triggers for blob: images, skips plain HTML', () => {
    expect(needsImageLocalization('<img src="blob:http://x/1">')).toBe(true);
    expect(needsImageLocalization('<p>just text</p>')).toBe(false);
    expect(needsImageLocalization('<img src="https://x.com/p.png">')).toBe(false);
  });
});

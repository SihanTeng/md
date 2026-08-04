import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { markdownToDocxBase64 } from './docx';

/** Unzip a generated docx (base64) and return its document.xml. */
async function documentXml(base64: string): Promise<{ zip: JSZip; xml: string }> {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml missing from the .docx package');
  return { zip, xml: await file.async('string') };
}

const SAMPLE = [
  '# Title',
  '',
  'Hello **bold** and *italic* with `code`.',
  '',
  '- one',
  '- two',
  '',
  '1. first',
  '2. second',
  '',
  '- [x] done task',
  '- [ ] open task',
  '',
  '> quoted line',
  '',
  '```js',
  'const a = 1;',
  '```',
  '',
  '| A | B |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '---',
].join('\n');

describe('markdownToDocxBase64', () => {
  it('produces a valid .docx (zip) package', async () => {
    const base64 = await markdownToDocxBase64('# Hi');
    expect(atob(base64).startsWith('PK')).toBe(true);
  });

  it('handles an empty document', async () => {
    await expect(markdownToDocxBase64('')).resolves.toBeTruthy();
  });
});

describe('docx content mapping', () => {
  it('maps blocks and inline formatting into Word XML', async () => {
    const { xml } = await documentXml(await markdownToDocxBase64(SAMPLE));

    // Heading text with a real Word heading style
    expect(xml).toContain('>Title<');
    expect(xml).toContain('w:val="Heading1"');

    // Inline runs
    expect(xml).toContain('>bold<');
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('>italic<');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('>code<');
    expect(xml).toContain('Consolas');

    // Blockquote, code block, table, thematic break
    expect(xml).toContain('>quoted line<');
    expect(xml).toContain('>const a = 1;<');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('open task');
    expect(xml).toContain('☑');
    expect(xml).toContain('☐');
  });

  it('writes bullet and decimal numbering definitions', async () => {
    const base64 = await markdownToDocxBase64(SAMPLE);
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const numbering = await zip.file('word/numbering.xml')?.async('string');
    expect(numbering).toBeDefined();
    expect(numbering).toContain('w:val="bullet"');
    expect(numbering).toContain('w:val="decimal"');
  });

  it('embeds resolvable images and degrades unresolvable ones to alt text', async () => {
    const markdown = '![alt text](pic.png)\n\n![gone](missing.png)';
    // 1x1 transparent PNG
    const png = atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    );
    const resolver = (src: string) =>
      src === 'pic.png'
        ? Promise.resolve({
            data: Uint8Array.from(png, (c) => c.charCodeAt(0)),
            width: 1,
            height: 1,
            type: 'png' as const,
          })
        : Promise.resolve(null);

    const base64 = await markdownToDocxBase64(markdown, resolver);
    const { zip, xml } = await documentXml(base64);
    expect(xml).toContain('<w:drawing>');
    const media = Object.keys(zip.files).filter(
      (f) => f.startsWith('word/media/') && !f.endsWith('/'),
    );
    expect(media).toHaveLength(1);
    // Dropped image keeps its alt text as a visible placeholder
    expect(xml).toContain('[gone]');
  });

  it('each ordered list gets its own numbering instance (restarts at 1)', async () => {
    const base64 = await markdownToDocxBase64('1. a\n\n1. b');
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const numbering = await zip.file('word/numbering.xml')?.async('string');
    expect(numbering?.match(/<w:num /g) ?? []).toHaveLength(2);
  });
});

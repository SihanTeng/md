import { marked } from 'marked';
import TurndownService from 'turndown';

/** Configure marked for GFM-ish HTML output suitable for TipTap. */
marked.setOptions({
  gfm: true,
  breaks: false,
});

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});

// Task list items
turndown.addRule('taskListItem', {
  filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
  replacement: (content, node) => {
    const checked =
      (node as HTMLElement).getAttribute('data-checked') === 'true' ||
      !!(node as HTMLElement).querySelector('input[type="checkbox"][checked]');
    const text = content.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n/gm, '\n  ');
    return `- [${checked ? 'x' : ' '}] ${text}\n`;
  },
});

turndown.addRule('taskList', {
  filter: (node) => node.nodeName === 'UL' && node.getAttribute('data-type') === 'taskList',
  replacement: (content) => content,
});

// GFM tables: rebuild pipe syntax from the DOM (cell alignment attributes are
// honored when present, though the editor schema currently drops them)
turndown.addRule('table', {
  filter: 'table',
  replacement: (_content, node) => {
    const rows = Array.from((node as HTMLTableElement).rows);
    if (rows.length === 0) return '';

    const cellText = (cell: HTMLTableCellElement) =>
      turndown
        .turndown(cell.innerHTML)
        .replace(/\|/g, '\\|')
        .replace(/\s*\n\s*/g, ' ')
        .trim();

    const delimiterFor = (cell: HTMLTableCellElement) => {
      const align = cell.getAttribute('align') ?? cell.style.textAlign;
      if (align === 'center') return ':---:';
      if (align === 'right') return '---:';
      return '---';
    };

    // GFM requires a header row — use the first row whether or not it has <th>
    const headerCells = Array.from(rows[0].cells);
    const lines = [
      `| ${headerCells.map(cellText).join(' | ')} |`,
      `| ${headerCells.map(delimiterFor).join(' | ')} |`,
      ...rows.slice(1).map((r) => `| ${Array.from(r.cells).map(cellText).join(' | ')} |`),
    ];
    return `\n\n${lines.join('\n')}\n\n`;
  },
});

export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '<p></p>';
  const html = marked.parse(markdown, { async: false }) as string;
  return html;
}

/**
 * Heuristic: does pasted plain text look like markdown source worth parsing?
 * Structural markers (headings, lists, quotes, fences) or inline formatting.
 */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /^#{1,3}\s/m.test(text) ||
    /^\s*[-*+]\s/m.test(text) ||
    /^\s*\d+\.\s/m.test(text) ||
    /^\s*>\s/m.test(text) ||
    /```/.test(text) ||
    // GFM table delimiter row (| --- | :---: |)
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/m.test(text) ||
    /\*\*[^*\n]+\*\*/.test(text) ||
    /(^|[^*])\*[^*\n]+\*/.test(text) ||
    /`[^`\n]+`/.test(text) ||
    // links and images (alt text may be empty)
    /!?\[[^\]\n]*\]\([^)\n]+\)/.test(text)
  );
}

export function htmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return '';
  return turndown.turndown(html).trim() + (html.trim() ? '\n' : '');
}

export function fileNameFromPath(path: string | null | undefined): string {
  if (!path) return 'Untitled';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'Untitled';
}

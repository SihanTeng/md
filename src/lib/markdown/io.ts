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

export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '<p></p>';
  const html = marked.parse(markdown, { async: false }) as string;
  return html;
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

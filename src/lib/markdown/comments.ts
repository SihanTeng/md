import type { TokenizerAndRendererExtension } from 'marked';

/**
 * HTML comment preservation. Both the DOM parser and TipTap drop comment
 * *nodes*, so comments would vanish on load. These marked tokenizers run
 * before marked's built-in html tokenizer and turn `<!-- ... -->` into
 * placeholder *elements* (`<div/span data-md-comment="...">`) that survive
 * the trip through the editor; turndown rules in io.ts restore the original
 * comment text on save.
 *
 * Two transport details to be aware of:
 * - The payload is base64 so arbitrary comment content (quotes, angle
 *   brackets, newlines) rides safely inside an attribute.
 * - The placeholder contains a zero-width space: turndown routes empty
 *   ("blank") elements to its blankRule before consulting custom rules, so
 *   an empty placeholder would be deleted before our rule could fire.
 */

/** Zero-width space payload — see note above. Not matched by /\s/. */
const PAYLOAD = '\u200b';

export function encodeComment(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeComment(encoded: string): string {
  try {
    const bin = atob(encoded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/** Index of a `<!--` at a line start (up to 3 spaces indent), or undefined. */
function lineStartCommentIndex(src: string): number | undefined {
  const match = /(?:^|\n)[ \t]{0,3}<!--/.exec(src);
  if (!match) return undefined;
  return match.index + match[0].length - 4;
}

export const commentMarkedExtensions: TokenizerAndRendererExtension[] = [
  {
    // Comment alone on its own line(s) → block placeholder
    name: 'mdCommentBlock',
    level: 'block',
    // Only line-start comments may interrupt a paragraph — reporting mid-line
    // comments here would make marked split the paragraph at the comment
    start: lineStartCommentIndex,
    tokenizer(src: string) {
      const match = /^[ \t]{0,3}(<!--[\s\S]*?-->)[ \t]*(?=\n|$)/.exec(src);
      if (!match) return undefined;
      return { type: 'mdCommentBlock', raw: match[0], text: match[1] };
    },
    renderer(token) {
      return `<div data-md-comment="${encodeComment(token.text)}">${PAYLOAD}</div>\n`;
    },
  },
  {
    // Comment at a line start with trailing content on the same line — the
    // built-in html block rule would swallow it raw, so render it as a
    // paragraph whose first inline node is the comment placeholder
    name: 'mdCommentLeading',
    level: 'block',
    start: lineStartCommentIndex,
    tokenizer(src: string) {
      const match = /^[ \t]{0,3}(<!--[\s\S]*?-->)([^\n]*(?:\n|$))/.exec(src);
      if (!match) return undefined;
      const token = {
        type: 'mdCommentLeading',
        raw: match[0],
        text: match[1],
        tokens: this.lexer.inlineTokens(match[2]),
      };
      return token;
    },
    renderer(token) {
      return `<p><span data-md-comment="${encodeComment(token.text)}">${PAYLOAD}</span>${this.parser.parseInline(token.tokens ?? [])}</p>\n`;
    },
  },
  {
    // Mid-line comment inside a paragraph → inline placeholder
    name: 'mdCommentInline',
    level: 'inline',
    start(src: string) {
      const i = src.indexOf('<!--');
      return i < 0 ? undefined : i;
    },
    tokenizer(src: string) {
      const match = /^<!--[\s\S]*?-->/.exec(src);
      if (!match) return undefined;
      return { type: 'mdCommentInline', raw: match[0], text: match[0] };
    },
    renderer(token) {
      return `<span data-md-comment="${encodeComment(token.text)}">${PAYLOAD}</span>`;
    },
  },
];

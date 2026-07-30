/**
 * YAML frontmatter preservation. Typora/Obsidian/Zettlr all keep a leading
 * `---` block intact; feeding it to marked would turn the delimiters into
 * horizontal rules and destroy it on save. Instead the block is split off at
 * the file boundary, kept verbatim in the document store, and re-prefixed on
 * save. It is not rendered in the editor (source mode would be the place to
 * edit it — see docs/competitive-analysis.md).
 */

// Closing `---` must start its own line (multiline `^`), and the block is
// only frontmatter at the very start of the file (match.index === 0)
const FRONTMATTER_RE = /^---[ \t]*\r?\n[\s\S]*?^---[ \t]*(?:\r?\n|$)/m;

export function splitFrontmatter(text: string): { frontmatter: string | null; body: string } {
  const match = FRONTMATTER_RE.exec(text);
  if (match?.index !== 0) return { frontmatter: null, body: text };
  return { frontmatter: match[0], body: text.slice(match[0].length) };
}

export function joinFrontmatter(frontmatter: string | null, body: string): string {
  if (!frontmatter) return body;
  const fm = frontmatter.endsWith('\n') ? frontmatter : `${frontmatter}\n`;
  return fm + body;
}

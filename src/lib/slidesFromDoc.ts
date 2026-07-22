import type { JSONContent } from "@tiptap/react";

export interface Slide {
  title: string;
  body: string[];
  level: 1 | 2;
}

function textFromNode(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map(textFromNode).join("");
}

function blockToLines(node: JSONContent): string[] {
  switch (node.type) {
    case "paragraph": {
      const t = textFromNode(node).trim();
      return t ? [t] : [];
    }
    case "bulletList":
    case "orderedList":
    case "taskList":
      return (node.content ?? []).flatMap((item) => {
        const line = textFromNode(item).trim();
        if (!line) return [];
        if (node.type === "taskList") {
          const checked = item.attrs?.checked ? "☑" : "☐";
          return [`${checked} ${line}`];
        }
        return [`• ${line}`];
      });
    case "blockquote":
      return (node.content ?? []).flatMap(blockToLines).map((l) => `“${l}”`);
    case "codeBlock": {
      const t = textFromNode(node).trim();
      return t ? [t] : [];
    }
    default:
      return [];
  }
}

/** Build presentation slides from TipTap JSON: H1/H2 start slides. */
export function slidesFromDoc(doc: JSONContent | null | undefined): Slide[] {
  const content = doc?.content ?? [];
  if (content.length === 0) {
    return [{ title: "Empty document", body: ["Add headings to create slides."], level: 1 }];
  }

  const slides: Slide[] = [];
  let current: Slide | null = null;

  const flush = () => {
    if (current) slides.push(current);
    current = null;
  };

  for (const node of content) {
    if (node.type === "heading") {
      const level = (node.attrs?.level ?? 1) as number;
      if (level === 1 || level === 2) {
        flush();
        current = {
          title: textFromNode(node).trim() || "Untitled",
          body: [],
          level: level as 1 | 2,
        };
        continue;
      }
      // h3+ as body line
      if (!current) {
        current = { title: "Introduction", body: [], level: 1 };
      }
      const t = textFromNode(node).trim();
      if (t) current.body.push(t);
      continue;
    }

    if (!current) {
      current = { title: "Introduction", body: [], level: 1 };
    }
    current.body.push(...blockToLines(node));
  }

  flush();

  if (slides.length === 0) {
    return [{ title: "Document", body: ["No headings found."], level: 1 }];
  }

  // Cap body lines for readable slides
  return slides.map((s) => ({
    ...s,
    body: s.body.filter(Boolean).slice(0, 10),
  }));
}

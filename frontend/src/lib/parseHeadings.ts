import { slugifyHeading } from './slugifyHeading';

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
  children: TocHeading[];
}

export interface ParseHeadingsResult {
  tree: TocHeading[];
  /** Map of plain heading text → generated DOM id */
  idMap: Map<string, string>;
}

/**
 * Strip inline markdown formatting to get plain heading text.
 */
function stripInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '$1$2')
    .replace(/\*([^*]+)\*|_([^_]+)_/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim();
}

function extractRawHeadings(markdown: string): { level: 2 | 3; text: string }[] {
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^( {4,}|\t+)/gm, '');

  const headingRegex = /^(#{2,3})\s+(.+?)(?:\s+#+)?$/gm;
  const headings: { level: 2 | 3; text: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(cleaned)) !== null) {
    const level = match[1].length as 2 | 3;
    const rawText = match[2].trim();
    if (rawText.length === 0) continue;
    headings.push({ level, text: stripInline(rawText) });
  }

  return headings;
}

export function parseHeadings(markdown: string): ParseHeadingsResult {
  const rawHeadings = extractRawHeadings(markdown);
  const tree: TocHeading[] = [];
  const idMap = new Map<string, string>();
  const usedIds = new Set<string>();

  let lastH2: TocHeading | null = null;

  for (const h of rawHeadings) {
    const id = slugifyHeading(h.text, usedIds);
    idMap.set(h.text, id);

    const node: TocHeading = { id, text: h.text, level: h.level, children: [] };

    if (h.level === 2) {
      tree.push(node);
      lastH2 = node;
    } else {
      if (lastH2) {
        lastH2.children.push(node);
      } else {
        tree.push(node);
      }
    }
  }

  return { tree, idMap };
}

import type { NavEntry, TreeNode } from './types';

const TITLE_PLACEHOLDER = '\u0000';

/**
 * Convert a wiki page/folder name to a nav title (decode %XX, hyphen -> space, collapse spaces).
 * Protects literal " - " (e.g. from %2D) by replacing "--" with placeholder before replacing "-" with space.
 */
export function nameToTitle(name: string): string {
  try {
    const decoded = decodeURIComponent(name);
    const withPlaceholder = decoded.replace(/--/g, TITLE_PLACEHOLDER);
    const withSpaces = withPlaceholder.replace(/-/g, ' ');
    const withLiteral = withSpaces.replace(new RegExp(TITLE_PLACEHOLDER, 'g'), ' - ');
    return withLiteral.replace(/\s+/g, ' ').trim();
  } catch {
    return name.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * Build nav structure and return top-level entries for index.md links.
 * relPath: path from docs root to current folder (e.g. '' or 'Project-details').
 */
export function buildNav(tree: TreeNode[], relPath: string = ''): { nav: NavEntry[]; topLevel: NavEntry[] } {
  const nav: NavEntry[] = [];
  const topLevel: NavEntry[] = [];

  for (const node of tree) {
    if (node.type === 'file') {
      const docPath = relPath ? `${relPath}/${node.name}.md` : `${node.name}.md`;
      const entry: NavEntry = { type: 'page', title: nameToTitle(node.name), path: docPath };
      nav.push(entry);
      if (!relPath) topLevel.push(entry);
    } else {
      const dirRel = relPath ? `${relPath}/${node.name}` : node.name;
      const indexPath = `${dirRel}/index.md`;
      const sectionEntry: NavEntry = {
        type: 'section',
        title: nameToTitle(node.name),
        indexPath,
        children: buildNav(node.children, dirRel).nav,
      };
      nav.push(sectionEntry);
      if (!relPath) topLevel.push(sectionEntry);
    }
  }

  return { nav, topLevel };
}

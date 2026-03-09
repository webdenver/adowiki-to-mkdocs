import type { NavEntry } from './types';

/**
 * Generate markdown for docs/index.md: title and list of links to top-level pages/sections.
 */
export function generateIndexMd(topLevel: NavEntry[], siteName: string): string {
  const lines: string[] = [`# ${siteName}`, '', ''];

  for (const entry of topLevel) {
    const title = entry.type === 'page' ? entry.title : entry.title;
    const path = entry.type === 'page' ? entry.path : entry.indexPath;
    lines.push(`- [${title}](${path})`);
  }

  return lines.join('\n') + '\n';
}

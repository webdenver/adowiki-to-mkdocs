import type { CliOptions, NavEntry } from './types';

/**
 * Escape a string for YAML (quote if contains colon or special chars).
 */
function yamlValue(s: string): string {
  if (/[:#\[\]{}|>]/.test(s) || s.includes('\n')) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}

/**
 * Recursively convert NavEntry[] to MkDocs nav YAML lines.
 * Section: "Title": [ "Title": index.md, ...children ]. Children can be pages or nested sections.
 */
function navToYamlRecursive(entries: NavEntry[], indent: string): string[] {
  const lines: string[] = [];
  for (const e of entries) {
    if (e.type === 'page') {
      lines.push(`${indent}- ${yamlValue(e.title)}: ${e.path}`);
    } else {
      lines.push(`${indent}- ${yamlValue(e.title)}:`);
      lines.push(`${indent}  - ${yamlValue(e.title)}: ${e.indexPath}`);
      lines.push(...navToYamlRecursive(e.children, indent + '  '));
    }
  }
  return lines;
}

/**
 * Build full mkdocs.yml content.
 */
export function buildMkdocsYaml(
  siteName: string,
  navEntries: NavEntry[],
  options: CliOptions
): string {
  const navLines = ['nav:'];
  navLines.push('  - Home: index.md');
  navLines.push(...navToYamlRecursive(navEntries, '  '));

  const sections: string[] = [
    `site_name: ${yamlValue(siteName)}`,
    'docs_dir: docs',
    '',
    'theme:',
    '  name: material',
    '  features:',
    '    - navigation.indexes',
    '',
    ...navLines,
  ];

  if (options.plugin.length > 0) {
    sections.push('');
    sections.push('plugins:');
    for (const p of options.plugin) {
      if (p.includes(':')) {
        sections.push(`  - ${p}`);
      } else {
        sections.push(`  - ${p}`);
      }
    }
  }

  // Always add exclude_docs so MkDocs includes .attachments and any include-extra-files patterns (default excludes dot-prefixed)
  sections.push('');
  sections.push('exclude_docs: |');
  sections.push('  !.attachments/');
  for (const pattern of options.includeExtraFiles) {
    sections.push(`  !${pattern}`);
  }

  return sections.join('\n') + '\n';
}

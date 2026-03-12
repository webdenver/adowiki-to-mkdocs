import { decodeLinkTarget, normalizeLinkTarget } from './link-utils';
import { getOutputName } from './slug';
import type { TreeNode } from './types';

/**
 * Build a map from possible link targets (raw names, paths, decoded variants) to slug-based paths from docs root.
 * Call after assignOutputSlugs(tree). Keys use forward slashes and no leading ./.
 */
export function buildLinkRewriteMap(tree: TreeNode[], relPathRaw: string = '', relPathSlug: string = ''): Map<string, string> {
  const map = new Map<string, string>();

  function add(key: string, slugPath: string): void {
    const n = normalizeLinkTarget(key);
    if (n.length > 0) map.set(n, slugPath);
  }

  function walk(nodes: TreeNode[], rawPrefix: string, slugPrefix: string): void {
    for (const node of nodes) {
      const outputName = getOutputName(node);
      const rawName = node.name;
      const rawPath = rawPrefix ? `${rawPrefix}/${rawName}` : rawName;
      const slugPath = slugPrefix ? `${slugPrefix}/${outputName}` : outputName;

      if (node.type === 'file') {
        const targetSlug = `${slugPath}.md`;
        add(rawName, targetSlug);
        add(`${rawName}.md`, targetSlug);
        add(rawPath, targetSlug);
        add(`${rawPath}.md`, targetSlug);
        const decodedName = decodeLinkTarget(rawName);
        if (decodedName !== rawName) {
          add(decodedName, targetSlug);
          add(`${decodedName}.md`, targetSlug);
        }
      } else {
        const dirRaw = rawPath;
        const dirSlug = slugPath;
        if (node.hasIndexMd) {
          const indexSlug = `${dirSlug}/index.md`;
          add(rawName, indexSlug);
          add(`${rawName}.md`, indexSlug);
          add(rawPath, indexSlug);
          add(`${rawPath}.md`, indexSlug);
          add(`${rawPath}/index.md`, indexSlug);
          const decodedName = decodeLinkTarget(rawName);
          if (decodedName !== rawName) {
            add(decodedName, indexSlug);
            add(`${decodedName}.md`, indexSlug);
          }
        }
        walk(node.children, dirRaw, dirSlug);
      }
    }
  }

  walk(tree, relPathRaw, relPathSlug);
  return map;
}

import type { TreeNode } from './types';

const SAFE_PATH_REGEX = /[a-zA-Z0-9._-]/;
const DEFAULT_SLUG = 'page';

/**
 * Decode percent-encoding and normalize to a filesystem/URL-safe path segment.
 * Allows [a-zA-Z0-9._-], replaces other chars with '-', collapses dashes, trims.
 */
export function nameToSlug(name: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    decoded = name;
  }
  const normalized = decoded
    .split('')
    .map((c) => (SAFE_PATH_REGEX.test(c) ? c : '-'))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized.length > 0 ? normalized : DEFAULT_SLUG;
}

/**
 * Get the output path segment for a node (slug if set, else name).
 */
export function getOutputName(node: TreeNode): string {
  return node.slug ?? node.name;
}

/**
 * Assign slug to each node (decode + normalize, unique among siblings).
 * Mutates the tree in place.
 */
export function assignOutputSlugs(tree: TreeNode[]): void {
  const used = new Set<string>();
  for (const node of tree) {
    let base = nameToSlug(node.name);
    let slug = base;
    let n = 2;
    while (used.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    used.add(slug);
    node.slug = slug;
    if (node.type === 'folder') {
      assignOutputSlugs(node.children);
    }
  }
}

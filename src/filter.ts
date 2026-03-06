import type { TreeNode } from './types';

/**
 * Filter tree to only the node matching `pageName` and its descendants.
 * Match is by exact name (root-level entry from .order).
 * Returns a new array with at most one root node (and its subtree).
 */
export function filterTreeByPage(tree: TreeNode[], pageName: string): TreeNode[] {
  if (!pageName) return tree;
  for (const node of tree) {
    if (node.name === pageName) return [node];
  }
  return [];
}

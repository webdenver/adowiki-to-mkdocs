import * as fs from 'fs';
import * as path from 'path';
import type { TreeNode } from './types';

/**
 * Read .order file: one name per line (trimmed, non-empty).
 */
export function readOrderFile(orderPath: string): string[] {
  if (!fs.existsSync(orderPath)) return [];
  const content = fs.readFileSync(orderPath, 'utf-8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Check if a path is a directory.
 */
function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a path is a file.
 */
function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Build the ordered tree from the wiki root.
 * Root .order gives top-level names; for each folder we read folder/.order for children.
 */
export function buildTree(wikiRoot: string): TreeNode[] {
  const orderPath = path.join(wikiRoot, '.order');
  const names = readOrderFile(orderPath);
  const result: TreeNode[] = [];

  for (const name of names) {
    const mdPath = path.join(wikiRoot, name + '.md');
    const dirPath = path.join(wikiRoot, name);

    const hasMd = isFile(mdPath);
    const hasDir = isDir(dirPath);

    if (hasDir) {
      const childOrderPath = path.join(dirPath, '.order');
      const childNames = readOrderFile(childOrderPath);
      const children: TreeNode[] = [];

      for (const childName of childNames) {
        const childMdPath = path.join(dirPath, childName + '.md');
        const childDirPath = path.join(dirPath, childName);
        const childHasMd = isFile(childMdPath);
        const childHasDir = isDir(childDirPath);

        if (childHasDir) {
          children.push(buildTreeNode(path.join(dirPath, childName), childName, childHasMd));
        } else if (childHasMd) {
          children.push({ type: 'file', name: childName });
        }
        // else: name in .order but no file/folder found, skip
      }

      result.push({
        type: 'folder',
        name,
        hasIndexMd: hasMd,
        children,
      });
    } else if (hasMd) {
      result.push({ type: 'file', name });
    }
    // else: name in .order but no file/folder found, skip
  }

  return result;
}

/**
 * Build a single folder subtree (recursive).
 */
function buildTreeNode(dirPath: string, name: string, hasIndexMd: boolean): TreeNode {
  const orderPath = path.join(dirPath, '.order');
  const childNames = readOrderFile(orderPath);
  const children: TreeNode[] = [];

  for (const childName of childNames) {
    const childMdPath = path.join(dirPath, childName + '.md');
    const childDirPath = path.join(dirPath, childName);
    const childHasMd = isFile(childMdPath);
    const childHasDir = isDir(childDirPath);

    if (childHasDir) {
      children.push(buildTreeNode(childDirPath, childName, childHasMd));
    } else if (childHasMd) {
      children.push({ type: 'file', name: childName });
    }
  }

  return {
    type: 'folder',
    name,
    hasIndexMd,
    children,
  };
}

import * as fs from 'fs';
import * as path from 'path';
import { getOutputName } from './slug';
import type { TreeNode } from './types';

/**
 * Collect all included .md file paths (absolute) that will be copied, for attachment scanning.
 */
export function collectIncludedMdPaths(wikiRoot: string, tree: TreeNode[], relPath: string = ''): string[] {
  const result: string[] = [];
  for (const node of tree) {
    if (node.type === 'file') {
      const mdPath = path.join(wikiRoot, relPath, node.name + '.md');
      result.push(mdPath);
    } else {
      const dirRel = relPath ? path.join(relPath, node.name) : node.name;
      if (node.hasIndexMd) {
        const indexMdPath = path.join(wikiRoot, relPath, node.name + '.md');
        result.push(indexMdPath);
      }
      result.push(...collectIncludedMdPaths(wikiRoot, node.children, dirRel));
    }
  }
  return result;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Copy a single file's content to dest (for section index we write content to index.md).
 */
function copyMdFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Copy contents of a directory except .order. Copies .md files, .images, and subdirs recursively.
 * dirRelPathRaw: path from wiki root to current folder (raw names). dirRelPathSlug: path in docs (slug names).
 */
function copyFolderContents(
  wikiRoot: string,
  docsDir: string,
  dirRelPathRaw: string,
  dirRelPathSlug: string,
  attachmentFilter?: Set<string>
): void {
  const srcDir = path.join(wikiRoot, dirRelPathRaw);
  const destDir = path.join(docsDir, dirRelPathSlug);
  if (!fs.existsSync(srcDir)) return;

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === '.order') continue;
    const srcFull = path.join(srcDir, e.name);
    const destFull = path.join(destDir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.images') {
        copyDirRecursive(srcFull, destFull);
      } else {
        copyDirRecursive(srcFull, destFull);
      }
    } else {
      copyFile(srcFull, destFull);
    }
  }
}

function copyDirRecursive(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const srcFull = path.join(src, e.name);
    const destFull = path.join(dest, e.name);
    if (e.isDirectory()) {
      copyDirRecursive(srcFull, destFull);
    } else {
      copyFile(srcFull, destFull);
    }
  }
}

/**
 * Copy tree of pages to docsDir. Optionally only copy attachment files listed in attachmentFilter (when in single-page mode).
 * relPathRaw/relPathSlug: path from wiki root / docs root to current folder (raw names for source, slug for dest).
 */
export function copyTree(
  wikiRoot: string,
  docsDir: string,
  tree: TreeNode[],
  attachmentFilter?: Set<string>,
  relPathRaw: string = '',
  relPathSlug: string = ''
): void {
  for (const node of tree) {
    const outputName = getOutputName(node);
    if (node.type === 'file') {
      const srcMd = path.join(wikiRoot, relPathRaw, node.name + '.md');
      const destMd = path.join(docsDir, relPathSlug, outputName + '.md');
      if (fs.existsSync(srcMd)) copyMdFile(srcMd, destMd);
    } else {
      const dirRelRaw = relPathRaw ? path.join(relPathRaw, node.name) : node.name;
      const dirRelSlug = relPathSlug ? path.join(relPathSlug, outputName) : outputName;
      const destDir = path.join(docsDir, dirRelSlug);
      ensureDir(destDir);

      if (node.hasIndexMd) {
        const srcIndex = path.join(wikiRoot, relPathRaw, node.name + '.md');
        const destIndex = path.join(docsDir, dirRelSlug, 'index.md');
        if (fs.existsSync(srcIndex)) copyMdFile(srcIndex, destIndex);
      }

      copyFolderContents(wikiRoot, docsDir, dirRelRaw, dirRelSlug, attachmentFilter);
      copyTree(wikiRoot, docsDir, node.children, attachmentFilter, dirRelRaw, dirRelSlug);
    }
  }
}

/**
 * Copy .attachments from wiki root to docsDir/.attachments/.
 * If attachmentFilter is provided, only copy those paths (relative to .attachments/); otherwise copy all.
 */
export function copyAttachments(
  wikiRoot: string,
  docsDir: string,
  attachmentFilter?: Set<string>
): void {
  const srcAtt = path.join(wikiRoot, '.attachments');
  const destAtt = path.join(docsDir, '.attachments');
  if (!fs.existsSync(srcAtt)) return;

  ensureDir(destAtt);
  const entries = fs.readdirSync(srcAtt, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      const srcSub = path.join(srcAtt, e.name);
      const destSub = path.join(destAtt, e.name);
      if (attachmentFilter !== undefined) {
        copyAttachmentsFiltered(srcSub, destSub, e.name + '/', attachmentFilter);
      } else {
        copyDirRecursive(srcSub, destSub);
      }
    } else {
      if (attachmentFilter !== undefined && !attachmentFilter.has(e.name)) continue;
      copyFile(path.join(srcAtt, e.name), path.join(destAtt, e.name));
    }
  }
}

function copyAttachmentsFiltered(
  srcDir: string,
  destDir: string,
  prefix: string,
  filter: Set<string>
): void {
  ensureDir(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const relPath = prefix + e.name;
    if (e.isDirectory()) {
      const srcSub = path.join(srcDir, e.name);
      const destSub = path.join(destDir, e.name);
      const hasMatch = [...filter].some((f) => f === relPath || f.startsWith(relPath + '/'));
      if (!hasMatch) continue;
      copyAttachmentsFiltered(srcSub, destSub, relPath + '/', filter);
    } else {
      if (!filter.has(relPath) && !filter.has(e.name)) continue;
      ensureDir(destDir);
      copyFile(path.join(srcDir, e.name), path.join(destDir, e.name));
    }
  }
}

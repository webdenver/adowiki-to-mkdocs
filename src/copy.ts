import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
import { buildLinkRewriteMap } from './link-map';
import { nameToTitle } from './nav';
import { getOutputName } from './slug';
import { transformAdoMarkdown } from './transform';
import type { SubpageLink } from './transform';
import type { TreeNode } from './types';

/**
 * Create a filter that returns true if the path is "included" (matches at least one of the allow-list patterns).
 * Uses gitignore-style semantics: we add a rule to ignore everything (*) then !pattern for each include pattern.
 * Exported for tests.
 */
export function createIncludeExtraFilesFilter(patterns: string[]): (entryPath: string) => boolean {
  if (patterns.length === 0) return () => false;
  const ig = ignore().add('*');
  for (const p of patterns) {
    ig.add('!' + p);
  }
  return (entryPath: string) => !ig.ignores(entryPath);
}

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
 * Copy a single .md file to dest, transforming ADO [[_TOC_]] / [[_TOSP_]] for MkDocs.
 * subpageLinks: optional list for [[_TOSP_]] replacement (section index pages only).
 * linkRewriteMap: optional map to rewrite in-content links to slug-based paths.
 * currentPageSlugPath: optional path from docs root to this .md file (e.g. Project-details/Introduction.md); when set, rewritten links are emitted relative to this page.
 * isSectionIndex: when true, prefix relative links in content with ../ (for content written to Parent/index.md).
 */
function copyMdFile(
  src: string,
  dest: string,
  subpageLinks?: SubpageLink[],
  linkRewriteMap?: Map<string, string>,
  currentPageSlugPath?: string,
  isSectionIndex?: boolean
): void {
  ensureDir(path.dirname(dest));
  const content = fs.readFileSync(src, 'utf-8');
  const transformed = transformAdoMarkdown(content, subpageLinks, linkRewriteMap, currentPageSlugPath, isSectionIndex);
  fs.writeFileSync(dest, transformed, 'utf-8');
}

/**
 * Copy contents of a directory except .order. Only copies entries that match includeExtraFilesPatterns (allow-list).
 * When patterns is empty, copies nothing here (.md pages are still copied by copyTree for file nodes).
 * Wiki page subfolders are not copied here; copyTree creates them with slug names.
 * dirRelPathRaw: path from wiki root to current folder (raw names). dirRelPathSlug: path in docs (slug names).
 */
function copyFolderContents(
  wikiRoot: string,
  docsDir: string,
  dirRelPathRaw: string,
  dirRelPathSlug: string,
  includeExtraFilesPatterns: string[],
  attachmentFilter?: Set<string>
): void {
  const srcDir = path.join(wikiRoot, dirRelPathRaw);
  const destDir = path.join(docsDir, dirRelPathSlug);
  if (!fs.existsSync(srcDir)) return;

  const isIncluded = createIncludeExtraFilesFilter(includeExtraFilesPatterns);

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === '.order') continue;
    const srcFull = path.join(srcDir, e.name);
    const destFull = path.join(destDir, e.name);
    if (e.isDirectory()) {
      // Include if entry name or "name/" matches any pattern (gitignore-style .images/ etc.)
      if (isIncluded(e.name) || isIncluded(e.name + '/')) {
        copyDirRecursive(srcFull, destFull);
      }
      // else: wiki page subfolder or not in allow-list — skip
    } else {
      if (!isIncluded(e.name)) continue;
      // Skip .md files: they are always copied by copyTree (file nodes or folder index)
      if (e.name.endsWith('.md')) continue;
      ensureDir(path.dirname(destFull));
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
 * linkRewriteMap: optional map for rewriting in-content links to slug paths (built once at root, passed through).
 */
export function copyTree(
  wikiRoot: string,
  docsDir: string,
  tree: TreeNode[],
  attachmentFilter?: Set<string>,
  includeExtraFilesPatterns: string[] = [],
  relPathRaw: string = '',
  relPathSlug: string = '',
  linkRewriteMap?: Map<string, string>
): void {
  for (const node of tree) {
    const outputName = getOutputName(node);
    if (node.type === 'file') {
      const srcMd = path.join(wikiRoot, relPathRaw, node.name + '.md');
      const destMd = path.join(docsDir, relPathSlug, outputName + '.md');
      const currentPageSlugPath = relPathSlug ? `${relPathSlug}/${outputName}.md` : `${outputName}.md`;
      if (fs.existsSync(srcMd)) copyMdFile(srcMd, destMd, undefined, linkRewriteMap, currentPageSlugPath);
    } else {
      const dirRelRaw = relPathRaw ? path.join(relPathRaw, node.name) : node.name;
      const dirRelSlug = relPathSlug ? path.join(relPathSlug, outputName) : outputName;
      const destDir = path.join(docsDir, dirRelSlug);
      ensureDir(destDir);

      if (node.hasIndexMd) {
        const srcIndex = path.join(wikiRoot, relPathRaw, node.name + '.md');
        const destIndex = path.join(docsDir, dirRelSlug, 'index.md');
        // [[_TOSP_]] is populated from immediate children only. Root index therefore lists only
        // top-level sections (e.g. Project-details/index.md); section indexes list their own
        // children (e.g. Project-details/index.md lists Introduction.md, etc.).
        // Optional extensions (if deeper-level links are desired):
        // - Flattened: build a recursive list of all descendant nodes (file → .md, dir → /index.md) and pass that as subpageLinks; paths must be relative to current section (e.g. Introduction.md for root, or subdir/Page.md).
        // - Nested: extend SubpageLink to support nested items and have transformAdoMarkdown render indented bullets; build a tree here from node.children (and their children) instead of a flat list.
        const subpageLinks: SubpageLink[] = node.children.map((child) => ({
          title: nameToTitle(child.name),
          path: getOutputName(child) + (child.type === 'file' ? '.md' : '/index.md'),
        }));
        const currentPageSlugPath = `${dirRelSlug}/index.md`;
        if (fs.existsSync(srcIndex)) copyMdFile(srcIndex, destIndex, subpageLinks, linkRewriteMap, currentPageSlugPath, true);
      }

      copyFolderContents(wikiRoot, docsDir, dirRelRaw, dirRelSlug, includeExtraFilesPatterns, attachmentFilter);
      copyTree(wikiRoot, docsDir, node.children, attachmentFilter, includeExtraFilesPatterns, dirRelRaw, dirRelSlug, linkRewriteMap);
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

/**
 * Transform ADO wiki markdown for MkDocs: [[_TOC_]] → [TOC], [[_TOSP_]] → list of subpage links or empty.
 * Optionally rewrites in-content links to use slug-based paths when linkRewriteMap is provided.
 * When currentPageSlugPath is provided, rewritten links are emitted relative to the current page.
 */

import * as path from 'path';
import { decodeLinkTarget, normalizeLinkTarget } from './link-utils';

const ADO_TOC = '[[_TOC_]]';
const ADO_TOSP = '[[_TOSP_]]';

export interface SubpageLink {
  title: string;
  path: string;
}

/** Path from docs root to current .md file (e.g. Project-details/Introduction.md) */
export type CurrentPageSlugPath = string;

/** Compute relative path from current page to target slug path; use forward slashes. Same-folder gets ./ prefix. */
export function relativePathFromCurrentPage(currentPageSlugPath: string, targetSlugPath: string): string {
  const currentDir = path.dirname(currentPageSlugPath);
  const rel = path.relative(currentDir, targetSlugPath).replace(/\\/g, '/');
  if (rel.length > 0 && !rel.startsWith('..') && !rel.startsWith('/')) {
    return './' + rel;
  }
  return rel;
}

function getSlugForTarget(
  map: Map<string, string>,
  key: string,
  resolvedPathFromRoot: string | null
): string | undefined {
  const fromRoot = resolvedPathFromRoot
    ? [resolvedPathFromRoot, resolvedPathFromRoot + '.md', decodeLinkTarget(resolvedPathFromRoot), decodeLinkTarget(resolvedPathFromRoot) + '.md']
    : [];
  const keysToTry = [...fromRoot, key, key + '.md', decodeLinkTarget(key), decodeLinkTarget(key) + '.md'];
  for (const k of keysToTry) {
    const slug = map.get(k);
    if (slug !== undefined) return slug;
  }
  return undefined;
}

/** Rewrite markdown link URLs that match a wiki page to slug path (or relative path when currentPageSlugPath set). */
function rewriteMarkdownLinks(
  content: string,
  map: Map<string, string>,
  currentPageSlugPath?: string
): string {
  return content.replace(/\]\(([^\s)]+)(?:\s+[^)]*)?\)/g, (match, url: string) => {
    const raw = url.trim();
    if (/^https?:\/\//i.test(raw) || raw.startsWith('#') || raw.includes('.attachments/')) {
      return match;
    }
    const key = normalizeLinkTarget(raw);
    const isRelative = !key.startsWith('/') && !key.includes('/');
    const currentDir = currentPageSlugPath ? path.dirname(currentPageSlugPath) : '';
    const resolvedPathFromRoot = currentPageSlugPath && isRelative
      ? (currentDir ? currentDir + '/' + key : key)
      : null;
    const slug = getSlugForTarget(map, key, resolvedPathFromRoot);
    if (slug === undefined) return match;
    const outPath = currentPageSlugPath ? relativePathFromCurrentPage(currentPageSlugPath, slug) : slug;
    return `](${outPath})`;
  });
}

/**
 * Replace ADO wiki TOC/TOSP tags with MkDocs-compatible content.
 * - [[_TOC_]] → [TOC] (MkDocs in-page table of contents)
 * - [[_TOSP_]] → markdown list of links if subpageLinks provided and non-empty; otherwise empty string
 * - If linkRewriteMap is provided, rewrites in-content ](url) links to slug-based paths
 * - If currentPageSlugPath is also provided, rewritten links are emitted relative to that page
 */
export function transformAdoMarkdown(
  content: string,
  subpageLinks?: SubpageLink[],
  linkRewriteMap?: Map<string, string>,
  currentPageSlugPath?: CurrentPageSlugPath
): string {
  let out = content;
  out = out.split(ADO_TOC).join('[TOC]');
  const tospReplacement =
    subpageLinks && subpageLinks.length > 0
      ? subpageLinks.map(({ title, path }) => `- [${title}](${path})`).join('\n')
      : '';
  out = out.split(ADO_TOSP).join(tospReplacement);

  if (linkRewriteMap && linkRewriteMap.size > 0) {
    out = rewriteMarkdownLinks(out, linkRewriteMap, currentPageSlugPath);
  }
  return out;
}

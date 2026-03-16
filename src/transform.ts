/**
 * Transform ADO wiki markdown for MkDocs: [[_TOC_]] → [TOC], [[_TOSP_]] → list of subpage links or empty.
 * Optionally rewrites in-content links to use slug-based paths when linkRewriteMap is provided.
 * When currentPageSlugPath is provided, rewritten links are emitted relative to the current page.
 */

import * as path from 'path';
import { decodeLinkTarget, normalizeLinkTarget, unescapeLinkDestination } from './link-utils';

const ADO_TOC = '[[_TOC_]]';
const ADO_TOSP = '[[_TOSP_]]';

/**
 * Parse link destination starting at urlStart (index of first char after "](").
 * Handles backslash-escape and balanced parentheses so both ](Subpage(1)-1.md) and ](Subpage\(1\)-1.md) work.
 * Returns the URL string and the index of the closing ")" (inclusive).
 */
function parseLinkDestination(content: string, urlStart: number): { url: string; endIndex: number } | null {
  let depth = 1;
  const parts: string[] = [];
  let i = urlStart;
  while (i < content.length) {
    const c = content[i];
    if (c === '\\') {
      if (i + 1 < content.length) {
        parts.push(content[i + 1]);
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === '(') {
      depth += 1;
      parts.push(c);
      i += 1;
      continue;
    }
    if (c === ')') {
      depth -= 1;
      if (depth === 0) {
        return { url: parts.join(''), endIndex: i };
      }
      parts.push(c);
      i += 1;
      continue;
    }
    parts.push(c);
    i += 1;
  }
  return null;
}

/**
 * Process content and replace link ranges using the given replacer. Finds each "](" then parses
 * the destination with balanced parens; calls replacer(url, fullMatch) and replaces with returned string.
 */
function replaceMarkdownLinks(
  content: string,
  replacer: (url: string, fullMatch: string) => string
): string {
  let result = '';
  let pos = 0;
  const needle = '](';
  while (pos < content.length) {
    const i = content.indexOf(needle, pos);
    if (i === -1) {
      result += content.slice(pos);
      break;
    }
    const urlStart = i + needle.length;
    const parsed = parseLinkDestination(content, urlStart);
    if (parsed === null) {
      result += content.slice(pos, urlStart);
      pos = urlStart;
      continue;
    }
    const fullMatch = content.slice(i, parsed.endIndex + 1);
    const replacement = replacer(parsed.url, fullMatch);
    result += content.slice(pos, i) + replacement;
    pos = parsed.endIndex + 1;
  }
  return result;
}

/**
 * Prefix every relative link URL in content with ../ (one more if already starting with ../).
 * Skip absolute URLs, anchor-only (#...), and .attachments/. Used for section index content only.
 */
function prefixSectionIndexRelativeLinks(content: string): string {
  return replaceMarkdownLinks(content, (url, fullMatch) => {
    const raw = url.trim();
    if (/^https?:\/\//i.test(raw) || raw.startsWith('#') || raw.includes('.attachments/')) {
      return fullMatch;
    }
    if (raw.startsWith('/')) return fullMatch;
    return '](' + '../' + raw + ')';
  });
}

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
  return replaceMarkdownLinks(content, (url, fullMatch) => {
    const raw = url.trim();
    if (/^https?:\/\//i.test(raw) || raw.startsWith('#') || raw.includes('.attachments/')) {
      return fullMatch;
    }
    const unescaped = unescapeLinkDestination(raw);
    const key = normalizeLinkTarget(unescaped);
    const currentDir = currentPageSlugPath ? path.dirname(currentPageSlugPath).replace(/\\/g, '/') : '';
    const isRelative = !unescaped.startsWith('/');
    const resolvedPathFromRoot =
      currentPageSlugPath && isRelative
        ? path.posix.normalize(path.posix.join(currentDir, unescaped)).replace(/^\.\//, '')
        : null;
    const slug = getSlugForTarget(map, key, resolvedPathFromRoot);
    if (slug === undefined) return fullMatch;
    const outPath = currentPageSlugPath ? relativePathFromCurrentPage(currentPageSlugPath, slug) : slug;
    return `](${outPath})`;
  });
}

/**
 * Replace ADO wiki TOC/TOSP tags with MkDocs-compatible content.
 * - [[_TOC_]] → [TOC] (MkDocs in-page table of contents)
 * - If isSectionIndex, prefix every relative link with ../ (after TOC, before TOSP)
 * - [[_TOSP_]] → markdown list of links if subpageLinks provided and non-empty; otherwise empty string.
 *   subpageLinks are typically the immediate children of the current page only (one level). So the root
 *   index lists only top-level sections (e.g. Project-details/index.md), and each section index lists
 *   its own children (e.g. Introduction.md); deeper pages do not appear in the root index.
 * - If linkRewriteMap is provided, rewrites in-content ](url) links to slug-based paths
 * - If currentPageSlugPath is also provided, rewritten links are emitted relative to that page
 */
export function transformAdoMarkdown(
  content: string,
  subpageLinks?: SubpageLink[],
  linkRewriteMap?: Map<string, string>,
  currentPageSlugPath?: CurrentPageSlugPath,
  isSectionIndex?: boolean
): string {
  let out = content;
  out = out.split(ADO_TOC).join('[TOC]');
  if (isSectionIndex) {
    out = prefixSectionIndexRelativeLinks(out);
  }
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

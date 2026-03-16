/**
 * Shared helpers for link path normalization and decoding (used by link-map and transform).
 */

/** Normalize a path for map lookup or link target: forward slashes, no leading ./ or / */
export function normalizeLinkTarget(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.?\//, '').trim();
}

/** Decode percent-encoding for lookup; return original if decode fails */
export function decodeLinkTarget(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Strip CommonMark backslash escapes in a link destination (e.g. \( and \) → ( and )). */
export function unescapeLinkDestination(s: string): string {
  return s.replace(/\\(.)/g, '$1');
}

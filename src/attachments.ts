/**
 * Collect attachment paths referenced in markdown content.
 * Matches ](/.attachments/... or ](.attachments/... (and optional sizing =500x etc).
 */
const ATTACHMENT_REGEX = /\]\(\/?\.attachments\/([^\s)]+)(?:\s[^)]*)?\)/g;

/**
 * From markdown string, return the set of attachment paths (relative to .attachments/).
 * E.g. "1-2906e4d4-57d8-4d43-8f4c-db9f3edeedcb.jpg"
 */
export function collectAttachmentPathsFromMd(content: string): Set<string> {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  ATTACHMENT_REGEX.lastIndex = 0;
  while ((m = ATTACHMENT_REGEX.exec(content)) !== null) {
    set.add(m[1]);
  }
  return set;
}

/**
 * Collect all attachment paths referenced in the given list of file paths (md files).
 */
export function collectAttachmentPathsFromFiles(
  filePaths: string[],
  readFile: (p: string) => string
): Set<string> {
  const all = new Set<string>();
  for (const p of filePaths) {
    try {
      const content = readFile(p);
      for (const path of collectAttachmentPathsFromMd(content)) {
        all.add(path);
      }
    } catch {
      // skip missing/unreadable
    }
  }
  return all;
}

/**
 * Transform ADO wiki markdown for MkDocs: [[_TOC_]] → [TOC], [[_TOSP_]] → list of subpage links or empty.
 */

const ADO_TOC = '[[_TOC_]]';
const ADO_TOSP = '[[_TOSP_]]';

export interface SubpageLink {
  title: string;
  path: string;
}

/**
 * Replace ADO wiki TOC/TOSP tags with MkDocs-compatible content.
 * - [[_TOC_]] → [TOC] (MkDocs in-page table of contents)
 * - [[_TOSP_]] → markdown list of links if subpageLinks provided and non-empty; otherwise empty string
 */
export function transformAdoMarkdown(
  content: string,
  subpageLinks?: SubpageLink[]
): string {
  let out = content;
  out = out.split(ADO_TOC).join('[TOC]');
  const tospReplacement =
    subpageLinks && subpageLinks.length > 0
      ? subpageLinks.map(({ title, path }) => `- [${title}](${path})`).join('\n')
      : '';
  out = out.split(ADO_TOSP).join(tospReplacement);
  return out;
}

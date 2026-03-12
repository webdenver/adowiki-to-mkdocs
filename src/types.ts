/**
 * A node in the wiki tree: either a single .md file or a folder (with optional same-name .md as section index).
 * When set, slug is the output path segment (unique among siblings); used for docs/ paths and nav.
 */
export type TreeNode =
  | { type: 'file'; name: string; slug?: string }
  | {
      type: 'folder';
      name: string;
      /** If present, this folder has an index page (same-name .md at parent level or here). */
      hasIndexMd?: boolean;
      children: TreeNode[];
      slug?: string;
    };

/**
 * Nav entry for mkdocs.yml: either a leaf page or a section with children.
 */
export type NavEntry =
  | { type: 'page'; title: string; path: string }
  | { type: 'section'; title: string; indexPath: string; children: NavEntry[] };

export interface CliOptions {
  input: string;
  output: string;
  siteName: string;
  page?: string;
  includeExtraFiles: string[];
  plugin: string[];
}

export interface ConversionContext {
  wikiRoot: string;
  docsDir: string;
  options: CliOptions;
  /** Filtered tree (after --page filter). */
  tree: TreeNode[];
}

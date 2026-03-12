#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { buildTree } from './order';
import { filterTreeByPage } from './filter';
import { assignOutputSlugs } from './slug';
import {
  copyTree,
  copyAttachments,
  collectIncludedMdPaths,
} from './copy';
import { buildLinkRewriteMap } from './link-map';
import { collectAttachmentPathsFromFiles } from './attachments';
import { buildNav } from './nav';
import { generateIndexMd } from './index-md';
import { buildMkdocsYaml } from './mkdocs-config';
import type { CliOptions } from './types';

function run(options: CliOptions): void {
  const wikiRoot = path.resolve(options.input);
  const outputDir = path.resolve(options.output);
  const docsDir = path.join(outputDir, 'docs');

  if (!fs.existsSync(wikiRoot)) {
    console.error(`Error: input directory not found: ${wikiRoot}`);
    process.exit(1);
  }

  let tree = buildTree(wikiRoot);
  if (options.page) {
    tree = filterTreeByPage(tree, options.page);
    if (tree.length === 0) {
      console.error(`Error: page not found: ${options.page}`);
      process.exit(1);
    }
  }
  assignOutputSlugs(tree);

  let attachmentFilter: Set<string> | undefined;
  if (options.page) {
    const mdPaths = collectIncludedMdPaths(wikiRoot, tree);
    attachmentFilter = collectAttachmentPathsFromFiles(mdPaths, (p) =>
      fs.readFileSync(p, 'utf-8')
    );
  }

  fs.mkdirSync(docsDir, { recursive: true });
  const linkRewriteMap = buildLinkRewriteMap(tree);
  copyTree(wikiRoot, docsDir, tree, attachmentFilter, options.includeExtraFiles, '', '', linkRewriteMap);
  copyAttachments(wikiRoot, docsDir, attachmentFilter);

  const { nav, topLevel } = buildNav(tree);
  const indexContent = generateIndexMd(topLevel, options.siteName);
  fs.writeFileSync(path.join(docsDir, 'index.md'), indexContent, 'utf-8');

  const mkdocsYaml = buildMkdocsYaml(options.siteName, nav, options);
  fs.writeFileSync(path.join(outputDir, 'mkdocs.yml'), mkdocsYaml, 'utf-8');

  console.log(`Done. Docs: ${docsDir}`);
  console.log(`MkDocs config: ${path.join(outputDir, 'mkdocs.yml')}`);
}

const argv = yargs(hideBin(process.argv))
  .option('input', {
    type: 'string',
    description: 'Path to ADO wiki repo root',
    demandOption: true,
  })
  .option('output', {
    type: 'string',
    description: 'Directory where docs/ and mkdocs.yml will be created',
    demandOption: true,
  })
  .option('site-name', {
    type: 'string',
    description: 'Value for site_name in mkdocs.yml',
    demandOption: true,
  })
  .option('page', {
    type: 'string',
    description: 'Only include this page and its subpages',
  })
  .option('include-extra-files', {
    type: 'array',
    string: true,
    description:
      'Gitignore-style pattern for extra content to copy from each folder (e.g. .images/, *.md). Can be repeated. Only matching entries are copied.',
    default: [],
  })
  .option('plugin', {
    type: 'array',
    string: true,
    description: 'Add to plugins in mkdocs.yml',
    default: [],
  })
  .parseSync();

const options: CliOptions = {
  input: argv.input,
  output: argv.output,
  siteName: argv['site-name'],
  page: argv.page,
  includeExtraFiles: argv['include-extra-files'] ?? [],
  plugin: argv.plugin ?? [],
};

run(options);

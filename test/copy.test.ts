import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { copyTree, createIncludeExtraFilesFilter } from '../src/copy.js';
import { buildLinkRewriteMap } from '../src/link-map.js';
import { buildTree } from '../src/order.js';
import { assignOutputSlugs } from '../src/slug.js';
import { buildMkdocsYaml } from '../src/mkdocs-config.js';
import { buildNav } from '../src/nav.js';

describe('createIncludeExtraFilesFilter', () => {
  it('returns false for all paths when patterns is empty', () => {
    const filter = createIncludeExtraFilesFilter([]);
    assert.strictEqual(filter('foo.md'), false);
    assert.strictEqual(filter('.images'), false);
  });

  it('includes path matching pattern .images/ (directory-style path with trailing slash)', () => {
    const filter = createIncludeExtraFilesFilter(['.images/']);
    // In gitignore semantics, .images/ matches directories; path is often represented with trailing slash
    assert.strictEqual(filter('.images/'), true);
    assert.strictEqual(filter('other'), false);
  });

  it('includes path matching pattern *.md', () => {
    const filter = createIncludeExtraFilesFilter(['*.md']);
    assert.strictEqual(filter('page.md'), true);
    assert.strictEqual(filter('foo.txt'), false);
  });

  it('includes path if it matches any of multiple patterns', () => {
    const filter = createIncludeExtraFilesFilter(['.images/', '*.pdf']);
    assert.strictEqual(filter('.images/'), true);
    assert.strictEqual(filter('doc.pdf'), true);
    assert.strictEqual(filter('readme.md'), false);
  });
});

describe('copyTree with includeExtraFilesPatterns', () => {
  it('copies nothing extra when patterns is empty (no .images in output)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adowiki-copy-empty-'));
    try {
      const wikiRoot = path.join(tmpDir, 'wiki');
      const docsDir = path.join(tmpDir, 'docs');
      fs.mkdirSync(wikiRoot, { recursive: true });
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, '.order'), 'Section\n', 'utf-8');
      fs.mkdirSync(path.join(wikiRoot, 'Section'), { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, 'Section', '.order'), 'Sub\n', 'utf-8');
      fs.writeFileSync(path.join(wikiRoot, 'Section', 'Sub.md'), '# Sub', 'utf-8');
      fs.mkdirSync(path.join(wikiRoot, 'Section', '.images'), { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, 'Section', '.images', 'pic.png'), 'x', 'utf-8');

      const tree = buildTree(wikiRoot);
      assignOutputSlugs(tree);
      copyTree(wikiRoot, docsDir, tree, undefined, []);

      const sectionOut = path.join(docsDir, 'Section');
      assert.ok(fs.existsSync(path.join(sectionOut, 'Sub.md')), 'page from tree should be copied');
      assert.ok(!fs.existsSync(path.join(sectionOut, '.images')), '.images should not be copied when patterns empty');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('copies .images when pattern .images/ is included', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adowiki-copy-images-'));
    try {
      const wikiRoot = path.join(tmpDir, 'wiki');
      const docsDir = path.join(tmpDir, 'docs');
      fs.mkdirSync(wikiRoot, { recursive: true });
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, '.order'), 'Section\n', 'utf-8');
      fs.mkdirSync(path.join(wikiRoot, 'Section'), { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, 'Section', '.order'), 'Sub\n', 'utf-8');
      fs.writeFileSync(path.join(wikiRoot, 'Section', 'Sub.md'), '# Sub', 'utf-8');
      fs.mkdirSync(path.join(wikiRoot, 'Section', '.images'), { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, 'Section', '.images', 'pic.png'), 'x', 'utf-8');

      const tree = buildTree(wikiRoot);
      assignOutputSlugs(tree);
      copyTree(wikiRoot, docsDir, tree, undefined, ['.images/']);

      const imagesOut = path.join(docsDir, 'Section', '.images', 'pic.png');
      assert.ok(fs.existsSync(imagesOut), '.images should be copied when .images/ pattern is used');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('buildMkdocsYaml exclude_docs with includeExtraFiles', () => {
  it('contains !.attachments/ and each includeExtraFiles value prefixed with !', () => {
    const nav = buildNav([], '').nav;
    const yaml = buildMkdocsYaml('Site', nav, {
      input: '',
      output: '',
      siteName: 'Site',
      includeExtraFiles: ['.images/', '**/.images/'],
      plugin: [],
    });
    assert.ok(yaml.includes('!.attachments/'), 'exclude_docs must include !.attachments/');
    assert.ok(yaml.includes('!.images/'), 'exclude_docs must include !.images/ when in includeExtraFiles');
    assert.ok(yaml.includes('!**/.images/'), 'exclude_docs must include !**/.images/ when in includeExtraFiles');
  });

  it('contains only !.attachments/ when includeExtraFiles is empty', () => {
    const nav = buildNav([], '').nav;
    const yaml = buildMkdocsYaml('Site', nav, {
      input: '',
      output: '',
      siteName: 'Site',
      includeExtraFiles: [],
      plugin: [],
    });
    assert.ok(yaml.includes('!.attachments/'));
    assert.ok(!yaml.includes('!.images/'), 'should not hardcode .images when includeExtraFiles empty');
  });
});

describe('copyTree link rewrite (issue #12)', () => {
  it('rewrites in-content links from raw page name to slug path for %2D-style names', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adowiki-link-rewrite-'));
    try {
      const wikiRoot = path.join(tmpDir, 'wiki');
      const docsDir = path.join(tmpDir, 'docs');
      fs.mkdirSync(wikiRoot, { recursive: true });
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, '.order'), 'Home\nFoo--%2D-Bar\n', 'utf-8');
      fs.writeFileSync(path.join(wikiRoot, 'Home.md'), '# Home\n\nSee [Guide](Foo--%2D-Bar.md) for details.', 'utf-8');
      fs.writeFileSync(path.join(wikiRoot, 'Foo--%2D-Bar.md'), '# Guide', 'utf-8');

      const tree = buildTree(wikiRoot);
      assignOutputSlugs(tree);
      const linkRewriteMap = buildLinkRewriteMap(tree);
      copyTree(wikiRoot, docsDir, tree, undefined, [], '', '', linkRewriteMap);

      const homeOut = path.join(docsDir, 'Home.md');
      assert.ok(fs.existsSync(homeOut));
      const homeContent = fs.readFileSync(homeOut, 'utf-8');
      assert.ok(homeContent.includes('](Foo-Bar.md)') || homeContent.includes('](./Foo-Bar.md)'), 'markdown link should use slug path (or relative)');
      assert.ok(homeContent.includes('Foo-Bar.md'), 'markdown link should use slug path');
      assert.ok(!homeContent.includes('](Foo--%2D-Bar'), 'raw .md filename should not appear in link hrefs');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('emits relative links from a page inside a folder (e.g. ./Users-onboarding-guide.md)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adowiki-relative-folder-'));
    try {
      const wikiRoot = path.join(tmpDir, 'wiki');
      const docsDir = path.join(tmpDir, 'docs');
      fs.mkdirSync(wikiRoot, { recursive: true });
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, '.order'), 'Project-details\n', 'utf-8');
      fs.mkdirSync(path.join(wikiRoot, 'Project-details'), { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, 'Project-details', '.order'), 'Introduction\nUsers-onboarding-%2D-guide\n', 'utf-8');
      fs.writeFileSync(
        path.join(wikiRoot, 'Project-details', 'Introduction.md'),
        'See [Guide](./Users-onboarding-%2D-guide.md).',
        'utf-8'
      );
      fs.writeFileSync(path.join(wikiRoot, 'Project-details', 'Users-onboarding-%2D-guide.md'), '# Guide', 'utf-8');

      const tree = buildTree(wikiRoot);
      assignOutputSlugs(tree);
      const linkRewriteMap = buildLinkRewriteMap(tree);
      copyTree(wikiRoot, docsDir, tree, undefined, [], '', '', linkRewriteMap);

      const introOut = path.join(docsDir, 'Project-details', 'Introduction.md');
      assert.ok(fs.existsSync(introOut));
      const introContent = fs.readFileSync(introOut, 'utf-8');
      assert.ok(introContent.includes('](./Users-onboarding-guide.md)'), 'link from folder page should be relative (./Users-onboarding-guide.md)');
      assert.ok(!introContent.includes('Project-details/Users-onboarding-guide.md'), 'link should not be path from docs root');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('copyTree section index relative links', () => {
  it('writes section index with correct relative links to sibling and subpage links from _TOSP', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adowiki-section-index-'));
    try {
      const wikiRoot = path.join(tmpDir, 'wiki');
      const docsDir = path.join(tmpDir, 'docs');
      fs.mkdirSync(wikiRoot, { recursive: true });
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, '.order'), 'Section\nSibling\n', 'utf-8');
      fs.writeFileSync(
        path.join(wikiRoot, 'Section.md'),
        '# Section\n\nLink to [sibling](Sibling.md).\n\n[[_TOSP_]]',
        'utf-8'
      );
      fs.mkdirSync(path.join(wikiRoot, 'Section'), { recursive: true });
      fs.writeFileSync(path.join(wikiRoot, 'Section', '.order'), 'Sub\n', 'utf-8');
      fs.writeFileSync(path.join(wikiRoot, 'Section', 'Sub.md'), '# Sub', 'utf-8');
      fs.writeFileSync(path.join(wikiRoot, 'Sibling.md'), '# Sibling', 'utf-8');

      const tree = buildTree(wikiRoot);
      assignOutputSlugs(tree);
      const linkRewriteMap = buildLinkRewriteMap(tree);
      copyTree(wikiRoot, docsDir, tree, undefined, [], '', '', linkRewriteMap);

      const sectionIndexPath = path.join(docsDir, 'Section', 'index.md');
      assert.ok(fs.existsSync(sectionIndexPath), 'Section/index.md should exist');
      const content = fs.readFileSync(sectionIndexPath, 'utf-8');
      assert.ok(content.includes('../Sibling.md'), 'link to sibling should be ../Sibling.md from Section/index.md');
      assert.ok(content.includes('Sub.md') && content.includes('Sub'), '_TOSP_ should produce relative link to subpage');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

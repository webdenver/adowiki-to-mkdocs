import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { copyTree, createIncludeExtraFilesFilter } from '../src/copy.js';
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

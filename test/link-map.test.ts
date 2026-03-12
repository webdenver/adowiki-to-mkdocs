import assert from 'node:assert';
import { describe, it } from 'node:test';
import { assignOutputSlugs } from '../src/slug.js';
import { buildLinkRewriteMap } from '../src/link-map.js';
import type { TreeNode } from '../src/types.js';

describe('buildLinkRewriteMap', () => {
  it('maps raw page name and .md variant to slug path for file node', () => {
    const tree: TreeNode[] = [{ type: 'file', name: 'Foo--%2D-Bar' }];
    assignOutputSlugs(tree);
    const map = buildLinkRewriteMap(tree);
    assert.strictEqual(map.get('Foo--%2D-Bar'), 'Foo-Bar.md');
    assert.strictEqual(map.get('Foo--%2D-Bar.md'), 'Foo-Bar.md');
  });

  it('includes decoded name as key when different from raw', () => {
    const tree: TreeNode[] = [{ type: 'file', name: 'Foo--%2D-Bar' }];
    assignOutputSlugs(tree);
    const map = buildLinkRewriteMap(tree);
    const decoded = decodeURIComponent('Foo--%2D-Bar'); // %2D -> '-'
    assert.strictEqual(map.get(decoded), 'Foo-Bar.md');
    assert.strictEqual(map.get(decoded + '.md'), 'Foo-Bar.md');
  });

  it('maps path-from-root for nested page', () => {
    const tree: TreeNode[] = [
      {
        type: 'folder',
        name: 'Section',
        children: [{ type: 'file', name: 'API--%2D-Guide' }],
      },
    ];
    assignOutputSlugs(tree);
    const map = buildLinkRewriteMap(tree);
    assert.strictEqual(map.get('Section/API--%2D-Guide'), 'Section/API-Guide.md');
    assert.strictEqual(map.get('Section/API--%2D-Guide.md'), 'Section/API-Guide.md');
  });

  it('maps folder with index to section/index.md', () => {
    const tree: TreeNode[] = [
      {
        type: 'folder',
        name: 'Project-details',
        hasIndexMd: true,
        children: [],
      },
    ];
    assignOutputSlugs(tree);
    const map = buildLinkRewriteMap(tree);
    assert.strictEqual(map.get('Project-details'), 'Project-details/index.md');
    assert.strictEqual(map.get('Project-details.md'), 'Project-details/index.md');
    assert.strictEqual(map.get('Project-details/index.md'), 'Project-details/index.md');
  });
});

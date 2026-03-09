import assert from 'node:assert';
import { describe, it } from 'node:test';
import { assignOutputSlugs, nameToSlug } from '../src/slug.js';
import type { TreeNode } from '../src/types.js';

describe('nameToSlug', () => {
  it('decodes percent-encoded hyphen and produces safe path segment (no %2D in output)', () => {
    const slug = nameToSlug('API-publishing-on-Gateway--%2D-Guide');
    assert.ok(!slug.includes('%'), 'slug must not contain percent-encoding');
    assert.strictEqual(slug, 'API-publishing-on-Gateway-Guide');
  });

  it('decodes %20 to dash after normalization', () => {
    assert.strictEqual(nameToSlug('Hello%20World'), 'Hello-World');
  });

  it('keeps safe chars and collapses multiple dashes', () => {
    assert.strictEqual(nameToSlug('foo---bar'), 'foo-bar');
  });

  it('trims leading and trailing dashes', () => {
    assert.strictEqual(nameToSlug('--foo-bar--'), 'foo-bar');
  });

  it('returns default slug for empty result', () => {
    assert.strictEqual(nameToSlug('---'), 'page');
  });

  it('falls back to name on invalid percent-encoding', () => {
    const result = nameToSlug('hello%');
    assert.ok(result.includes('hello') || result === 'page');
  });
});

describe('assignOutputSlugs', () => {
  it('assigns unique slugs to all nodes', () => {
    const tree: TreeNode[] = [
      { type: 'file', name: 'Page-One' },
      { type: 'file', name: 'Page-One' },
      { type: 'folder', name: 'Section', children: [{ type: 'file', name: 'Sub' }] },
    ];
    assignOutputSlugs(tree);
    assert.strictEqual((tree[0] as { slug?: string }).slug, 'Page-One');
    assert.strictEqual((tree[1] as { slug?: string }).slug, 'Page-One-2');
    assert.strictEqual((tree[2] as { slug?: string }).slug, 'Section');
    assert.strictEqual((tree[2].type === 'folder' && tree[2].children[0] as { slug?: string }).slug, 'Sub');
  });

  it('disambiguates siblings that slugify to the same value', () => {
    const tree: TreeNode[] = [
      { type: 'file', name: 'API--%2D-Guide' },
      { type: 'file', name: 'API--%2D-Guide' },
    ];
    assignOutputSlugs(tree);
    const a = (tree[0] as { slug?: string }).slug;
    const b = (tree[1] as { slug?: string }).slug;
    assert.notStrictEqual(a, b);
    assert.strictEqual(a, 'API-Guide');
    assert.strictEqual(b, 'API-Guide-2');
  });
});

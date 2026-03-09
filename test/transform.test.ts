import assert from 'node:assert';
import { describe, it } from 'node:test';
import { transformAdoMarkdown } from '../src/transform.js';

describe('transformAdoMarkdown', () => {
  it('replaces [[_TOC_]] with [TOC] (single occurrence)', () => {
    const out = transformAdoMarkdown('Intro\n\n[[_TOC_]]\n\n# Section');
    assert.strictEqual(out, 'Intro\n\n[TOC]\n\n# Section');
  });

  it('replaces every [[_TOC_]] with [TOC] (multiple occurrences)', () => {
    const out = transformAdoMarkdown('[[_TOC_]] text [[_TOC_]]');
    assert.strictEqual(out, '[TOC] text [TOC]');
  });

  it('replaces [[_TOSP_]] with empty string when no subpageLinks', () => {
    const out = transformAdoMarkdown('Before [[_TOSP_]] after');
    assert.strictEqual(out, 'Before  after');
  });

  it('replaces [[_TOSP_]] with empty string when subpageLinks is empty array', () => {
    const out = transformAdoMarkdown('Before [[_TOSP_]] after', []);
    assert.strictEqual(out, 'Before  after');
  });

  it('replaces [[_TOSP_]] with markdown list when subpageLinks has one item', () => {
    const out = transformAdoMarkdown('Subpages:\n\n[[_TOSP_]]', [
      { title: 'Child Page', path: 'Child-Page.md' },
    ]);
    assert.strictEqual(out, 'Subpages:\n\n- [Child Page](Child-Page.md)');
  });

  it('replaces [[_TOSP_]] with markdown list when subpageLinks has multiple items', () => {
    const out = transformAdoMarkdown('[[_TOSP_]]', [
      { title: 'First', path: 'First.md' },
      { title: 'Second', path: 'Section/index.md' },
    ]);
    assert.strictEqual(
      out,
      '- [First](First.md)\n- [Second](Section/index.md)'
    );
  });

  it('handles both [[_TOC_]] and [[_TOSP_]] in same content', () => {
    const out = transformAdoMarkdown('[[_TOC_]]\n\n[[_TOSP_]]', [
      { title: 'Sub', path: 'Sub.md' },
    ]);
    assert.strictEqual(out, '[TOC]\n\n- [Sub](Sub.md)');
  });

  it('leaves content without tags unchanged', () => {
    const content = '# Hello\n\nNo ADO tags here.';
    assert.strictEqual(transformAdoMarkdown(content), content);
  });

  it('returns empty string for empty content', () => {
    assert.strictEqual(transformAdoMarkdown(''), '');
  });

  it('replaces every [[_TOSP_]] when multiple and subpageLinks provided', () => {
    const out = transformAdoMarkdown('[[_TOSP_]] x [[_TOSP_]]', [
      { title: 'A', path: 'a.md' },
    ]);
    assert.strictEqual(out, '- [A](a.md) x - [A](a.md)');
  });
});

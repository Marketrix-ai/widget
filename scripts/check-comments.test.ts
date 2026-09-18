/**
 * Tests for `check-comments.ts`'s `checkComments`: the comment gate that enforces this repo's
 * zero-inline-comment rule.
 */
import { describe, expect, it } from 'bun:test';

import { checkComments } from './check-comments';

describe('checkComments', () => {
  it('passes a short top docstring with no other comments', () => {
    const source = '/**\n * A file.\n */\nexport const x = 1;\n';
    expect(checkComments('f.ts', source)).toEqual([]);
  });

  it('passes a top docstring at exactly the line limit, flags one line over', () => {
    const bodyLines = (n: number) => Array.from({ length: n }, () => ' * line').join('\n');
    const atLimit = `/**\n${bodyLines(10)}\n */\nexport const x = 1;\n`;
    expect(checkComments('f.ts', atLimit)).toEqual([]);

    const overLimit = `/**\n${bodyLines(11)}\n */\nexport const x = 1;\n`;
    const violations = checkComments('f.ts', overLimit);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/top docstring is 13 lines, max 12/);
  });

  it('flags an inline comment after the header, with its line number', () => {
    const source = '/**\n * A file.\n */\nexport const x = 1;\n// stray\nexport const y = 2;\n';
    expect(checkComments('f.ts', source)).toEqual(['f.ts:5: inline comment outside the top docstring']);
  });

  it('does not let a leading directive prologue disqualify the header that follows it', () => {
    const source = "'use client';\n\n/**\n * A file.\n */\nexport const x = 1;\n";
    expect(checkComments('f.tsx', source)).toEqual([]);
  });

  it('exempts eslint-disable, ts-expect-error and ponytail directives in both comment styles', () => {
    const source = [
      '/**\n * A file.\n */',
      'export const x = 1; // eslint-disable-line no-console',
      '// @ts-expect-error deliberate',
      '// ponytail: shortcut, revisit later',
      '{/* eslint-disable-next-line @next/next/no-img-element */}',
    ].join('\n');
    expect(checkComments('f.tsx', source)).toEqual([]);
  });

  it('never mistakes a regex literal containing slash-comment-like sequences for a comment', () => {
    const source =
      "/**\n * A file.\n */\nconst r = /^(\\/\\/\\/|\\/[/*])/;\nconst rel = x.replace(/^\\/?_next\\//, '');\n";
    expect(checkComments('f.ts', source)).toEqual([]);
  });

  it('never desyncs on a template literal with a substitution into a false comment', () => {
    const source =
      '/**\n * A file.\n */\nconst url = `https://example.com/api/${route}?namespace=mtx-dev`;\nconst allowed = 1;\n';
    expect(checkComments('f.ts', source)).toEqual([]);
  });

  it('still catches a real comment after a template-literal substitution, not swallowed by the desync fix', () => {
    const source = '/**\n * A file.\n */\nconst url = `x/${route}/y`;\n// a real stray comment\nconst z = 1;\n';
    expect(checkComments('f.ts', source)).toEqual(['f.ts:5: inline comment outside the top docstring']);
  });
});

/**
 * The Rule 0 gate: every `.ts`/`.tsx`/`.mts`/`.mjs`/`.js` file under the working directory may carry one top
 * `/**` docstring of at most 12 lines and no other comment, except the machine-read directives in `EXEMPT`.
 * `checkComments` scans only the trivia between the parser's tokens, so a `//` inside a string, regex, template or
 * JSX text never counts; `findCodeFiles` skips build output and generated `gen` code. The public widget carries a
 * byte-identical copy, because it cannot fetch this private repo.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import ts from 'typescript';

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.astro',
  '.next',
  '.git',
  '.samples-check',
  '.work',
  '.worktrees',
  '.claude',
  'gen',
]);
const CODE_EXT = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js']);
const EXEMPT = /^(<reference|eslint-disable|prettier-ignore|@ts-|@type\s|ponytail:)/;
const MAX_HEADER_LINES = 12;

export function findCodeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : findCodeFiles(full);
    return CODE_EXT.has(extname(entry.name)) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

export function checkComments(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const ranges: ts.TextRange[] = [];
  const scanTrivia = (pos: number, end: number) => {
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      false,
      ts.LanguageVariant.Standard,
      text,
      undefined,
      pos,
      end - pos,
    );
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan())
      if (kind === ts.SyntaxKind.SingleLineCommentTrivia || kind === ts.SyntaxKind.MultiLineCommentTrivia)
        ranges.push({ pos: scanner.getTokenStart(), end: scanner.getTokenEnd() });
  };
  const visit = (node: ts.Node) => {
    const children = node.getChildren(source);
    if (children.length > 0) children.forEach(visit);
    else if (!ts.isJsxText(node)) scanTrivia(node.pos, node.getStart(source));
  };
  visit(source);
  return ranges.flatMap((range, index) => {
    const raw = text.slice(range.pos, range.end);
    if (index === 0 && raw.startsWith('/**')) {
      const lines = raw.split('\n').length;
      return lines > MAX_HEADER_LINES ? [`${file}: top docstring is ${lines} lines, max ${MAX_HEADER_LINES}`] : [];
    }
    const body = raw.replace(/^\/\/\/?\s?|^\/\*\*?\s?/, '').trim();
    return EXEMPT.test(body)
      ? []
      : [`${file}:${text.slice(0, range.pos).split('\n').length}: comment outside the top docstring`];
  });
}

if (import.meta.main) {
  const root = process.cwd();
  const violations = findCodeFiles(root).flatMap(f => checkComments(f.slice(root.length + 1), readFileSync(f, 'utf8')));
  for (const v of violations) console.error(v);
  if (violations.length > 0) process.exit(1);
}

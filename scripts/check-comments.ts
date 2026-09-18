/**
 * Enforces Rule 0 (one top docstring, no inline comments) on this repo's own `.ts`/`.tsx`/`.mjs`/`.js`
 * files. `checkComments` tokenizes one file with the real TypeScript scanner, disambiguating a `/` as
 * division or a regex and tracking template-substitution depth so neither desyncs it, and treats a
 * leading `'use client'`-style directive as prologue rather than code disqualifying the header after it.
 * `findCodeFiles` walks the repo, skipping build output, `.d.ts` files and `src/sdk` (the generated
 * mirror this repo never hand-edits). Adapted from `monitor/scripts/check-comments.ts`. Run standalone
 * with `bun scripts/check-comments.ts`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import ts from 'typescript';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.work', 'sdk']);
const CODE_EXT = new Set(['.ts', '.tsx', '.mjs', '.js']);
const EXEMPT = /^(<reference|eslint-disable|prettier-ignore|@ts-|ponytail:)/;
const MAX_HEADER_LINES = 12;
const VALUE_PRODUCING = new Set([
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.CloseParenToken,
  ts.SyntaxKind.CloseBracketToken,
  ts.SyntaxKind.PlusPlusToken,
  ts.SyntaxKind.MinusMinusToken,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.ThisKeyword,
  ts.SyntaxKind.SuperKeyword,
  ts.SyntaxKind.RegularExpressionLiteral,
]);

export function findCodeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.endsWith('.d.ts')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findCodeFiles(full));
    else if (CODE_EXT.has(extname(entry))) out.push(full);
  }
  return out;
}

export function checkComments(file: string, source: string): string[] {
  const violations: string[] = [];
  const text = source.startsWith('#!') ? source.slice(source.indexOf('\n') + 1) : source;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, text);
  let sawTopDoc = false;
  let sawCode = false;
  let inPrologue = true;
  let braceDepth = 0;
  let prevSignificant: ts.SyntaxKind | undefined;
  const templateStack: number[] = [];
  for (let tok = scanner.scan(); tok !== ts.SyntaxKind.EndOfFileToken; tok = scanner.scan()) {
    if (
      (tok === ts.SyntaxKind.SlashToken || tok === ts.SyntaxKind.SlashEqualsToken) &&
      (prevSignificant === undefined || !VALUE_PRODUCING.has(prevSignificant))
    ) {
      tok = scanner.reScanSlashToken();
    }
    if (tok === ts.SyntaxKind.TemplateHead) templateStack.push(braceDepth);
    else if (tok === ts.SyntaxKind.OpenBraceToken) braceDepth++;
    else if (tok === ts.SyntaxKind.CloseBraceToken && templateStack[templateStack.length - 1] === braceDepth) {
      tok = scanner.reScanTemplateToken(false);
      if (tok === ts.SyntaxKind.TemplateTail) templateStack.pop();
    } else if (tok === ts.SyntaxKind.CloseBraceToken) braceDepth--;

    const isComment = tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia;
    const isTrivia = tok === ts.SyntaxKind.WhitespaceTrivia || tok === ts.SyntaxKind.NewLineTrivia;
    if (!isComment && !isTrivia) prevSignificant = tok;
    if (!isComment) {
      const isDirective = tok === ts.SyntaxKind.StringLiteral || tok === ts.SyntaxKind.SemicolonToken;
      if (!isTrivia && !(inPrologue && isDirective)) {
        sawCode = true;
        inPrologue = false;
      }
      continue;
    }
    const raw = scanner.getTokenText();
    const line = text.slice(0, scanner.getTokenPos()).split('\n').length;
    if (!sawCode && !sawTopDoc && raw.startsWith('/**')) {
      sawTopDoc = true;
      const lines = raw.split('\n').length;
      if (lines > MAX_HEADER_LINES)
        violations.push(`${file}: top docstring is ${lines} lines, max ${MAX_HEADER_LINES}`);
    } else if (!EXEMPT.test(raw.replace(/^[/*]+/, '').trimStart())) {
      violations.push(`${file}:${line}: inline comment outside the top docstring`);
    }
  }
  return violations;
}

if (import.meta.main) {
  const root = new URL('..', import.meta.url).pathname;
  const violations = findCodeFiles(root).flatMap(f => checkComments(f.slice(root.length), readFileSync(f, 'utf8')));
  for (const v of violations) console.error(v);
  if (violations.length > 0) process.exit(1);
}

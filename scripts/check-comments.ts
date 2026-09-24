/**
 * The Rule 0 gate: every tracked source file under the working directory — JS/TS, SQL, shell, YAML, Dockerfile,
 * env example, proto, TOML, Terraform, Make, Tilt, CSS, nginx conf and ignore files — may carry one top docstring
 * of at most 12 lines and no other comment, except machine-read directives. Python is gated by the agent's checker.
 * `checkComments` reads JS/TS trivia through the parser, so a `//` inside a string, regex, template or JSX text
 * never counts, and lexes the other languages' `#`, `--`, `//` and `/*` comments outside quotes and heredocs.
 * `findCodeFiles` lists what git tracks or would track, minus generated code and any path whose `.gitattributes`
 * sets `rule0=frozen`: a file whose bytes are digest-checked once applied, such as an applied SQL patch, cannot be
 * edited. The public widget carries a byte-identical copy, because it cannot fetch this private repo.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

import ts from 'typescript';

const SKIP_DIRS = new Set(['.samples-check', '.work', '.worktrees', '.claude', 'gen']);
const LINE_MARKERS: Record<string, string> = {
  '.sh': '#',
  '.bash': '#',
  '.yaml': '#',
  '.yml': '#',
  '.sql': '--',
  '.proto': '//',
  '.toml': '#',
  '.tf': '#',
  '.conf': '#',
  '.css': '/*',
};
const EXEMPT =
  /^(<reference|eslint-disable|prettier-ignore|@ts-|@type\s|ponytail:|!|shellcheck\s|noqa|type:\s*ignore|syntax=|escape=|yaml-language-server:)/;
const MAX_HEADER_LINES = 12;

type Comment = { line: number; raw: string; alone: boolean };

export function commentMarker(file: string): string | undefined {
  const name = basename(file);
  if (name.endsWith('.d.ts') || name.endsWith('.enc.yaml')) return undefined;
  if (['.ts', '.tsx', '.mts', '.mjs', '.js'].includes(extname(name))) return 'ts';
  if (
    /^Dockerfile(\..+)?$|\.Dockerfile$|^\.env(\..+)?\.(example|sample)$|^(Makefile|Tiltfile|\.gitignore|\.dockerignore)$/.test(
      name,
    )
  )
    return '#';
  return LINE_MARKERS[extname(name)];
}

export function findCodeFiles(dir: string): string[] {
  const git = (args: string[], input?: string) => execFileSync('git', args, { cwd: dir, input }).toString().split('\0');
  const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).filter(
    f => f && commentMarker(f) && !f.split('/').some(part => SKIP_DIRS.has(part)),
  );
  const attributes = git(['check-attr', '-z', '--stdin', 'rule0'], files.map(f => `${f}\0`).join(''));
  const frozen = new Set(attributes.filter((_, i) => i % 3 === 0 && attributes[i + 2] === 'frozen'));
  return files.filter(f => !frozen.has(f)).map(f => join(dir, f));
}

function tsComments(file: string, text: string): Comment[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const comments: Comment[] = [];
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
        comments.push({
          line: text.slice(0, scanner.getTokenStart()).split('\n').length,
          raw: text.slice(scanner.getTokenStart(), scanner.getTokenEnd()),
          alone: false,
        });
  };
  const visit = (node: ts.Node) => {
    const children = node.getChildren(source);
    if (children.length > 0) children.forEach(visit);
    else if (!ts.isJsxText(node)) scanTrivia(node.pos, node.getStart(source));
  };
  visit(source);
  return comments;
}

function lexComments(text: string, marker: string): { comments: Comment[]; firstCode: number } {
  const comments: Comment[] = [];
  let firstCode = Infinity;
  let heredoc: string | undefined;
  let block: Comment | undefined;
  text.split('\n').forEach((line, index) => {
    const number = index + 1;
    if (heredoc !== undefined) {
      if (line.trim() === heredoc) heredoc = undefined;
      return;
    }
    let code = '';
    let quote: string | undefined;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (block) {
        if (!line.startsWith('*/', i)) continue;
        block.raw += `\n${line.slice(0, i + 2)}`;
        comments.push(block);
        block = undefined;
        i++;
      } else if (quote) {
        code += c;
        if (c === '\\' && quote === '"') code += line[++i] ?? '';
        else if (c === quote) quote = undefined;
      } else if ((c === '"' || c === "'") && !/\w/.test(line[i - 1] ?? '')) {
        code += c;
        quote = c;
      } else if ((marker === '//' || marker === '/*') && line.startsWith('/*', i)) {
        const end = line.indexOf('*/', i + 2);
        const opened = { line: number, raw: line.slice(i, end < 0 ? undefined : end + 2), alone: code.trim() === '' };
        if (end < 0) {
          block = opened;
          break;
        }
        comments.push(opened);
        i = end + 1;
      } else if (line.startsWith(marker, i) && (marker !== '#' || /\s/.test(line[i - 1] ?? ' '))) {
        comments.push({ line: number, raw: line.slice(i), alone: code.trim() === '' });
        break;
      } else {
        code += c;
      }
    }
    if (block && block.line !== number && !line.includes('*/')) block.raw += `\n${line}`;
    if (code.trim() !== '') firstCode = Math.min(firstCode, number);
    const doc = marker === '#' && /<<-?\s*['"]?([A-Za-z_]\w*)['"]?/.exec(code);
    if (doc) heredoc = doc[1];
  });
  return { comments, firstCode };
}

export function checkComments(file: string, text: string): string[] {
  const marker = commentMarker(file) ?? '#';
  const directive = (c: Comment) => EXEMPT.test(c.raw.replace(/^(\/\/\/?|\/\*\*?|#|--)\s?/, '').trim());
  let judged: Comment[];
  let header: Comment[] = [];
  if (marker === 'ts') {
    const all = tsComments(file, text);
    header = all[0]?.raw.startsWith('/**') ? [all[0]] : [];
    judged = all.filter(c => !directive(c));
  } else {
    const { comments, firstCode } = lexComments(text, marker);
    judged = comments.filter(c => !directive(c));
    for (const c of judged) {
      const previous = header.at(-1);
      const next = previous ? previous.line + previous.raw.split('\n').length : undefined;
      if (c.line >= firstCode || !c.alone || (previous && (c.line !== next || c.raw.startsWith('/*')))) break;
      header.push(c);
    }
  }
  const [first, last] = [header[0], header.at(-1)];
  const span = first && last ? last.line + last.raw.split('\n').length - first.line : 0;
  return [
    ...(span > MAX_HEADER_LINES ? [`${file}: top docstring is ${span} lines, max ${MAX_HEADER_LINES}`] : []),
    ...judged.filter(c => !header.includes(c)).map(c => `${file}:${c.line}: comment outside the top docstring`),
  ];
}

if (import.meta.main) {
  const root = process.cwd();
  const violations = findCodeFiles(root).flatMap(f => checkComments(f.slice(root.length + 1), readFileSync(f, 'utf8')));
  for (const v of violations) console.error(v);
  if (violations.length > 0) process.exit(1);
}

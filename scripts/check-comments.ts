/**
 * The one Rule 0 gate for every repo: every tracked source file — JS/TS, Python, SQL, shell, YAML and Helm
 * templates, Dockerfile, env example, proto, TOML, Terraform, Make, Tilt, CSS, nginx conf, MDX, HTML and ignore
 * files — may carry one top docstring of at most 12 lines and no other comment. `EXEMPT` is the constitution's
 * directive list and its only implementation. `checkComments` reads JS/TS trivia through the parser, measures a
 * Python module docstring and flags every later string statement (a function or class docstring), and lexes every
 * other language's comments outside quotes and heredocs.
 * `findCodeFiles` lists what git tracks or would track, minus generated code and any path whose `.gitattributes`
 * sets `rule0=frozen`: a file whose bytes are digest-checked once applied, such as an applied SQL patch, cannot be
 * edited. The public widget carries a byte-identical copy, because it cannot fetch this private repo.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

import ts from 'typescript';

const SKIP_DIRS = new Set(['.samples-check', '.work', '.worktrees', '.claude', 'gen', 'generated']);
type Syntax = { line?: string; open?: RegExp; close?: RegExp; quotes: boolean };
const C_BLOCK = { open: /^\/\*/, close: /\*\// };
const HASH: Syntax = { line: '#', quotes: true };
const SYNTAX: Record<string, Syntax> = {
  '#': HASH,
  helm: {
    line: '#',
    open: /^\{\{-?\s*\/\*/,
    close: /\*\/\s*-?\}\}/,
    quotes: true,
  },
  '--': { line: '--', quotes: true },
  '//': { line: '//', ...C_BLOCK, quotes: true },
  '/*': { ...C_BLOCK, quotes: true },
  mdx: { open: /^\{\/\*/, close: /\*\/\}/, quotes: false },
  html: { open: /^<!--/, close: /-->/, quotes: false },
};
const EXTENSIONS: Record<string, string> = {
  '.sh': '#',
  '.bash': '#',
  '.yaml': 'helm',
  '.yml': 'helm',
  '.tpl': 'helm',
  '.sql': '--',
  '.proto': '//',
  '.toml': '#',
  '.tf': '#',
  '.conf': '#',
  '.css': '/*',
  '.mdx': 'mdx',
  '.html': 'html',
  '.py': 'py',
};
const EXEMPT =
  /^(<reference|eslint-disable|prettier-ignore|@ts-|@type\s|ponytail:|!|noqa|type:\s*ignore|ty:\s*ignore|syntax=)/;
const MAX_HEADER_LINES = 12;

type Comment = { line: number; raw: string; alone: boolean; block?: boolean };

export function commentMarker(file: string): string | undefined {
  const name = basename(file);
  if (name.endsWith('.enc.yaml') || /_pb2(_grpc)?\.py$/.test(name)) return undefined;
  if (['.ts', '.tsx', '.mts', '.mjs', '.js'].includes(extname(name))) return 'ts';
  if (
    /^Dockerfile(\..+)?$|\.Dockerfile$|^\.env(\..+)?\.(example|sample)$|^(Makefile|Tiltfile|\.gitignore|\.dockerignore)$/.test(
      name,
    )
  )
    return '#';
  return EXTENSIONS[extname(name)];
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

function tsComments(file: string, text: string): { comments: Comment[]; firstCode: number } {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const lineOf = (pos: number) => text.slice(0, pos).split('\n').length;
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
          line: lineOf(scanner.getTokenStart()),
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
  const code = source.statements.find(s => !(ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression)));
  return { comments, firstCode: code ? lineOf(code.getStart(source)) : Infinity };
}

function lexComments(text: string, syntax: Syntax): { comments: Comment[]; firstCode: number } {
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
    let i = 0;
    if (block) {
      const end = syntax.close?.exec(line);
      block.raw += `\n${end ? line.slice(0, end.index + end[0].length) : line}`;
      if (!end) return;
      comments.push(block);
      block = undefined;
      i = end.index + end[0].length;
    }
    for (; i < line.length; i++) {
      const c = line[i];
      const open = !quote && syntax.open?.exec(line.slice(i));
      if (quote) {
        code += c;
        if (c === '\\' && quote === '"') code += line[++i] ?? '';
        else if (c === quote) quote = undefined;
      } else if (syntax.quotes && (c === '"' || c === "'") && !/\w/.test(line[i - 1] ?? '')) {
        code += c;
        quote = c;
      } else if (open) {
        const end = syntax.close?.exec(line.slice(i + open[0].length));
        const stop = end ? i + open[0].length + end.index + end[0].length : line.length;
        const opened = {
          line: number,
          raw: line.slice(i, stop),
          alone: code.trim() === '',
          block: true,
        };
        if (!end) {
          block = opened;
          break;
        }
        comments.push(opened);
        i = stop - 1;
      } else if (
        syntax.line &&
        line.startsWith(syntax.line, i) &&
        (syntax.line !== '#' || /\s/.test(line[i - 1] ?? ' '))
      ) {
        comments.push({
          line: number,
          raw: line.slice(i),
          alone: code.trim() === '',
        });
        break;
      } else {
        code += c;
      }
    }
    if (code.trim() !== '') firstCode = Math.min(firstCode, number);
    const doc = syntax.line === '#' && /<<-?\s*['"]?([A-Za-z_]\w*)['"]?/.exec(code);
    if (doc) heredoc = doc[1];
  });
  return { comments, firstCode };
}

function pythonComments(text: string): {
  comments: Comment[];
  docstring: number;
} {
  const comments: Comment[] = [];
  let docstring = 0;
  let seenCode = false;
  let lineStart = 0;
  let line = 1;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    if (c === '\n') {
      line++;
      lineStart = i + 1;
    } else if (c === '#') {
      const end = text.indexOf('\n', i);
      const raw = text.slice(i, end < 0 ? undefined : end);
      comments.push({
        line,
        raw,
        alone: text.slice(lineStart, i).trim() === '',
      });
      i += raw.length - 1;
    } else if (/^[rRuUbBfF]{1,2}["']/.test(text.slice(i, i + 3)) && !/\w/.test(text[i - 1] ?? '')) {
      i += /["']/.test(text.charAt(i + 1)) ? 0 : 1;
    } else if (c === '"' || c === "'") {
      const delimiter = text.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
      let j = i + delimiter.length;
      while (j < text.length && !text.startsWith(delimiter, j)) j += text[j] === '\\' ? 2 : 1;
      const body = text.slice(i + delimiter.length, j);
      const rest = text.slice(j + delimiter.length).split('\n', 1)[0] ?? '';
      const statement =
        depth === 0 &&
        /^[rRuUbBfF]{0,2}$/.test(text.slice(lineStart, i).trim()) &&
        !/\\\r?\n$/.test(text.slice(Math.max(0, lineStart - 3), lineStart)) &&
        /^\s*(#.*)?$/.test(rest);
      if (!seenCode) docstring = body.trim().split('\n').length;
      else if (statement) comments.push({ line, raw: text.slice(i, j + delimiter.length), alone: true, block: true });
      seenCode = true;
      line += (body.match(/\n/g) ?? []).length;
      i = j + delimiter.length - 1;
    } else if (c && !/\s/.test(c)) {
      seenCode = true;
    }
  }
  return { comments, docstring };
}

export function checkComments(file: string, text: string): string[] {
  const marker = commentMarker(file) ?? '#';
  const directive = (c: Comment) => EXEMPT.test(c.raw.replace(/^(\/\/\/?|\/\*\*?|#|--)\s?/, '').trim());
  let judged: Comment[];
  let header: Comment[] = [];
  let span = 0;
  if (marker === 'ts') {
    const { comments: all, firstCode } = tsComments(file, text);
    header = all[0] && all[0].raw.startsWith('/**') && all[0].line < firstCode ? [all[0]] : [];
    judged = all.filter(c => !directive(c));
  } else if (marker === 'py') {
    const { comments, docstring } = pythonComments(text);
    judged = comments.filter(c => !directive(c));
    span = docstring;
  } else {
    const { comments, firstCode } = lexComments(text, SYNTAX[marker] ?? HASH);
    judged = comments.filter(c => !directive(c));
    for (const c of judged) {
      const previous = header.at(-1);
      const next = previous ? previous.line + previous.raw.split('\n').length : undefined;
      if (c.line >= firstCode || !c.alone || (previous && (c.line !== next || c.block || previous.block))) break;
      header.push(c);
    }
  }
  const [first, last] = [header[0], header.at(-1)];
  if (first && last) span = last.line + last.raw.split('\n').length - first.line;
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

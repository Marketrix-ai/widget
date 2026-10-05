/**
 * The one strict-typing gate for every repo: no declaration may stand on a loose type. `checkTypes` builds each
 * tracked tsconfig's program (a strict default for TypeScript outside one), asks the type checker for the type of
 * every variable, parameter, property, binding and function return, and refuses `any`, `object`, `{}`, a
 * string index of `unknown`, an arbitrary-JSON union, and `unknown` itself except as an annotated parameter or a catch binding, the one honest
 * type of input still to be parsed. It also refuses an `any` value flowing into an initializer, return, property or an
 * argument not typed `unknown`, a generic overload over a non-generic implementation (a cast by signature), type
 * assertions other than `as const`, `@ts-` directives and loose zod builders; Python files go to `check_types.py`, run
 * on the interpreter a repo pins in `.python-version` (through `uv`, since newer syntax fails to parse on an older
 * one) or else the system `python3`, and Go files may not use `any` or `interface{}`.
 * Generated code is skipped exactly as `check-comments.ts` skips it, so a mirror is judged in the repo it comes from.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import ts from 'typescript';

import { findCodeFiles } from './check-comments.ts';

type Issue = { file: string; line: number; message: string };

const TS_FILE = /\.(c|m)?tsx?$/;
const CONTAINERS = new Set([
  'Array',
  'ReadonlyArray',
  'Promise',
  'PromiseLike',
  'Map',
  'ReadonlyMap',
  'Set',
  'ReadonlySet',
  'WeakMap',
  'WeakSet',
]);
const YIELDERS = new Set([
  'Generator',
  'AsyncGenerator',
  'Iterator',
  'AsyncIterator',
  'IterableIterator',
  'AsyncIterableIterator',
]);
const LOOSE_ZOD = new Set(['any', 'unknown', 'object', 'looseObject', 'json']);
const LOOSE_ZOD_METHODS = new Set(['passthrough', 'catchall', 'strip', 'loose']);
const DEFAULT_OPTIONS: ts.CompilerOptions = {
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  resolveJsonModule: true,
  allowImportingTsExtensions: true,
  noEmit: true,
  skipLibCheck: true,
  jsx: ts.JsxEmit.ReactJSX,
};

type Declared =
  | ts.VariableDeclaration
  | ts.ParameterDeclaration
  | ts.PropertyDeclaration
  | ts.PropertySignature
  | ts.BindingElement
  | ts.SignatureDeclaration;

const isObjectType = (type: ts.Type): type is ts.ObjectType => (type.flags & ts.TypeFlags.Object) !== 0;
const isReference = (type: ts.ObjectType): type is ts.TypeReference =>
  (type.objectFlags & ts.ObjectFlags.Reference) !== 0;

const fromLibrary = (symbol: ts.Symbol): boolean =>
  (symbol.declarations ?? []).every(declaration => declaration.getSourceFile().fileName.includes('/node_modules/'));

function isArbitraryJson(checker: ts.TypeChecker, type: ts.UnionType): boolean {
  const has = (flag: ts.TypeFlags): boolean => type.types.some(member => (member.flags & flag) !== 0);
  if (!has(ts.TypeFlags.StringLike) || !has(ts.TypeFlags.NumberLike) || !has(ts.TypeFlags.Null)) return false;
  return type.types.some(member => {
    const index = checker.getIndexInfosOfType(member).find(info => info.keyType.flags & ts.TypeFlags.String);
    return (
      index !== undefined &&
      (index.type === type ||
        (index.type.isUnion() &&
          index.type.types.some(part => type.types.includes(part) && part.flags & ts.TypeFlags.Object)))
    );
  });
}

function looseness(checker: ts.TypeChecker, type: ts.Type, depth = 0, seen = new Set<ts.Type>()): string | undefined {
  if (seen.has(type)) return undefined;
  seen.add(type);
  if (depth > 0 && type.aliasSymbol && type.aliasSymbol.name !== 'Record' && fromLibrary(type.aliasSymbol))
    return undefined;
  if (type.flags & ts.TypeFlags.Any) return 'any';
  if (type.flags & ts.TypeFlags.Unknown) return 'unknown';
  if (type.flags & ts.TypeFlags.NonPrimitive) return 'object';
  if (type.isUnion() && isArbitraryJson(checker, type)) return 'arbitrary JSON';
  if (type.isUnionOrIntersection()) {
    for (const part of type.types) {
      const found = looseness(checker, part, depth, seen);
      if (found) return found;
    }
    return undefined;
  }
  if (!isObjectType(type) || depth > 3) return undefined;
  const index = checker.getIndexInfosOfType(type).find(info => info.keyType.flags & ts.TypeFlags.String);
  if (index && index.type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return 'Record<string, unknown>';
  if (type.objectFlags & ts.ObjectFlags.ObjectLiteral) {
    for (const property of checker.getPropertiesOfType(type)) {
      const found = looseness(checker, checker.getTypeOfSymbol(property), depth + 1, seen);
      if (found) return `{ ${property.name}: ${found} }`;
    }
    return undefined;
  }
  if (
    type.objectFlags & ts.ObjectFlags.Anonymous &&
    checker.getPropertiesOfType(type).length === 0 &&
    checker.getSignaturesOfType(type, ts.SignatureKind.Call).length === 0 &&
    checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length === 0 &&
    checker.getIndexInfosOfType(type).length === 0
  ) {
    return '{}';
  }
  if (isReference(type)) {
    const target = type.target.symbol?.name ?? '';
    const tuple = (type.target.objectFlags & ts.ObjectFlags.Tuple) !== 0;
    const judged =
      tuple || CONTAINERS.has(target)
        ? checker.getTypeArguments(type)
        : YIELDERS.has(target)
          ? checker.getTypeArguments(type).slice(0, 1)
          : [];
    for (const argument of judged) {
      const found = looseness(checker, argument, depth + 1, seen);
      if (found) return `${checker.typeToString(type)} carrying ${found}`;
    }
  }
  return undefined;
}

function unknownAllowed(node: ts.Node): boolean {
  if (ts.isParameter(node)) return node.type?.kind === ts.SyntaxKind.UnknownKeyword;
  return ts.isVariableDeclaration(node) && ts.isCatchClause(node.parent);
}

function declaredName(node: Declared, source: ts.SourceFile): string {
  return ts.getNameOfDeclaration(node)?.getText(source) ?? ts.SyntaxKind[node.kind];
}

function checkTsSource(checker: ts.TypeChecker, source: ts.SourceFile, file: string): Issue[] {
  const issues: Issue[] = [];
  const add = (node: ts.Node, message: string): void => {
    issues.push({
      file,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      message,
    });
  };
  for (const match of source.text.matchAll(/@ts-(ignore|nocheck|expect-error)/g)) {
    issues.push({
      file,
      line: source.text.slice(0, match.index).split('\n').length,
      message: `${match[0]} directive`,
    });
  }
  const judge = (node: Declared, type: ts.Type, what: string): void => {
    const found = looseness(checker, type);
    if (!found || (found === 'unknown' && unknownAllowed(node))) return;
    add(node, `${what} \`${declaredName(node, source)}\` is ${found}`);
  };
  const isAny = (expression: ts.Expression): boolean =>
    (checker.getTypeAtLocation(expression).flags & ts.TypeFlags.Any) !== 0;
  const flows = (expression: ts.Expression | undefined, into: string): void => {
    if (expression && isAny(expression)) add(expression, `an \`any\` value flows into ${into}`);
  };
  const visit = (node: ts.Node): void => {
    if ((ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isParameter(node)) && node.type) {
      flows(node.initializer, `\`${node.name.getText(source)}\``);
    }
    if (ts.isReturnStatement(node)) flows(node.expression, 'a return');
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.body && !node.typeParameters?.length) {
      const symbol = node.name ? checker.getSymbolAtLocation(node.name) : undefined;
      const overloads = (symbol?.declarations ?? []).filter(
        declaration =>
          declaration !== node && ts.isFunctionLike(declaration) && !('body' in declaration && declaration.body),
      );
      if (overloads.some(overload => ts.isFunctionLike(overload) && overload.typeParameters?.length)) {
        add(
          node,
          `overload implementation \`${node.name?.getText(source) ?? ''}\` erases its overloads' type parameters`,
        );
      }
    }
    if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) flows(node.body, 'a return');
    if (ts.isPropertyAssignment(node)) flows(node.initializer, `property \`${node.name.getText(source)}\``);
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const signature = checker.getResolvedSignature(node);
      (node.arguments ?? []).forEach((argument, index) => {
        if (!isAny(argument) || !signature) return;
        const parameter = signature.getParameters()[Math.min(index, signature.getParameters().length - 1)];
        const expected = parameter ? checker.getTypeOfSymbol(parameter) : undefined;
        const open = expected && expected.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any);
        if (!open) add(argument, 'an `any` value flows into an argument');
      });
    }
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isPropertySignature(node) ||
      ts.isBindingElement(node)
    ) {
      if (
        !(ts.isBindingElement(node) && !ts.isIdentifier(node.name)) &&
        !(ts.isVariableDeclaration(node) && !ts.isIdentifier(node.name))
      ) {
        judge(node, checker.getTypeAtLocation(node), 'declaration');
      }
    }
    if (ts.isFunctionLike(node) && 'body' in node && node.body) {
      const signature = checker.getSignatureFromDeclaration(node);
      if (signature) {
        const returned = checker.getReturnTypeOfSignature(signature);
        const found = looseness(checker, returned);
        if (found) add(node, `return of \`${declaredName(node, source)}\` is ${found}`);
      }
    }
    if (
      ts.isAsExpression(node) &&
      !(ts.isTypeReferenceNode(node.type) && node.type.typeName.getText(source) === 'const')
    ) {
      add(node, `type assertion \`as ${node.type.getText(source)}\``);
    }
    if (ts.isTypeAssertionExpression(node)) add(node, `type assertion \`<${node.type.getText(source)}>\``);
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression.expression;
      const method = node.expression.name.text;
      if (ts.isIdentifier(target) && target.text === 'z' && LOOSE_ZOD.has(method))
        add(node, `loose schema z.${method}()`);
      else if (LOOSE_ZOD_METHODS.has(method) && checker.getTypeAtLocation(target).getProperty('_zod')) {
        add(node, `loose schema .${method}()`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return issues;
}

function nearestConfig(file: string, configs: string[]): string | undefined {
  return configs.filter(config => file.startsWith(`${dirname(config)}/`)).sort((a, b) => b.length - a.length)[0];
}

function checkTsFiles(root: string, files: string[]): Issue[] {
  const configs = execFileSync('git', ['ls-files', '-z', '*tsconfig.json'], {
    cwd: root,
  })
    .toString()
    .split('\0')
    .filter(path => path && !path.includes('node_modules/'))
    .map(path => join(root, path));
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const config = nearestConfig(file, configs) ?? '';
    groups.set(config, [...(groups.get(config) ?? []), file]);
  }
  const issues: Issue[] = [];
  for (const [config, owned] of groups) {
    const parsed = config
      ? ts.parseJsonConfigFileContent(
          ts.readConfigFile(config, ts.sys.readFile).config,
          ts.sys,
          dirname(config),
          undefined,
          config,
        )
      : undefined;
    const program = ts.createProgram([...new Set([...(parsed?.fileNames ?? []), ...owned])], {
      ...(parsed?.options ?? DEFAULT_OPTIONS),
      noEmit: true,
    });
    const checker = program.getTypeChecker();
    for (const file of owned) {
      const source = program.getSourceFile(file);
      if (!source) continue;
      const unresolved = program
        .getSemanticDiagnostics(source)
        .filter(diagnostic => diagnostic.code === 2307 || diagnostic.code === 7016);
      issues.push(
        ...unresolved.map(diagnostic => ({
          file: relative(root, file),
          line: source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
          message: `unresolved import reads as any: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
        })),
        ...checkTsSource(checker, source, relative(root, file)),
      );
    }
  }
  return issues;
}

function checkGoFiles(root: string, files: string[]): Issue[] {
  return files.flatMap(file =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) => {
        const code = line.replace(/"(?:[^"\\]|\\.)*"|`[^`]*`|\/\/.*$/g, '');
        return /\binterface\{\}|\bany\b/.test(code)
          ? [
              {
                file: relative(root, file),
                line: index + 1,
                message: 'Go `any`/`interface{}` type',
              },
            ]
          : [];
      }),
  );
}

function checkPythonFiles(root: string, files: string[]): Issue[] {
  if (files.length === 0) return [];
  const [interpreter, ...args] = existsSync(join(root, '.python-version'))
    ? ['uv', 'run', '--no-project', '--quiet', 'python3']
    : ['python3'];
  const output = execFileSync(
    interpreter ?? 'python3',
    [...args, join(import.meta.dir, 'check_types.py'), root, ...files],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 << 20,
    },
  );
  return output
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [file = '', at = '0', ...rest] = line.split('\t');
      return { file, line: Number(at), message: rest.join('\t') };
    });
}

export function checkTypes(root: string): Issue[] {
  const files = findCodeFiles(root).filter(file => existsSync(file));
  return [
    ...checkTsFiles(
      root,
      files.filter(file => TS_FILE.test(file) && !file.endsWith('.d.ts')),
    ),
    ...checkPythonFiles(
      root,
      files.filter(file => file.endsWith('.py')),
    ),
    ...checkGoFiles(
      root,
      files.filter(file => file.endsWith('.go')),
    ),
  ].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

if (import.meta.main) {
  const issues = checkTypes(process.cwd());
  for (const issue of issues) console.error(`${issue.file}:${issue.line} ${issue.message}`);
  if (issues.length > 0) {
    console.error(`${issues.length} loose type(s): name the exact type, or parse untrusted input with its schema.`);
    process.exit(1);
  }
}

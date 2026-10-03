"""The Python half of the strict-typing gate, run by `check-types.ts` with a repo root and its tracked Python files.

Every function parameter and return is annotated (`self`/`cls` and an `__init__` return excepted, lambdas being
unannotatable), and no annotation names `Any`, `object`, `JsonValue` or a bare container left unparameterised. `cast()`
and type-checker ignore comments are refused, because each silences the checker instead of naming the type. Each issue
prints as one tab-separated `file, line, message` row.
"""

import ast
import re
import sys
from pathlib import Path

LOOSE_NAMES = {"Any", "object", "JsonValue"}
BARE_CONTAINERS = {"dict", "list", "tuple", "set", "frozenset", "Dict", "List", "Tuple", "Set", "Mapping", "Sequence", "Callable", "type"}
IGNORE_COMMENT = re.compile(r"#\s*(type|ty|pyright|mypy):\s*ignore")


def annotation_issues(annotation: ast.expr) -> list[str]:
    issues = [
        f"`{node.id if isinstance(node, ast.Name) else node.attr}` annotation"
        for node in ast.walk(annotation)
        if (isinstance(node, ast.Name) and node.id in LOOSE_NAMES) or (isinstance(node, ast.Attribute) and node.attr in LOOSE_NAMES)
    ]
    subscripted = {id(node.value) for node in ast.walk(annotation) if isinstance(node, ast.Subscript)}
    issues += [
        f"bare `{node.id}` annotation"
        for node in ast.walk(annotation)
        if isinstance(node, ast.Name) and node.id in BARE_CONTAINERS and id(node) not in subscripted
    ]
    return issues


def check_file(root: Path, path: Path) -> list[tuple[str, int, str]]:
    text = path.read_text()
    name = str(path.relative_to(root))
    issues = [(name, text.count("\n", 0, match.start()) + 1, "type-checker ignore comment") for match in IGNORE_COMMENT.finditer(text)]
    for node in ast.walk(ast.parse(text)):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            arguments = [*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs, node.args.vararg, node.args.kwarg]
            for index, argument in enumerate(argument for argument in arguments if argument is not None):
                if index == 0 and argument.arg in ("self", "cls"):
                    continue
                if argument.annotation is None:
                    issues.append((name, node.lineno, f"parameter `{argument.arg}` of `{node.name}` is unannotated"))
            if node.returns is None and node.name != "__init__":
                issues.append((name, node.lineno, f"return of `{node.name}` is unannotated"))
        annotations = []
        if isinstance(node, (ast.arg, ast.AnnAssign)) and node.annotation is not None:
            annotations.append(node.annotation)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.returns is not None:
            annotations.append(node.returns)
        for annotation in annotations:
            issues += [(name, node.lineno, issue) for issue in annotation_issues(annotation)]
        if isinstance(node, ast.Call) and (
            (isinstance(node.func, ast.Name) and node.func.id == "cast") or (isinstance(node.func, ast.Attribute) and node.func.attr == "cast")
        ):
            issues.append((name, node.lineno, "`cast()` silences the type checker"))
    return issues


if __name__ == "__main__":
    root = Path(sys.argv[1])
    for file, line, message in sorted(issue for path in sys.argv[2:] for issue in check_file(root, Path(path))):
        print(f"{file}\t{line}\t{message}")

"""The Python half of the strict-typing gate, run by `check-types.ts` with a repo root and its tracked Python files.

Every function parameter and return is annotated (`self`/`cls` and an `__init__` return excepted, lambdas being
unannotatable); `Any` and `JsonValue` appear nowhere, type aliases included; no annotation names `object` or a bare
container left unparameterised, and no subscript carries `object`. A bare `object` parameter is the one exception,
Python's counterpart of TypeScript's `unknown` parameter: input still to be parsed, which the checker forces the
function to narrow before use. A `json`/`yaml` load returns `Any`, so its result may only go straight into a pydantic
`model_validate`/`validate_python`, or into a function in the same file whose parameter there is a bare `object`. `cast()` and type-checker ignore comments are refused, because each silences the
checker instead of naming the type. Each issue prints as one tab-separated
`file, line, message` row.
"""

import ast
import re
import sys
from pathlib import Path

BARE_CONTAINERS = {"dict", "list", "tuple", "set", "frozenset", "Dict", "List", "Tuple", "Set", "Mapping", "Sequence", "Callable", "type"}
IGNORE_COMMENT = re.compile(r"#\s*(type|ty|pyright|mypy):\s*ignore")
UNTYPED_LOADERS = {("json", "loads"), ("json", "load"), ("yaml", "safe_load"), ("yaml", "load")}
VALIDATORS = {"model_validate", "validate_python"}


def annotation_issues(annotation: ast.expr) -> list[str]:
    in_subscript = {id(part) for node in ast.walk(annotation) if isinstance(node, ast.Subscript) for part in ast.walk(node.slice)}
    issues = [
        "`object` annotation"
        for node in ast.walk(annotation)
        if isinstance(node, ast.Name) and node.id == "object" and id(node) not in in_subscript
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
    tree = ast.parse(text)
    parents = {id(child): parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
    parsers = {
        definition.name: [
            isinstance(argument.annotation, ast.Name) and argument.annotation.id == "object"
            for argument in [*definition.args.posonlyargs, *definition.args.args]
        ]
        for definition in ast.walk(tree)
        if isinstance(definition, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    for node in ast.walk(tree):
        if (isinstance(node, ast.Name) and node.id in ("Any", "JsonValue")) or (isinstance(node, ast.Attribute) and node.attr in ("Any", "JsonValue")):
            issues.append((name, node.lineno, f"`{node.id if isinstance(node, ast.Name) else node.attr}` used as a type"))
        if isinstance(node, ast.Subscript):
            issues += [
                (name, node.lineno, "`object` inside a type")
                for part in ast.walk(node.slice)
                if isinstance(part, ast.Name) and part.id == "object"
            ]
        if isinstance(node, ast.TypeAlias):
            issues += [(name, node.lineno, issue) for issue in annotation_issues(node.value)]
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
            loader = (node.func.value.id, node.func.attr)
            parent = parents.get(id(node))
            position = parent.args.index(node) if isinstance(parent, ast.Call) and node in parent.args else -1
            validated = position >= 0 and isinstance(parent, ast.Call) and (
                (isinstance(parent.func, ast.Attribute) and parent.func.attr in VALIDATORS)
                or (isinstance(parent.func, ast.Name) and position < len(parsers.get(parent.func.id, [])) and parsers[parent.func.id][position])
            )
            if loader in UNTYPED_LOADERS and not validated:
                issues.append((name, node.lineno, f"`{'.'.join(loader)}()` result is untyped; validate it with a model"))
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            arguments = [*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs, node.args.vararg, node.args.kwarg]
            for index, argument in enumerate(argument for argument in arguments if argument is not None):
                if index == 0 and argument.arg in ("self", "cls"):
                    continue
                if argument.annotation is None:
                    issues.append((name, node.lineno, f"parameter `{argument.arg}` of `{node.name}` is unannotated"))
            if node.returns is None and node.name != "__init__":
                issues.append((name, node.lineno, f"return of `{node.name}` is unannotated"))
        annotations: list[tuple[int, ast.expr]] = []
        if isinstance(node, ast.arg) and not (isinstance(node.annotation, ast.Name) and node.annotation.id == "object") and node.annotation is not None:
            annotations.append((node.lineno, node.annotation))
        if isinstance(node, ast.AnnAssign):
            annotations.append((node.lineno, node.annotation))
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.returns is not None:
            annotations.append((node.lineno, node.returns))
        for line, annotation in annotations:
            issues += [(name, line, issue) for issue in annotation_issues(annotation)]
        if isinstance(node, ast.Call) and (
            (isinstance(node.func, ast.Name) and node.func.id == "cast") or (isinstance(node.func, ast.Attribute) and node.func.attr == "cast")
        ):
            issues.append((name, node.lineno, "`cast()` silences the type checker"))
    return issues


if __name__ == "__main__":
    root = Path(sys.argv[1])
    for file, line, message in sorted(issue for path in sys.argv[2:] for issue in check_file(root, Path(path))):
        print(f"{file}\t{line}\t{message}")

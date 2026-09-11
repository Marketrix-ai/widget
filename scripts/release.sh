#!/usr/bin/env bash
# Cuts a widget release: bumps package.json, refreshes bun.lock,
# builds, commits both manifests and creates the annotated `v<version>` tag. It deliberately does NOT
# push — pushing the tag is what fires image.yml and publish.yml, so that stays a separate step.
# Refuses a dirty tree or a HEAD that is not origin/main, since the tag would capture a tree the build
# never validated or one that cannot deploy.
set -euo pipefail

BUMP="${1:?Usage: release.sh <version|patch|minor|major> (e.g. 1.0.45)}"
PROJECT="widget"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git fetch --quiet origin main
[ -z "$(git status --porcelain)" ] || { echo "release.sh: working tree is dirty — the build would validate a tree the tag cannot capture." >&2; exit 1; }
[ "$(git rev-parse HEAD)" = "$(git rev-parse FETCH_HEAD)" ] || { echo "release.sh: HEAD is not origin/main — the tag would be undeployable." >&2; exit 1; }

TAG="$(bun pm version "$BUMP" --no-git-tag-version)"

bun install
bun run build

git add package.json bun.lock
git commit -m "chore(${PROJECT}): release ${TAG}"

git tag -a "$TAG" -m "Release ${TAG}"

echo "Created commit and tag ${TAG}. Push with: git push origin HEAD && git push origin ${TAG}"

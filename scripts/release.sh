#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: release.sh <version> (e.g. 1.0.45)}"
PROJECT="widget"
TAG="v${VERSION}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm version "$VERSION" --no-git-tag-version --ignore-scripts

npm install
npm run build

git add package.json package-lock.json
git commit -m "chore(${PROJECT}): release v${VERSION}"

git tag -a "$TAG" -m "Release ${TAG}"

echo "Created commit and tag ${TAG}. Push with: git push origin HEAD && git push origin ${TAG}"

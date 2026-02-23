#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: release.sh <version> (e.g. 1.0.45)}"
PROJECT="widget"
TAG="v${VERSION}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 1. Set version in package.json
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.version = process.argv[1];
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
" "$VERSION"

# 2. Refresh lockfile
npm install

# 3. Build (must succeed)
npm run build

# 4. Commit manifest + lockfile
git add package.json package-lock.json
git commit -m "chore(${PROJECT}): release v${VERSION}"

# 5. Create annotated tag
git tag -a "$TAG" -m "Release ${TAG}"

echo "Created commit and tag ${TAG}. Push with: git push origin HEAD && git push origin ${TAG}"

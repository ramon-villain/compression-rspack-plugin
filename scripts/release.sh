#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.3.0"
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$'; then
  echo "Error: '$VERSION' is not a valid semver version"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Get current version from root package.json
CURRENT=$(node -p "require('./package.json').version")
echo "Bumping $CURRENT -> $VERSION"

# Update root package.json version
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
if (pkg.optionalDependencies) {
  for (const key of Object.keys(pkg.optionalDependencies)) {
    if (key.startsWith('compression-rspack-plugin-')) {
      pkg.optionalDependencies[key] = '$VERSION';
    }
  }
}
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update platform package.json files
for f in npm/*/package.json; do
  if [ -f "$f" ]; then
    node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$f', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('$f', JSON.stringify(pkg, null, 2) + '\n');
"
  fi
done

echo ""
git diff
echo ""

read -p "Commit and tag v$VERSION? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted. Restoring files..."
  git checkout -- .
  exit 1
fi

git add package.json npm/*/package.json
git commit -m "chore: release v$VERSION"
git tag "v$VERSION"
git push
git push origin "v$VERSION"

echo ""
echo "Released v$VERSION"

#!/usr/bin/env bash
# Create a minimal distribution ZIP for Chrome Web Store upload.
# Usage: ./scripts/build-dist.sh [out-file.zip]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# read version from manifest.json (requires python or jq)
if command -v python3 >/dev/null 2>&1; then
  VERSION=$(python3 -c "import json,sys;print(json.load(open('manifest.json'))['version'])")
elif command -v python >/dev/null 2>&1; then
  VERSION=$(python -c "import json,sys;print(json.load(open('manifest.json'))['version'])")
else
  VERSION="$(date +%Y%m%d%H%M%S)"
fi

OUT_FILE=${1:-"guardon-v${VERSION}.zip"}
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

INCLUDES=(
  manifest.json
  LICENSE
  README.md
  SECURITY.md
  assets
  src/lib
  src/utils
  src/popup
  src/options
  src/background.js
  src/content.js
)

for item in "${INCLUDES[@]}"; do
  if [ -e "$item" ]; then
    echo "Copying $item"
    cp -r "$item" "$DIST_DIR/"
  else
    echo "Warning: $item not found, skipping"
  fi
done

if [ -f "$OUT_FILE" ]; then rm -f "$OUT_FILE"; fi
cd "$DIST_DIR"
zip -r "$OUT_FILE" ./*
mv "$OUT_FILE" "$ROOT_DIR/"
echo "Created: $ROOT_DIR/$OUT_FILE"

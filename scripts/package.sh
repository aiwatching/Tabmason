#!/bin/bash
# Build the Chrome Web Store upload: dist/tabmason-<version>.zip with only what the extension needs.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
out="dist/tabmason-${version}.zip"
mkdir -p dist
rm -f "$out"
zip -qr "$out" manifest.json src icons -x 'icons/*.svg' -x '*.DS_Store'
echo "$out ($(du -h "$out" | cut -f1))"
unzip -l "$out" | tail -1

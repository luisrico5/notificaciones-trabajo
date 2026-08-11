#!/usr/bin/env bash
# Ensambla index.html (un solo archivo) desde src/.
# Uso:  bash build.sh
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cat "$DIR/src/part_head.html" "$DIR/src/xlsx.full.min.js" > "$DIR/index.html"
printf '\n' >> "$DIR/index.html"
cat "$DIR/src/part_tail.html" >> "$DIR/index.html"
echo "index.html generado ($(wc -c < "$DIR/index.html") bytes)"

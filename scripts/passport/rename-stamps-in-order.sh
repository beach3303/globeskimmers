#!/bin/bash
# Rename stamp PNGs to their slugs by DERIVING the slug from each file's OWN name.
# Your files are like "001_Eiffel_Tower.png" — we strip the leading number prefix
# ("001_") and slugify the rest → eiffel-tower.png. Order-independent + reliable
# (each file maps to itself, no time/sort guessing). Non-destructive: writes
# renamed copies into a fresh ready/ subfolder.
#
# Usage:  bash scripts/passport/rename-stamps-in-order.sh ~/Downloads/stamps
# Then verify thumbnails and upload:
#         bash scripts/passport/upload-stamp-art.sh ~/Downloads/stamps/ready
set -e
SRC="${1:-$HOME/Downloads/stamps}"
OUT="$SRC/ready"
[ -d "$SRC" ] || { echo "Folder not found: $SRC"; exit 1; }
rm -rf "$OUT"; mkdir -p "$OUT"
n=0
for f in "$SRC"/*.png; do
  [ -e "$f" ] || { echo "No .png files in $SRC"; exit 1; }
  base="$(basename "$f" .png)"
  # strip a leading number prefix like "001_", "1-", "12 "
  name="$(printf '%s' "$base" | sed -E 's/^[0-9]+[ _.-]+//')"
  # slugify: lowercase, non-alphanumerics -> hyphen, trim hyphens
  slug="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  [ -z "$slug" ] && { echo "  ⚠ skipped (no name): $(basename "$f")"; continue; }
  cp "$f" "$OUT/$slug.png"
  printf '  %-40s -> %s.png\n' "$(basename "$f")" "$slug"
  n=$((n+1))
done
echo "✅ $n renamed copies in: $OUT"
echo "   1) Open it, glance that thumbnails match names."
echo "   2) Upload:  bash scripts/passport/upload-stamp-art.sh \"$OUT\""

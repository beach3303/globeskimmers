#!/bin/bash
# Rename downloaded stamp PNGs to their slugs, IN ORDER.
#
# ASSUMPTION: the PNGs in the source folder are in the SAME order you generated
# them (#1 Eiffel Tower first, then #2, …). We sort by file date (oldest first)
# and pair them with the slug list. NON-DESTRUCTIVE: it copies renamed files into
# a "ready/" subfolder, so your originals are untouched and you can verify first.
#
# Usage:  bash scripts/passport/rename-stamps-in-order.sh ~/Downloads/stamps
# Then OPEN the ready/ folder, eyeball that each thumbnail matches its filename
# (every stamp has its name printed on it), then run upload-stamp-art.sh on ready/.
set -e
SRC="${1:-$HOME/Downloads/stamps}"
LIST="scripts/passport/stamp-art-filenames.txt"
OUT="$SRC/ready"
[ -d "$SRC" ] || { echo "Folder not found: $SRC"; exit 1; }
[ -f "$LIST" ] || { echo "Missing $LIST (run from the repo root)"; exit 1; }
mkdir -p "$OUT"
grep -oE '[a-z0-9-]+\.png' "$LIST" > /tmp/pp_slugs.txt
ls -tr "$SRC"/*.png > /tmp/pp_pngs.txt 2>/dev/null || { echo "No .png files in $SRC"; exit 1; }
echo "Source PNGs: $(wc -l < /tmp/pp_pngs.txt) | Slugs: $(wc -l < /tmp/pp_slugs.txt)"
n=0
paste -d'|' /tmp/pp_pngs.txt /tmp/pp_slugs.txt | while IFS='|' read -r src slug; do
  [ -z "$src" ] && continue
  [ -z "$slug" ] && continue
  cp "$src" "$OUT/$slug"
  printf '  %-40s -> %s\n' "$(basename "$src")" "$slug"
  n=$((n+1))
done
echo "✅ Copied renamed stamps into: $OUT"
echo "   1) Open it and CHECK the thumbnails match the filenames."
echo "   2) Then upload:  bash scripts/passport/upload-stamp-art.sh \"$OUT\""

#!/bin/bash
# Batch-upload passport stamp-art PNGs to Cloudflare R2 (globeskimmers-media/stamp-art/).
#
#   1) Name each PNG by its slug — see scripts/passport/stamp-art-filenames.txt
#      (e.g. eiffel-tower.png, hagia-sophia.png, table-mountain.png)
#   2) Put them all in ONE folder
#   3) Run:   bash scripts/passport/upload-stamp-art.sh ~/Downloads/stamps
#
# Re-running is safe (overwrites). Only .png files are uploaded.
set -e
DIR="${1:-$HOME/Downloads/stamps}"
BUCKET="globeskimmers-media"
shopt -s nullglob
files=("$DIR"/*.png)
if [ ${#files[@]} -eq 0 ]; then echo "No .png files found in: $DIR"; exit 1; fi
echo "Uploading ${#files[@]} stamp(s) from $DIR → $BUCKET/stamp-art/ …"
n=0
for f in "${files[@]}"; do
  name="$(basename "$f")"
  echo "  → $name"
  wrangler r2 object put "$BUCKET/stamp-art/$name" --file="$f" --content-type=image/png --remote
  n=$((n+1))
done
echo "✅ Done — uploaded $n stamp(s). They now appear on matching stamps in the app."

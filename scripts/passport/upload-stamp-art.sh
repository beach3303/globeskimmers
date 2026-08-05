#!/bin/bash
# Upload passport stamp art to Cloudflare R2 (globeskimmers-media/stamp-art/).
#
# Finds every NUMBERED stamp PNG (e.g. 001_Eiffel_Tower.png) anywhere under the
# given folder — so it works even when your stamps are split across many
# subfolders (Passport_Stamps_001-010, …021-030, etc.). It derives the slug from
# each filename (strips "001_" → eiffel-tower), dedupes, and uploads. Un-numbered
# files (e.g. "ChatGPT Image ….png") are ignored.
#
# Usage:  bash scripts/passport/upload-stamp-art.sh ~/Downloads
#   (or point it at a single folder that holds the PNGs)
set -e
DIR="${1:-$HOME/Downloads/stamps}"
BUCKET="globeskimmers-media"
[ -d "$DIR" ] || { echo "Folder not found: $DIR"; exit 1; }
seen="$(mktemp)"; : > "$seen"
echo "Scanning $DIR for numbered stamp PNGs …"
find "$DIR" -type f -iname '*.png' -print0 | while IFS= read -r -d '' f; do
  base="$(basename "$f" .png)"
  # accept numbered ("115_Hallstatt") OR clean-slug ("hallstatt") stamp files;
  # skip obvious non-stamps (screenshots, unprocessed AI exports, files w/ spaces)
  case "$base" in
    *" "*|ChatGPT*|chatgpt*|Screenshot*|Screen\ Shot*|Untitled*|IMG_*) continue ;;
  esac
  name="$(printf '%s' "$base" | sed -E 's/^[0-9]+[ _.-]+//')"   # strip optional "115_" prefix
  slug="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  [ -z "$slug" ] && continue
  grep -qxF "$slug" "$seen" && continue                    # dedupe (same slug in 2 folders)
  echo "$slug" >> "$seen"
  echo "  → stamp-art/$slug.png   ($(basename "$f"))"
  wrangler r2 object put "$BUCKET/stamp-art/$slug.png" --file="$f" --content-type=image/png --remote
done
echo "✅ Uploaded $(wc -l < "$seen" | tr -d ' ') stamp(s) to $BUCKET/stamp-art/"
rm -f "$seen"

#!/usr/bin/env bash
# boot-check — boots the PRODUCTION bundle in headless Chrome and fails on any
# uncaught JS error or an empty #root. Catches the class of bug that `npm run
# lint` and `npm run build` both miss: a free identifier (e.g. a module-level
# `const x = openPartner` with no import) that throws at module evaluation and
# leaves the app white after the splash. Found the hard way on 2026-09-01.
#   Usage: npm run build && scripts/boot-check.sh
set -u
PORT=${PORT:-4173}
CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
[ -x "$CHROME" ] || { echo "boot-check: Chrome not found at $CHROME (set CHROME=…)"; exit 2; }
[ -f dist/index.html ] || { echo "boot-check: dist/ missing — run npm run build first"; exit 2; }
TMP=$(mktemp -d); PROF="$TMP/prof"
npx vite preview --port "$PORT" --strictPort > "$TMP/preview.log" 2>&1 &
PREVIEW=$!; sleep 3
"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check --user-data-dir="$PROF" \
  --enable-logging=stderr --v=0 --virtual-time-budget=10000 --dump-dom "http://localhost:$PORT/" > "$TMP/dom.html" 2> "$TMP/chrome.log"
kill $PREVIEW 2>/dev/null; wait $PREVIEW 2>/dev/null
ERRS=$(grep -E "CONSOLE" "$TMP/chrome.log" | grep -E "Uncaught|ReferenceError|TypeError|SyntaxError|is not defined|Cannot access" | grep -v "manifest.json" || true)
ROOT=$(node -e 'const h=require("fs").readFileSync(process.argv[1],"utf8");const i=h.indexOf("id=\"root\"");if(i<0){console.log(0);process.exit()}const j=h.indexOf(">",i)+1;const k=h.lastIndexOf("</div>");console.log(Math.max(0,h.slice(j,k).trim().length))' "$TMP/dom.html")
if [ -n "$ERRS" ]; then echo "boot-check: ❌ uncaught error(s) at boot:"; echo "$ERRS" | sed 's/^/  /'; rm -rf "$TMP"; exit 1; fi
if [ "${ROOT:-0}" -lt 50 ]; then echo "boot-check: ❌ #root rendered nothing (white screen). chrome.log tail:"; tail -5 "$TMP/chrome.log" | sed 's/^/  /'; rm -rf "$TMP"; exit 1; fi
echo "boot-check: ✅ bundle boots — #root has ${ROOT} chars, no uncaught errors"; rm -rf "$TMP"

#!/usr/bin/env python3
"""Stamp inbox → upload-ready stamp art.

How the founder's drawing tool (Grok today; anything that saves an image) plugs in:

  1. Save each finished image into  ~/Desktop/Stamp inbox/  named after the place:
       "Fort Santiago.png", "fort-santiago.jpg", "Hagia Sophia (1).png" all work — and so does the
       list's own file name ("fort-santiago.png"), which is what Grok's zip exports carry since
       2026-11-22 (unzip them and drop the PNGs in; the folder names inside do not matter).
  2. Run   python3 scripts/stamp-art/intake.py            (--country China  --pad)
       - squares every image to the house 1254×1254 PNG (center-crop when the picture is
         nearly square, padding otherwise; --pad never crops, for full-bleed stamp
         shapes; --pad-color 000000 for a dark border; smaller pictures are scaled up).
         With node_modules/sharp present (square.mjs) a transparent picture stays transparent —
         a stamp shape on clear pixels, the way the passport shows it; sips is the fallback,
       - --country <name> matches only that country's list; close names match too
         ("Lama temple beijing", "Great Wall Mutianyu", "Tiananmen Sq"), and the guesses
         are printed for Claude to read; overrides.json fixes a wrong one,
       - matches the file name to a place in the World Stamp Tracker (stamp-names.json),
       - writes  Claude outputs/stamp-ready/<slug>.png  and  Claude outputs/stamp-ready/upload.sh
         (slugs listed in Claude outputs/stamp-ready/hold.json are squared but left out of upload.sh —
         stamps the founder still has to redraw after the copyright review),
       - prints what matched, what didn't, and which uploads would overwrite a live stamp
         (a redraw needs a REDRAWN line in src/lib/stampArt.js so phones drop the cached file).
  3. Claude looks at the squared files (wrong landmark, logos, text) and the founder runs upload.sh.

Nothing here touches the server; upload.sh is the only step that does, and the founder runs it.
"""
import difflib, glob, json, os, re, subprocess, sys, unicodedata, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
INBOX = Path(os.environ.get("STAMP_INBOX") or Path.home() / "Desktop" / "Stamp inbox")
READY = REPO / "Claude outputs" / "stamp-ready"
NAMES = REPO / "scripts" / "stamp-art" / "world" / "stamp-names.json"
# The country lists (china/, philippines/, united-states/ …) are name sources too: every place's file name → place.
LISTS = sorted(glob.glob(str(REPO / "scripts" / "stamp-art" / "*" / "list-*.json")))
OVERRIDES = READY / "overrides.json"      # {"<file name in the inbox>": "<slug>"} — hand decisions that beat the matcher
HOLD = READY / "hold.json"                # ["<slug>", …] — squared, but kept out of upload.sh until the founder redraws them
SQUARE_MJS = REPO / "scripts" / "stamp-art" / "square.mjs"   # sharp: transparent padding; sips below is the fallback
# Words that say nothing about WHICH place it is; dropped before comparing names.
FILLER = {"the", "of", "and", "a", "an", "de", "la", "le", "du", "des", "stamp", "stamps", "seal", "png", "jpg", "jpeg", "final", "copy", "new", "v2", "v3"}
SIZE = 1254
SERVE = "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
EXTS = {".png", ".jpg", ".jpeg", ".webp", ".heic", ".tif", ".tiff", ".gif", ".bmp"}
# Same slug rule as src/lib/stampArt.js.
def slug(s):
    s = "".join(ch for ch in unicodedata.normalize("NFKD", str(s or "")) if not unicodedata.combining(ch))
    s = re.sub(r"\([^)]*\)", " ", s).lower().replace("'", "").replace("’", "").replace("œ", "oe").replace("æ", "ae")
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s))
# "Fort Santiago (1)", "fort-santiago copy 2", "grok_image_fort-santiago" → fort-santiago
def name_from_file(p):
    stem = re.sub(r"\s*\((\d+)\)\s*$", "", p.stem)                       # "Fort Santiago (1)"
    stem = re.sub(r"[-_ ]+(copy|final|v\d+)(\s*\d+)?\s*$", "", stem, flags=re.I)   # "… copy 2", "…-v3"
    stem = re.sub(r"[-_ ]+\d{3,}\s*$", "", stem)                            # "…-20261115" export counters (Pier 39 keeps its 39)
    stem = re.sub(r"^(grok[-_ ]?(image)?|image|img|download)[-_ ]*", "", stem, flags=re.I)
    return stem.strip()

def load_names():
    """Every place we know a file name for: the world tracker first, then each country list."""
    names = json.load(open(NAMES)) if NAMES.exists() else {}
    for lf in LISTS:
        try: rows = json.load(open(lf))
        except Exception: continue
        if isinstance(rows, dict): rows = [r for r in rows.values() if isinstance(r, dict)]
        country = Path(lf).parent.name.replace("-", " ").title().replace("United States", "United States")
        for r in rows:
            if not isinstance(r, dict) or not r.get("file"): continue
            sl = re.sub(r"\.png$", "", r["file"])
            names.setdefault(sl, {"name": r.get("name"), "country": country, "tier": r.get("tier") or r.get("kind") or "",
                                  "where": r.get("where") or "", "source": r.get("status") or ""})
            names[sl].setdefault("where", r.get("where") or "")
    return names

def tokens(sl):
    return [t for t in sl.split("-") if t and t not in FILLER]

def fuzzy(sl, names, country=None):
    """Best place for a slug that is not an exact file name. Returns (slug, score 0–100, why) or None.
    Scores: the file's words all inside the place's name (or the reverse) → 90+; close spelling → SequenceMatcher."""
    want = tokens(sl); wj = "-".join(want)
    if not want: return None
    best = None
    for cand, meta in names.items():
        if country and (meta.get("country") or "").lower() != country.lower(): continue
        ct = tokens(cand); cj = "-".join(ct)
        if not ct: continue
        score = 0; why = ""
        if cj == wj: score, why = 98, "same words"
        else:
            sub = set(want) <= set(ct) or set(ct) <= set(want)
            # a place's city tacked on the end ("lama-temple-beijing") is fine; strip it and try again
            where_t = set(tokens(slug(meta.get("where") or "")))
            core = [t for t in want if t not in where_t]
            if sub:
                missing = len(set(ct) ^ set(want)); score, why = max(60, 92 - 8 * missing), f"words overlap, {missing} extra"
            elif core and set(core) == set(ct): score, why = 94, "name + its city"
            else:
                r = difflib.SequenceMatcher(None, wj, cj).ratio()
                if r >= 0.8: score, why = int(r * 90), f"spelling {r:.2f}"
                # one word misspelled: compare word by word
                elif len(want) == len(ct) and all(difflib.SequenceMatcher(None, a, b).ratio() >= 0.75 for a, b in zip(want, ct)):
                    score, why = 80, "each word close"
        if score and (not best or score > best[1]): best = (cand, score, why)
    return best if best and best[1] >= 75 else None

def sips_size(p):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(p)], capture_output=True, text=True).stdout
    w = re.search(r"pixelWidth:\s*(\d+)", out); h = re.search(r"pixelHeight:\s*(\d+)", out)
    return (int(w.group(1)), int(h.group(1))) if w and h else (0, 0)

def square(src, dst, pad_color, pad_always=False):
    w, h = sips_size(src)
    if not w or not h: return None, "unreadable"
    tmp = dst.with_suffix(".tmp.png"); ratio = max(w, h) / min(w, h)
    if ratio <= 1.25 and not pad_always:    # nearly square: crop the long side down to the short one (--pad: never crop — a full-bleed stamp shape loses its top and bottom)
        side = min(w, h); op = ["-c", str(side), str(side)]; how = f"cropped {w}×{h} → {side}²"
    else:                                   # a wide/tall picture: pad to a square so nothing is lost
        side = max(w, h); op = ["-p", str(side), str(side), "--padColor", pad_color]; how = f"padded {w}×{h} → {side}² ({pad_color})"
    r1 = subprocess.run(["sips", *op, "-s", "format", "png", str(src), "--out", str(tmp)], capture_output=True, text=True)
    # -Z only shrinks; a smaller picture is scaled UP to the house size so every stamp on the server is 1254².
    r2 = subprocess.run(["sips", "-z", str(SIZE), str(SIZE), str(tmp), "--out", str(dst)], capture_output=True, text=True)
    if side != SIZE: how += f" → {SIZE}²"
    tmp.unlink(missing_ok=True)
    if r1.returncode or r2.returncode: return None, (r1.stderr or r2.stderr).strip()
    return sips_size(dst), how

def square_many(pairs, pad_color, pad_always):
    """{str(src): (size, how)} for every (src, dst). sharp (square.mjs) when the repo has it — it keeps a clear
    background clear and does the whole inbox in one process; otherwise the sips path above, one file at a time."""
    out = {}
    if pairs and SQUARE_MJS.exists() and (REPO / "node_modules" / "sharp").exists():
        manifest = READY / ".square-manifest.json"
        manifest.write_text(json.dumps({"size": SIZE, "pad": pad_always, "padColor": pad_color,
                                        "items": [{"src": str(s), "dst": str(d)} for s, d in pairs]}))
        r = subprocess.run(["node", str(SQUARE_MJS), str(manifest)], capture_output=True, text=True, cwd=REPO)
        manifest.unlink(missing_ok=True)
        if r.returncode == 0:
            for it in json.loads(r.stdout): out[it["src"]] = ((it["w"], it["h"]) if it.get("ok") else None, it["how"])
            return out
        print("square.mjs failed, using sips instead:", (r.stderr or "").strip()[:300])
    for s, d in pairs: out[str(s)] = square(s, d, pad_color, pad_always)
    return out

def is_live(file):
    try:
        req = urllib.request.Request(SERVE + file, headers={"User-Agent": UA, "Range": "bytes=0-0"})
        with urllib.request.urlopen(req, timeout=15) as r: return r.status in (200, 206)
    except Exception: return False

def is_live_many(files):
    with ThreadPoolExecutor(max_workers=12) as ex: return dict(zip(files, ex.map(is_live, files)))

def main():
    pad_color = "FFFFFF"
    if "--pad-color" in sys.argv: pad_color = sys.argv[sys.argv.index("--pad-color") + 1].lstrip("#").upper()
    country = sys.argv[sys.argv.index("--country") + 1] if "--country" in sys.argv else None   # e.g. --country China: match only that list
    pad_always = "--pad" in sys.argv        # never crop: pad every picture to a square (full-bleed stamp shapes)
    INBOX.mkdir(parents=True, exist_ok=True); READY.mkdir(parents=True, exist_ok=True)
    names = load_names()
    overrides = json.load(open(OVERRIDES)) if OVERRIDES.exists() else {}
    hold = set(json.load(open(HOLD))) if HOLD.exists() else set()
    files = sorted(p for p in INBOX.iterdir() if p.suffix.lower() in EXTS and not p.name.startswith("."))
    if not files:
        print(f"Inbox is empty: {INBOX}\nSave the finished stamps there (named after the place) and run this again."); return
    matched, unmatched, failed, fuzzed, todo = [], [], [], [], []
    for p in files:                                   # 1. every file → a place
        nm = name_from_file(p); sl = slug(nm); why = "exact"
        if p.name in overrides: sl, why = overrides[p.name], "override"
        hit = (names.get(sl) or names.get(re.sub(r"^the-", "", sl))) if sl else None
        if hit and sl not in names: sl = re.sub(r"^the-", "", sl)
        if not hit and sl:
            fz = fuzzy(sl, names, country)
            if fz:
                sl, score, why = fz; hit = names[sl]; fuzzed.append((p.name, sl, score, why))
        if not hit:
            unmatched.append((p.name, sl)); continue
        todo.append((p, sl, hit, why))
    squared = square_many([(p, READY / f"{sl}.png") for p, sl, _, _ in todo], pad_color, pad_always)   # 2. all at once
    live = is_live_many(sorted({f"{sl}.png" for _, sl, _, _ in todo}))                                  # 3. 12 probes at a time
    for p, sl, hit, why in todo:
        size, how = squared[str(p)]
        if not size: failed.append((p.name, how)); continue
        matched.append((sl, hit, how, live[f"{sl}.png"], p.name, why))
    held = [m for m in matched if m[0] in hold]
    # upload.sh — the founder's one step that touches the server.
    if matched:
        slugs = " ".join(m[0] for m in matched if m[0] not in hold); n = len(slugs.split())
        (READY / "upload.sh").write_text(f"""#!/bin/zsh
# Upload the squared stamps to R2 (6 at a time — npx wrangler takes ~2 s per file), then check each one is live.
# Generated by scripts/stamp-art/intake.py. Re-run safely: a put overwrites the same key.
cd "$(dirname "$0")/../.."
put() {{ npx wrangler r2 object put "globeskimmers-media/stamp-art/$1.png" --file="Claude outputs/stamp-ready/$1.png" --content-type image/png --remote >/dev/null 2>&1 && echo "  up  $1.png" || echo "  FAILED  $1.png"; }}
export -f put 2>/dev/null; typeset -xf put 2>/dev/null
print -l {slugs} | xargs -P 6 -I{{}} zsh -c 'put "$1"' _ {{}}
echo; echo "Checking the server:"
bad=0
for f in {slugs}; do
  code=$(curl -s -o /dev/null -w '%{{http_code}}' -A 'Mozilla/5.0' "{SERVE}$f.png")
  [ "$code" = "200" ] || {{ echo "  $f.png → $code"; bad=$((bad+1)); }}
done
echo "  $(( {n} - bad )) of {n} live; $bad missing"
""")
        os.chmod(READY / "upload.sh", 0o755)
    print(f"Inbox: {INBOX}  ({len(files)} image{'s' if len(files) != 1 else ''})\n")
    if matched:
        print(f"Ready to upload ({len(matched)}) → Claude outputs/stamp-ready/")
        for sl, hit, how, live, fn, why in matched:
            tag = "  ⚠ already live on the server — a redraw: add it to REDRAWN in src/lib/stampArt.js" if live else ""
            src = hit.get("source") or ""
            if src.startswith("Needs a hand pin"): tag += "  ⚠ no database row yet — Claude pins it before this stamp can be earned"
            elif src.startswith("In the app once"): tag += "  · shows once d1-world-rows.sql has run"
            print(f"  {sl}.png  ·  {hit.get('name')} ({hit.get('country')}, {hit.get('tier', '')})  ·  {how}{tag}")
    if fuzzed:
        print(f"\nMatched by a close name, not an exact one ({len(fuzzed)}) — Claude reads these; a wrong one goes in {OVERRIDES.relative_to(REPO)} as {{\"file name\": \"right-slug\"}}:")
        for fn, sl, score, why in fuzzed: print(f"  {fn}  →  {sl}.png  ({score}, {why})")
    if unmatched:
        print(f"\nNot matched to a place ({len(unmatched)}) — rename the file after the place, or tell Claude which place it is:")
        for fn, sl in unmatched: print(f"  {fn}  (slug tried: {sl or '—'})")
    if failed:
        print(f"\nCould not read ({len(failed)}):")
        for fn, why in failed: print(f"  {fn}: {why}")
    if held:
        print(f"\nSquared but held out of upload.sh ({len(held)}, listed in {HOLD.relative_to(REPO)} until redrawn):")
        for sl, hit, *_ in held: print(f"  {sl}.png  ·  {hit.get('name')}")
    if matched: print(f"\nUpload: zsh \"Claude outputs/stamp-ready/upload.sh\"   ({len(matched) - len(held)} files; npx wrangler per file ≈ 2–3 s each)")

if __name__ == "__main__": main()

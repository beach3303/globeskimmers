#!/usr/bin/env python3
"""Ask Grok (xAI's image API) to draw stamps straight into the Stamp inbox.

The same model the founder uses in the Grok app, driven from here so the list, the style
reference and the file names stay consistent, and so scripts/stamp-art/intake.py can square and
stage every result for upload. Needs an xAI API key (console.x.ai → API keys) in the shell:

    export XAI_API_KEY=xai-...                       # never saved anywhere in the repo
    python3 scripts/stamp-art/generate.py --country Thailand --limit 10
    python3 scripts/stamp-art/generate.py --slugs wat-arun grand-palace-bangkok
    python3 scripts/stamp-art/generate.py --country Japan --tier World --ref "Claude outputs/stamp-art-philippines-top10/intramuros.png"

Options
  --country NAME      places of one country from the World Stamp Tracker, not yet drawn, world-famous first
  --tier World|National|Regional   keep one tier
  --limit N           how many to draw this run (default 10)
  --slugs a b c       exact file slugs instead of a country
  --ref IMAGE         a finished stamp whose style the new ones must copy (uses /v1/images/edits)
  --resolution 1k|1.5k|2k   (default 1k; the intake resizes to the house 1254×1254)
  --redraw            allow places that already have art on the server
  --dry-run           print the places and prompts, call nothing

Cost: grok-imagine-image-2.0 lists $0.04 per 1k image (docs.x.ai/developers/pricing); the run
prints its count. Files land in ~/Desktop/Stamp inbox/<slug>.png — then run intake.py.
"""
import argparse, base64, json, os, sys, time, urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
INBOX = Path(os.environ.get("STAMP_INBOX") or Path.home() / "Desktop" / "Stamp inbox")
ROWS = next(p for p in (REPO / "scripts" / "stamp-art" / "world" / f for f in ("world-rows3.json", "world-rows2.json")) if p.exists())
API = "https://api.x.ai/v1/images/"
MODEL = "grok-imagine-image-2.0"
TIER_RANK = {"World-famous": 0, "National favorite": 1, "Regional favorite": 2}

# The house look (the founder's Philippines series, 2026-11-13): an upright oval seal, fine engraved
# hatching in one navy-blue ink on white, the landmark large inside a double ring, the city in capitals
# around the top of the ring, a ribbon at the bottom carrying the place name, a small series number under
# it. Edit freely — this is the prompt the founder has been typing into Grok, kept in one place.
STYLE = ("A collectible passport stamp for {name}, {where}, {country}. One upright oval seal centered on a plain white "
         "background, drawn as a fine vintage engraving: dense cross-hatching and stipple in a single navy-blue ink, "
         "slightly grainy like a real rubber stamp. {name} fills the oval, large, accurate and instantly recognizable. "
         "A double oval border; around the top of the ring the text \"{ring}\" in spaced capitals; a curled ribbon "
         "banner across the bottom reading \"{title}\" in bold capitals; below it the small number \"{num}\". "
         "Every word spelled exactly as written. No other text, no logos or emblems of any kind (never the Olympic rings, a Games emblem, torch or mascot), no colour but navy blue, nothing outside the oval.")
STYLE_REF = ("Draw a new passport stamp for {name}, {where}, {country} in exactly the style of <IMAGE_0>: the same upright "
             "oval seal, double ring, navy-blue single-ink engraving, ribbon banner and framing. {name} fills the oval, large, "
             "accurate and instantly recognizable. Ring text \"{ring}\" in spaced capitals, ribbon text \"{title}\" in bold "
             "capitals, the small number \"{num}\" under the ribbon — every word spelled exactly as written. "
             "No other text, no logos or emblems of any kind (never the Olympic rings, a Games emblem, torch or mascot), only navy blue on white, nothing outside the oval.")
def words(r):
    where = (r.get("where") or "").split("/")[0].strip()
    if not where.isascii(): where = ""                       # a city in Thai or Chinese script would confuse the model
    ring = " · ".join(x for x in (where.upper(), r["country"].upper()) if x) or r["country"].upper()
    return dict(name=r["name"], where=where or r["country"], country=r["country"], ring=ring, title=r["name"].upper(), num=f"{r.get('n') or 0:03d}")

def load_places(args):
    rows = json.load(open(ROWS))
    if args.slugs:
        want = {s if s.endswith(".png") else s + ".png" for s in args.slugs}
        picked = [r for r in rows if r["file"] in want]
        missing = want - {r["file"] for r in picked}
        for m in sorted(missing): print(f"  (no tracker row for {m} — drawing it by name only)"); picked.append({"name": m[:-4].replace("-", " ").title(), "where": "", "country": "", "file": m, "tier": "National favorite", "art": None})
        return picked
    picked = [r for r in rows if r["country"].lower() == args.country.lower() and (args.redraw or not r.get("art"))]
    if args.tier: picked = [r for r in picked if r["tier"].lower().startswith(args.tier.lower())]
    picked.sort(key=lambda r: (TIER_RANK.get(r["tier"], 9), r["n"]))
    return picked[: args.limit]

def post(path, body, key):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (429, 500, 502, 503) and attempt < 3: time.sleep(3 * (attempt + 1)); continue
            raise SystemExit(f"xAI API {e.code}: {msg}")
    raise SystemExit("xAI API: no answer after 4 tries")

def main():
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("--country"); ap.add_argument("--tier"); ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--slugs", nargs="*"); ap.add_argument("--ref"); ap.add_argument("--resolution", default="1k")
    ap.add_argument("--redraw", action="store_true"); ap.add_argument("--dry-run", action="store_true"); ap.add_argument("-h", "--help", action="store_true")
    args = ap.parse_args()
    if args.help or not (args.country or args.slugs): print(__doc__); return
    key = os.environ.get("XAI_API_KEY")
    if not key and not args.dry_run: raise SystemExit("Set XAI_API_KEY first (console.x.ai → API keys):  export XAI_API_KEY=xai-...")
    INBOX.mkdir(parents=True, exist_ok=True)
    places = load_places(args)
    if not places: print("Nothing to draw for that selection."); return
    ref_url = None
    if args.ref:
        p = Path(args.ref); mime = "image/jpeg" if p.suffix.lower() in (".jpg", ".jpeg") else "image/webp" if p.suffix.lower() == ".webp" else "image/png"
        ref_url = f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()
    print(f"{'Would draw' if args.dry_run else 'Drawing'} {len(places)} stamp{'s' if len(places) != 1 else ''} → {INBOX}\n")
    done = 0
    for r in places:
        out = INBOX / r["file"]
        if out.exists(): print(f"  skip  {r['file']}  (already in the inbox)"); continue
        tpl = STYLE_REF if ref_url else STYLE
        prompt = tpl.format(**words(r))
        if args.dry_run: print(f"  {r['file']}  ·  {r['name']} ({r['country']}, {r['tier']})\n      {prompt}\n"); continue
        body = {"model": MODEL, "prompt": prompt, "n": 1, "aspect_ratio": "1:1", "resolution": args.resolution, "response_format": "b64_json"}
        if ref_url: body["image"] = {"url": ref_url}
        res = post("edits" if ref_url else "generations", body, key)
        item = (res.get("data") or [{}])[0]; b64 = item.get("b64_json")
        if not b64: print(f"  FAILED {r['file']}: {json.dumps(res)[:200]}"); continue
        mime = item.get("mime_type") or "image/png"
        if mime != "image/png": out = out.with_suffix(".jpg" if "jpeg" in mime else ".webp")   # intake converts to PNG
        out.write_bytes(base64.b64decode(b64)); done += 1
        print(f"  drew  {out.name}  ·  {r['name']} ({r['country']})")
        time.sleep(0.3)
    if not args.dry_run:
        print(f"\n{done} image{'s' if done != 1 else ''} · about ${done * (0.04 if args.resolution == '1k' else 0.08):.2f} at the list price\nNext: python3 scripts/stamp-art/intake.py")

if __name__ == "__main__": main()

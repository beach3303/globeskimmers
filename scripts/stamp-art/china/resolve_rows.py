#!/usr/bin/env python3
"""The database side of the China stamp series (2026-11-22): every stamp the founder drew needs a row in the LIVE
attractions D1 that is stampable (founder_scope / scope in world · national · regional), so the stamp can be earned.

    python3 scripts/stamp-art/china/resolve_rows.py            # reads the drop in ~/Desktop/Stamp inbox (STAMP_INBOX)

Reads  list-2026-11-14.json (the 611-place list and its 11-14 database match), db-cn-2026-11-22.json (every China row
of the live D1, pulled with `wrangler d1 execute … --json`), aliases.json (hand decisions: name → row id, "" = no row),
../world/d1-world-rows.sql (rows the world tracker already prepared) and the PNGs in the inbox (which stamps exist).

For each drawn stamp:
  · the matched row is checked against geography (within 150 km of the place's city — the city located from the
    database's own rows, else Wikidata/Nominatim — or 450 km of its province); a row in the wrong city is a mismatch,
  · a good row that is not stampable → UPDATE founder_scope,
  · no row (or a mismatch) → the world SQL's INSERT if it has one, else Wikidata (P17 = China, P625 coordinates, nearest
    to the city), else Nominatim (OpenStreetMap), else "HAND PIN" in the review file,
  · a resolved place that already has a row (same QID, or same name within 2 km) is promoted instead of inserted.

Writes  d1-china-stamps.sql (self-contained, idempotent: INSERT OR IGNORE + UPDATE), review-rows.txt (one line per stamp:
decision, distance, source) and cn-art-index.json (file slug → row id, for src/lib/stampArtChina.js).
Nothing touches the server; the founder runs the SQL:
    npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/stamp-art/china/d1-china-stamps.sql
"""
import json, math, os, re, statistics, sys, threading, time, unicodedata, urllib.parse, urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent; REPO = HERE.parents[2]
INBOX = Path(os.environ.get("STAMP_INBOX") or Path.home() / "Desktop" / "Stamp inbox")
LIST = HERE / "list-2026-11-14.json"; DB = HERE / "db-cn-2026-11-22.json"; ALIASES = HERE / "aliases.json"
WORLD_SQL = HERE.parent / "world" / "d1-world-rows.sql"; WORLD_PY = HERE.parent / "world" / "resolve_rows2.py"
OUT_SQL = HERE / "d1-china-stamps.sql"; OUT_REVIEW = HERE / "review-rows.txt"; OUT_INDEX = HERE / "cn-art-index.json"
CACHE = HERE / ".resolve-cache.json"
UA = "GlobeSkimmers-stamp-rows/1.0 (+https://globeskimmers.io; passport stamp art)"
SCOPE = {"W": "world", "N": "national", "R": "regional"}; POP = {"world": 500000, "national": 200000, "regional": 100000}
STAMPABLE = ("world", "national", "regional")
CITY_KM, PROVINCE_KM, SAME_KM = 150, 450, 2.0
CN_QIDS = {"Q148"}   # P17 country = People's Republic of China
# footprint tables shared with the world resolver (one source): RADIUS by category, NAME_HINT by words in the name
_src = WORLD_PY.read_text()
RADIUS = eval(re.search(r"^RADIUS = (\{.*\})$", _src, re.M).group(1)); NAME_HINT = eval(re.search(r"^NAME_HINT = (\[.*\])$", _src, re.M).group(1))

def slug(s):
    s = "".join(ch for ch in unicodedata.normalize("NFKD", str(s or "")) if not unicodedata.combining(ch))
    s = re.sub(r"\([^)]*\)", " ", s).lower().replace("'", "").replace("’", "")
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s))
def km(a, b, c, d):
    p = math.pi / 180; x = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(x))
def sq(s): return "'" + str(s).replace("'", "''") + "'"

# ---- inputs -----------------------------------------------------------------------------------------------------
rows = json.load(open(LIST)); db = json.load(open(DB)); aliases = json.load(open(ALIASES)) if ALIASES.exists() else {}
ZH = json.load(open(HERE / "zh-names.json")) if (HERE / "zh-names.json").exists() else {}        # {"Rime Island": "雾凇岛"} — OSM China is in Chinese
PINS = json.load(open(HERE / "hand-pins.json")) if (HERE / "hand-pins.json").exists() else {}   # {"Mount Heng": {"qid": "Q…"} | {"lat": .., "lng": ..}}
def in_china(lat, lng): return lat is not None and 18.0 <= lat <= 53.6 and 73.4 <= lng <= 135.1
drawn = {p.stem for p in INBOX.iterdir() if p.suffix.lower() == ".png"} if INBOX.exists() else set()
stamps = [x for x in rows if re.sub(r"\.png$", "", x["file"]) in drawn]
world_sql = WORLD_SQL.read_text() if WORLD_SQL.exists() else ""
world_inserts = {}   # source_id (file slug) → the INSERT line
for line in world_sql.splitlines():
    m = re.match(r"INSERT OR IGNORE INTO attractions .*?VALUES \('([^']+)',('(?:[^']|'')*'),('(?:[^']|'')*'),([-\d.]+),([-\d.]+),('(?:[^']|'')*'),'China','stamp_art','([^']+)'", line)
    if m: world_inserts[m.group(7)] = line
by_id = {r["id"]: r for r in db}; by_qid = defaultdict(list); city_pts = defaultdict(list)
for r in db:
    if r.get("qid"): by_qid[r["qid"]].append(r)
    if r.get("city") and r.get("lat") is not None: city_pts[slug(r["city"])].append((float(r["lat"]), float(r["lng"])))
def stampable(r): return (r.get("founder_scope") or r.get("scope")) in STAMPABLE

# ---- the web, politely ------------------------------------------------------------------------------------------
cache = json.load(open(CACHE)) if CACHE.exists() else {}
LOCK = threading.Lock(); PACE_WD = threading.Semaphore(2); last_nom = [0.0]
def api(url, key):
    if key in cache: return cache[key]
    for attempt in range(4):
        try:
            if "nominatim" in url:
                with LOCK:
                    wait = 1.1 - (time.time() - last_nom[0])
                    if wait > 0: time.sleep(wait)
                    last_nom[0] = time.time()
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=40) as r: j = json.load(r)
            else:
                with PACE_WD:
                    req = urllib.request.Request(url, headers={"User-Agent": UA})
                    with urllib.request.urlopen(req, timeout=40) as r: j = json.load(r)
                    time.sleep(0.2)
            with LOCK:
                cache[key] = j
                if len(cache) % 25 == 0: json.dump(cache, open(str(CACHE) + ".tmp", "w")); os.replace(str(CACHE) + ".tmp", CACHE)
            return j
        except urllib.error.HTTPError as e:
            ra = e.headers.get("Retry-After") if e.headers else None; time.sleep(float(ra) if ra and ra.isdigit() else 4 * (attempt + 1))
        except Exception: time.sleep(2 * (attempt + 1))
    return None
WD = "https://www.wikidata.org/w/api.php?"
def wd_search(q, lang="en"):
    j = api(WD + urllib.parse.urlencode({"action": "wbsearchentities", "search": q, "language": lang, "type": "item", "limit": 8, "format": "json"}), f"wds|{q}" if lang == "en" else f"wds|{lang}|{q}")
    ids = [x["id"] for x in (j or {}).get("search", [])]
    j2 = api(WD + urllib.parse.urlencode({"action": "query", "list": "search", "srsearch": q, "srlimit": 8, "format": "json"}), "wdf|" + q)
    ids += [x["title"] for x in (j2 or {}).get("query", {}).get("search", []) if re.match(r"^Q\d+$", x.get("title", ""))]
    return list(dict.fromkeys(ids))
def wd_entities(ids):
    out = {}
    for i in range(0, len(ids), 20):
        chunk = ids[i:i + 20]
        j = api(WD + urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(chunk), "props": "labels|claims", "languages": "en|zh", "format": "json"}), "wde|" + "|".join(chunk))
        for qid, e in ((j or {}).get("entities") or {}).items():
            cl = e.get("claims") or {}
            def vals(p): return [c.get("mainsnak", {}).get("datavalue", {}).get("value") for c in cl.get(p, [])]
            co = [v for v in vals("P625") if isinstance(v, dict)]
            area = next((float(v["amount"]) for v in vals("P2046") if isinstance(v, dict) and v.get("unit", "").endswith("Q712226")), None)
            out[qid] = {"label": (e.get("labels", {}).get("en") or e.get("labels", {}).get("zh") or {}).get("value", ""), "countries": {v.get("id") for v in vals("P17") if isinstance(v, dict)},
                        "lat": co[0]["latitude"] if co else None, "lng": co[0]["longitude"] if co else None, "area": area,
                        "instance": {v.get("id") for v in vals("P31") if isinstance(v, dict)}}
    return out
def nominatim(q):
    j = api("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "countrycodes": "cn", "limit": 5, "accept-language": "en"}), "nom|" + q)
    return j or []

# ---- where is the city / province ----------------------------------------------------------------------------
PROVINCE_PTS = {}
def centroid_db(name):
    pts = city_pts.get(slug(name)) or []
    if len(pts) >= 3: return (statistics.median(p[0] for p in pts), statistics.median(p[1] for p in pts), f"{len(pts)} rows")
    return None
def centroid_web(name, province):
    for q in ([f"{name}, {province}, China", f"{name}, China"] if province else [f"{name}, China"]):
        for x in nominatim(q):
            if x.get("addresstype") in ("city", "county", "town", "state", "district", "municipality", "province", "village", "suburb", "administrative") or x.get("category") in ("place", "boundary"):
                return (float(x["lat"]), float(x["lon"]), f"osm {x.get('addresstype')}")
    return None
def place_centroid(where, province):
    where = re.split(r"[/,]", where or "")[0].strip()
    c = centroid_db(where) or centroid_web(where, province) if where else None
    if c: return c, CITY_KM, where
    if province:
        if province not in PROVINCE_PTS: PROVINCE_PTS[province] = centroid_db(province) or centroid_web(province, "")
        if PROVINCE_PTS[province]: return PROVINCE_PTS[province], PROVINCE_KM, province
    return None, None, where

# ---- resolving one stamp ---------------------------------------------------------------------------------------
ADMIN = {"Q515", "Q3957", "Q532", "Q486972", "Q1549591", "Q15284", "Q5119", "Q1093829", "Q13220204", "Q6256", "Q35657", "Q10864048", "Q1208802", "Q13360155", "Q29946056", "Q17361443", "Q1500350"}  # cities, towns, villages, districts, provinces … never a place to stamp
NOT_A_PLACE = {"Q13442814", "Q27686", "Q4830453", "Q783794", "Q5", "Q5633421", "Q16917", "Q3918", "Q7889", "Q11424", "Q571", "Q41298", "Q2085381", "Q4167410", "Q13406463"}  # articles, hotels, companies, people, journals, hospitals, universities-as-institutions, games, films, books, magazines, publishers, disambiguation, list pages
def toks(s): return {t for t in slug(s).split("-") if t and len(t) > 2 and t not in {"the", "and", "of", "ancient", "town", "city", "mount", "mountain", "park", "lake", "temple", "street", "scenic", "area", "national"}}
def resolve_wikidata(x, cen, radius_km):
    name, where = x["name"], re.split(r"[/,]", x["where"] or "")[0].strip()
    ids = wd_search(name) + wd_search(f"{name} {where}") + ([] if not x.get("province") else wd_search(f"{name} {x['province']}"))
    zh = ZH.get(name); zh_ids = set(wd_search(zh, "zh")) if zh else set()
    ids = list(dict.fromkeys(ids + sorted(zh_ids)))[:32]
    if not ids: return None
    ents = wd_entities(ids); best = None
    for qid, e in ents.items():
        if e["lat"] is None or e["instance"] & ADMIN or e["instance"] & NOT_A_PLACE: continue
        if e["countries"]:
            if not e["countries"] & CN_QIDS: continue
        elif not in_china(e["lat"], e["lng"]): continue          # no P17 at all (common for lakes, grasslands, peaks): the map decides
        d = km(cen[0], cen[1], e["lat"], e["lng"]) if cen else None
        if cen and d > radius_km: continue
        lt = toks(e["label"]); overlap = len(toks(name) & lt) / max(1, len(toks(name))); extra = len(lt - toks(name))
        if qid in zh_ids and overlap == 0: overlap = 0.9              # found by its Chinese name; the English label may differ or be missing
        score = overlap * 100 - extra * 12 - (d or 0) / 10 + (10 if slug(e["label"]) == slug(name) else 0)
        if overlap == 0 and not (cen and d <= 5): continue   # a label with no word in common must at least sit right on the city
        if not best or score > best[0]: best = (score, qid, e, d)
    if not best: return None
    _, qid, e, d = best
    return {"qid": qid, "lat": e["lat"], "lng": e["lng"], "label": e["label"], "area": e["area"], "d": d, "method": "wikidata"}
def resolve_osm(x, cen, radius_km):
    name, where, prov = x["name"], re.split(r"[/,]", x["where"] or "")[0].strip(), x.get("province") or ""
    zh = ZH.get(name)
    for q in ([zh, f"{zh} {where}"] if zh else []) + [f"{name}, {where}", f"{name}, {prov}", f"{name}, China"]:
        for h in nominatim(q):
            lat, lng = float(h["lat"]), float(h["lon"])
            if h.get("addresstype") in ("city", "town", "village", "hamlet", "county", "state", "province", "municipality") and h.get("category") == "place" \
               and (x.get("category") or "") not in ("village", "old town", "town", "district") : continue
            if h.get("category") in ("amenity", "shop", "office", "building", "craft", "emergency") and h.get("type") not in ("theatre", "place_of_worship", "university", "zoo", "aquarium", "theme_park", "ferry_terminal", "grave_yard", "monastery", "planetarium", "fountain"): continue
            d = km(cen[0], cen[1], lat, lng) if cen else None
            if cen and d > radius_km: continue
            return {"qid": None, "lat": lat, "lng": lng, "label": h.get("name") or h["display_name"].split(",")[0], "area": None, "d": d, "method": f"osm {h.get('category')}/{h.get('type')}"}
    return None
def radius_for(x, res):
    cat = (x.get("category") or "landmark").lower(); base = RADIUS.get(cat, 250)
    for pat, r in NAME_HINT:
        if re.search(pat, x["name"].lower()): base = max(base, r)
    if res and res.get("area"): base = max(base, min(8000, int(math.sqrt(res["area"] / math.pi) * 1000)))
    if res and res.get("pin_radius"): base = max(base, int(res["pin_radius"]))
    return base
BAD_ROWS = []   # live rows whose QID is right but whose pin is far from the place (import errors) — listed at the head of the SQL
def same_row(res, x):
    """An existing row for the resolved place: same QID within 10 km, or the same name within 2 km."""
    if res.get("qid"):
        for r in by_qid.get(res["qid"], []):
            if r.get("lat") is None: continue
            d = km(res["lat"], res["lng"], float(r["lat"]), float(r["lng"]))
            if d <= 10: return r
            BAD_ROWS.append(f"{r['id']} ({r['name']}, {r.get('city') or '?'}) carries {res['qid']} but sits {d:.0f} km from it — {x['n']:03d} {x['name']} gets its own icon row")
    want = {slug(x["name"]), slug(res.get("label") or "")}
    for r in db:
        if r.get("lat") is None: continue
        if slug(r["name"]) in want and km(res["lat"], res["lng"], float(r["lat"]), float(r["lng"])) <= SAME_KM: return r
    return None

def work(x):
    file = re.sub(r"\.png$", "", x["file"]); scope = SCOPE.get(x.get("tier") or "R", "regional"); out = {"n": x["n"], "name": x["name"], "where": x["where"], "file": file, "scope": scope}
    cen, radius_km, anchor = place_centroid(x["where"], x.get("province")); out["anchor"] = anchor; out["anchor_km"] = radius_km
    alias = aliases.get(x["name"]); row = None; note = ""
    if alias: row = by_id.get(alias); note = "hand alias"
    elif alias == "": note = "hand: no row"
    elif x.get("dbId"): row = by_id.get(x["dbId"]); note = x.get("how") or "list match"
    if row and row.get("lat") is not None:
        d = km(cen[0], cen[1], float(row["lat"]), float(row["lng"])) if cen else None
        if cen and d > radius_km and note != "hand alias":
            out["rejected"] = f"{row['id']} ({row['name']}, {row.get('city') or '?'}) is {d:.0f} km from {anchor}"; row = None
        else: out["d"] = d
    if row:
        out.update(row_id=row["id"], row_name=row["name"], via=note)
        out["action"] = "ok" if stampable(row) else "promote"
        return out
    # no usable row: the world SQL, then the web
    if file in world_inserts:
        line = world_inserts[file]; rid = re.search(r"VALUES \('([^']+)'", line).group(1)
        if rid in by_id:   # the world tracker's row already landed
            out.update(row_id=rid, row_name=by_id[rid]["name"], via="world row (live)"); out["action"] = "ok" if stampable(by_id[rid]) else "promote"; return out
        out.update(row_id=rid, row_name=x["name"], via="world SQL", insert=line); out["action"] = "insert"; return out
    res = None
    pin = PINS.get(x["name"])
    if pin and pin.get("qid"):
        e = wd_entities([pin["qid"]]).get(pin["qid"])
        if e and e["lat"] is not None: res = {"qid": pin["qid"], "lat": e["lat"], "lng": e["lng"], "label": e["label"] or x["name"], "area": e["area"], "d": km(cen[0], cen[1], e["lat"], e["lng"]) if cen else None, "method": "hand pin (wikidata)"}
    if not res and pin and pin.get("lat") is not None and pin.get("force"):   # the web keeps picking the wrong thing: Claude's pin wins
        res = {"qid": None, "lat": pin["lat"], "lng": pin["lng"], "label": x["name"], "area": None, "d": km(cen[0], cen[1], pin["lat"], pin["lng"]) if cen else None, "method": "hand pin (forced, verify)"}
    res = res or resolve_wikidata(x, cen, radius_km or PROVINCE_KM) or resolve_osm(x, cen, radius_km or PROVINCE_KM)
    if not res and pin and pin.get("lat") is not None:   # Claude's own pin, from the map — approximate, flagged in the review file
        res = {"qid": None, "lat": pin["lat"], "lng": pin["lng"], "label": x["name"], "area": None, "d": km(cen[0], cen[1], pin["lat"], pin["lng"]) if cen else None, "method": "hand pin (approximate, verify)"}
    if res and pin and pin.get("radius"): res["pin_radius"] = pin["radius"]
    if not res:
        out["action"] = "hand pin"; out["via"] = "nothing found" + (f" (rejected {out['rejected']})" if out.get("rejected") else ""); return out
    out["d"] = res["d"]; out["via"] = f"{res['method']} · {res['label']}"
    r = same_row(res, x)
    if r:
        out.update(row_id=r["id"], row_name=r["name"]); out["via"] += f" → existing row {r['id']}"; out["action"] = "ok" if stampable(r) else "promote"; return out
    rid = f"icon:{res['qid']}" if res.get("qid") else f"icon:{file}"
    city = re.split(r"[/,]", x["where"] or "")[0].strip(); cat = (x.get("category") or "landmark").replace(" ", "_")
    radius = radius_for(x, res); qid_sql = sq(res["qid"]) if res.get("qid") else "NULL"
    out["insert"] = (f"INSERT OR IGNORE INTO attractions (id,name,category,lat,lng,city,country,source,source_id,footprint_radius_m,tier,scope,founder_scope,qid,popularity) "
                     f"VALUES ({sq(rid)},{sq(x['name'])},{sq(cat)},{res['lat']:.5f},{res['lng']:.5f},{sq(city)},'China','stamp_art',{sq(file)},{radius},'page',{sq(scope)},{sq(scope)},{qid_sql},{POP[scope]}); "
                     f"-- {x['n']:03d} {res['method']} · {res['label']}" + (f" · {res['d']:.0f} km from {anchor}" if res["d"] is not None else ""))
    out.update(row_id=rid, row_name=x["name"]); out["action"] = "insert"; return out

def main():
    print(f"stamps drawn: {len(stamps)} of {len(rows)}; live China rows: {len(db)}; world SQL inserts: {len(world_inserts)}", flush=True)
    with ThreadPoolExecutor(max_workers=3) as ex: results = list(ex.map(work, stamps))
    json.dump(cache, open(CACHE, "w"))
    ok = [r for r in results if r["action"] == "ok"]; promote = [r for r in results if r["action"] == "promote"]
    insert = [r for r in results if r["action"] == "insert"]; hand = [r for r in results if r["action"] == "hand pin"]
    date = time.strftime("%Y-%m-%d")
    sql = [f"-- China stamp series · rows for the stamps the founder drew ({len(stamps)} stamps) · built {date} by scripts/stamp-art/china/resolve_rows.py",
           f"-- Idempotent: UPDATEs set founder_scope on rows that exist; INSERT OR IGNORE adds the missing places (Wikidata P625 / OpenStreetMap / the world tracker's rows).",
           f"-- Already stampable: {len(ok)} · promote: {len(promote)} · insert: {len(insert)} · still need a hand pin: {len(hand)} (see review-rows.txt)",
           f"-- Run: npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/stamp-art/china/d1-china-stamps.sql", ""]
    BAD_ROWS.append("wikidata:Q740442 (Hengdian World Studios, Jinhua) sits 74 km from Hengdian town — 128 gets its own icon row at the studios")
    for b in BAD_ROWS: sql.append(f"-- live row to look at: {b}")
    if BAD_ROWS: sql.append("")
    for r in sorted(promote, key=lambda r: r["n"]):
        sql.append(f"UPDATE attractions SET founder_scope={sq(r['scope'])}, updated_at=datetime('now') WHERE id={sq(r['row_id'])}; -- {r['n']:03d} {r['name']} (row named {r['row_name']})")
    sql.append("")
    for r in sorted(insert, key=lambda r: r["n"]): sql.append(r["insert"])
    OUT_SQL.write_text("\n".join(sql) + "\n")
    rev = [f"# review of the database side · {date} · ok {len(ok)} · promote {len(promote)} · insert {len(insert)} · hand pin {len(hand)}", ""]
    for r in sorted(results, key=lambda r: r["n"]):
        d = f"{r['d']:.0f} km" if r.get("d") is not None else "—"
        rev.append(f"{r['n']:03d}  {r['action']:<8} {r['name']} · {r['where']}  →  {r.get('row_id') or '—'} ({r.get('row_name') or '—'})  ·  {r.get('via') or ''}  ·  {d} from {r.get('anchor')}" + (f"  ·  REJECTED {r['rejected']}" if r.get("rejected") else ""))
    OUT_REVIEW.write_text("\n".join(rev) + "\n")
    json.dump({r["file"]: {"id": r["row_id"], "name": r["row_name"], "n": r["n"]} for r in results if r.get("row_id")}, open(OUT_INDEX, "w"), ensure_ascii=False, indent=0)
    print(f"ok {len(ok)} · promote {len(promote)} · insert {len(insert)} · hand pin {len(hand)}")
    for r in hand: print(f"  HAND PIN {r['n']:03d} {r['name']} · {r['where']} · {r['via']}")
    print(f"wrote {OUT_SQL.name}, {OUT_REVIEW.name}, {OUT_INDEX.name}")

if __name__ == "__main__": main()

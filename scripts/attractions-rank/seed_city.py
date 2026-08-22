#!/usr/bin/env python3
"""
Phase-1 attractions ranking pipeline (Globeskimmers "most popular" curated layer).

Per city, deterministically:
  1. EXTRACT  Overture Places tourism POIs in the city bbox (DuckDB over the free
              cloud parquet; cached to CSV so re-runs are instant).
  2. JOIN     enrich each POI with a fame signal via Wikidata + Wikipedia pageviews:
              a per-city Wikidata bounding-box prefetch (coords + enwiki + sitelinks),
              matched LOCALLY to POIs by normalized fuzzy name + geo gate (O(city),
              no per-POI network). Trailing-12-month HUMAN pageviews (agent=user).
  3. FILTER   the 7-gate visitability stack (category include/exclude, operating_status
              alive, public-access deny list, notability floor, dedup, rank+cut).
  4. SCORE    a stored pop_score (0-100) = weighted log(pageviews)+log(sitelinks)+category_prior.
  5. EMIT     JSON in the shape scripts/emit_d1_seed.py already consumes
              ({"result": {"attractions": [...]}}) PLUS a pop_score field, so the
              existing wrangler-d1 load path is reused unchanged.

Usage:
  python3 scripts/attractions-rank/seed_city.py nyc            # one city by key
  python3 scripts/attractions-rank/seed_city.py --all          # every city in cities.json
  python3 scripts/attractions-rank/seed_city.py nyc paris rome # several

Output (in this script's dir):
  out/<key>.preview.txt   human-readable ranked top list
  out/<key>.attractions.json   per-city curation JSON
  out/seed_attractions.curation.json   combined (feed to emit_d1_seed.py)

This script does NOT touch any database. It produces the curation JSON + SQL-ready
data; the operator runs the wrangler load command (printed at the end).
"""
import csv, json, math, os, re, sys, time, unicodedata, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
CACHE = os.path.join(HERE, "cache")
os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)

OVERTURE_RELEASE = "2026-08-19.0"
UA = "GlobeskimmersSeed/1.0 (maizasimeon@gmail.com)"
PV_START, PV_END = "2025080100", "2026073100"   # trailing 12 full months @ 2026-08
TOP_N = 80          # curated rows stored per city
MARQUEE_MIN = 55    # pop_score at/above this -> is_marquee=1 (surfaces via existing read path)
PV_CAP = 450        # max pageview HTTP calls per city (bounds runtime)

# ---- Overture primary-category -> D1 attractions enum (emit_d1_seed VALID_CATEGORIES)
CAT_MAP = {
    "art_museum": "art_gallery", "modern_art_museum": "art_gallery", "art_gallery": "art_gallery",
    "museum": "museum", "history_museum": "museum", "science_museum": "museum",
    "childrens_museum": "museum", "specialty_museum": "museum",
    "landmark_and_historical_building": "landmark", "historic": "historic", "historical_place": "historic",
    "monument": "monument", "memorial": "monument",
    "park": "park", "national_park": "national_park", "state_park": "park",
    "botanical_garden": "garden", "garden": "garden",
    "church_cathedral": "cathedral", "cathedral": "cathedral", "basilica": "cathedral",
    "buddhist_temple": "temple", "hindu_temple": "temple", "temple": "temple",
    "mosque": "mosque", "shrine": "shrine", "synagogue": "religious", "religious": "religious",
    "bridge": "landmark", "tower": "tower", "observation_deck": "observation_deck",
    "observatory": "observation_deck", "viewpoint": "viewpoint", "scenic_point": "viewpoint",
    "stadium_arena": "experience", "theaters_and_performance_venues": "experience", "theatre": "experience",
    "amusement_park": "theme_park", "theme_park": "theme_park", "water_park": "theme_park",
    "zoo": "zoo", "aquarium": "aquarium",
    "castle": "fortress", "palace": "palace", "fortress": "fortress",
    "waterfall": "waterfall", "beach": "beach", "lake": "lake", "river": "river",
    "market": "market", "plaza_square": "square", "square": "square",
}
# category_prior (0-1): rescues fame-poor must-sees, demotes generic landmarks.
CAT_PRIOR = {
    "museum": 1.0, "art_gallery": 1.0, "monument": 0.95, "national_park": 1.0, "park": 0.85,
    "garden": 0.85, "cathedral": 0.8, "temple": 0.8, "shrine": 0.7, "mosque": 0.8,
    "palace": 0.95, "fortress": 0.9, "observation_deck": 0.95, "viewpoint": 0.75,
    "theme_park": 0.95, "zoo": 0.9, "aquarium": 0.9, "waterfall": 0.9, "beach": 0.8,
    "experience": 0.6, "tower": 0.55, "market": 0.55, "square": 0.55, "lake": 0.6, "river": 0.6,
    "historic": 0.5, "religious": 0.4, "landmark": 0.45,
}
FREE_CATEGORIES = {"park", "national_park", "viewpoint", "beach", "waterfall", "garden",
                   "square", "district", "river", "lake", "monument"}
MINUTES = {"museum": 120, "art_gallery": 90, "theme_park": 240, "zoo": 180, "aquarium": 90,
           "national_park": 240, "park": 60, "viewpoint": 30, "beach": 120, "waterfall": 60,
           "garden": 60, "landmark": 60, "monument": 30, "historic": 60, "religious": 45,
           "temple": 45, "shrine": 45, "mosque": 45, "cathedral": 60, "palace": 90, "tower": 60,
           "observation_deck": 60, "fortress": 90, "square": 30, "market": 90, "experience": 120,
           "river": 45, "lake": 60}

# 7-gate stack, gate 1: extraction category regex (visitable-attraction categories).
INCLUDE_RE = re.compile(
    r"tourist|attraction|museum|monument|landmark|historic|memorial|gallery|observation|"
    r"observatory|aquarium|zoo|amusement|theme_park|water_park|botanical|garden|scenic|"
    r"viewpoint|castle|palace|fortress|cathedral|basilica|shrine|temple|synagogue|mosque|"
    r"national_park|state_park|\bpark\b|bridge|opera|theater|theatre|stadium|arena|waterfall|"
    r"lighthouse|market|plaza|square", re.I)
# gate 2: category EXCLUDE (never attractions even if they matched a token above).
EXCLUDE_CAT_RE = re.compile(
    r"parking|dog_park|beer_garden|nursery|home_and_garden|office|coworking|"
    r"apartment|condo|residence|residential|dormitory|hotel|hostel|school|university|"
    r"college|hospital|government|police|fire_station|cemetery_service", re.I)
# gate 2 (name keyword): residential/office towers, offices, HQs.
EXCLUDE_NAME_RE = re.compile(
    r"\b(condo|condominium|apartments?|apartelle|residences?|residential|townhous?e|townhome|"
    r"staff\s*house|dormitory|dorm|subdivision|offices?|headquarters|hq|corporate|"
    r"coworking|wework)\b", re.I)
# gate 3: operating_status not alive.
DEAD_RE = re.compile(r"clos|demolish|defunct|abandon|razed|proposed|construction", re.I)
# gate 3b: demolished/former via a year-range in the WD title, e.g. "(1973–2001)".
DEMOLISHED_TITLE_RE = re.compile(r"\(\s*\d{4}\s*[–—-]\s*\d{4}\s*\)|[–—-]\s*(19|20)\d{2}\s*\)")
# gate 4b: Wikidata typing. We classify each confirmed item against three class sets in
# ONE bounded pass, then decide with the nuanced rule below.
#   STRONG  = "obviously visit-me" (a positive that overrides a residential/office type,
#             so Empire State [skyscraper + tourist attraction] survives).
#   INCLUDE = the full attraction/structure supertype set (broad recall).
#   RESI    = residential/office/hotel/lodging/edu/medical (exclude UNLESS also STRONG).
STRONG_CLASSES = ["Q570116", "Q46169", "Q33506", "Q207694", "Q2065736", "Q839954", "Q4989906"]
INCLUDE_CLASSES = STRONG_CLASSES + [
    "Q5003624", "Q22698", "Q22746", "Q1107656", "Q167346", "Q16970", "Q44539", "Q32815",
    "Q34627", "Q483110", "Q1076486", "Q24354", "Q153562", "Q1060829", "Q174782", "Q12280",
    "Q23413", "Q16560", "Q43501", "Q39614", "Q194195", "Q39715", "Q12518", "Q1497364",
    "Q811979", "Q41176", "Q4989906", "Q2416723", "Q57821", "Q1802963",
    "Q23442", "Q473972", "Q179700", "Q860861", "Q1370598", "Q207694"]  # island, protected area, statue, sculpture, place of worship
# RESI_BUILDING: building-use exclusions a famous NAME match may override (Empire State =
# office building but everyone visits its deck). RESI_HARD: entities that are NEVER an
# attraction no matter the name (admin/neighborhood/city/person/event/university/street).
# Note: organization/business are deliberately NOT hard — zoos/gardens are orgs; instead
# non-attraction orgs (NBC, Sotheby's) fail because they carry no INCLUDE structure type.
RESI_BUILDING = ["Q11755880", "Q13402009", "Q1783178", "Q1021645", "Q27686", "Q1662011", "Q11707"]
RESI_HARD = ["Q5", "Q1190554", "Q56061", "Q123705", "Q515", "Q532", "Q3957", "Q3918",
             "Q3914", "Q16917", "Q79007", "Q34442", "Q1500350", "Q40357", "Q205495"]
# RH_PATCH: the ABSOLUTE non-places a genuine name-match must never override (person,
# admin area, city, neighborhood, street). Narrower than RESI_HARD so a real multi-word
# name match to an attraction POI can rescue a structure that Wikidata mis-typed as an
# event/hall-of-residence (e.g. Rockefeller Center, Grand Central).
RH_PATCH = {"Q5", "Q56061", "Q515", "Q532", "Q3957", "Q123705", "Q79007", "Q34442",
            "Q3918", "Q3914", "Q16917"}  # + university/school/hospital: never patch-rescue these
# gate 4: curated public-access DENY list (famous but exterior-only / private / transit).
#   normalized names. Extend per city as QA surfaces edge cases.
DENY_NAMES = {n.lower() for n in [
    # NYC exterior-only office / private residential / private park / transit
    "chrysler building", "flatiron building", "the dakota", "432 park avenue",
    "111 west 57th street", "central park tower", "gramercy park", "40 wall street",
    "one57", "270 park avenue", "trump tower", "33 thomas street", "tin pan alley",
    "laguardia airport", "new york penn station", "penn station", "john f kennedy international airport",
    "7 world trade center", "2 world trade center", "270 park avenue", "steinway tower",
    "one vanderbilt",  # keep only "Summit One Vanderbilt" (the deck), drop the bare office tower
    # generic non-attractions that slip through as "landmark"
    "wall street", "fifth avenue", "broadway", "times square ball",
    # known demolished/defunct with no year-range in the title (title regex can't catch)
    "polo grounds", "singer building", "new york crystal palace", "pennsylvania station (1910-1963)",
    "cbgb",  # defunct music club (now a retail store)
    # office/mall complexes that geo-confirm to an adjacent park
    "bank of america tower", "deutsche bank center", "brookfield place", "seagram building",
]}
# canonical display-name remap (source name -> tourist-facing name)
ALIAS = {
    "liberty island": "Statue of Liberty",
    "30 rockefeller plaza": "Top of the Rock",
    "space shuttle enterprise": "Intrepid Sea, Air & Space Museum",
    "ellis island national museum of immigration": "Ellis Island",
}

def http(url, timeout=55, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except Exception as e:
            if i == tries - 1:
                return {"__error__": str(e)}
            time.sleep(2)
    return None

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower().strip()
    s = re.sub(r"^the\s+", "", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def clean_title(s):
    """Tourist-facing display name: drop Wikipedia disambiguation qualifiers
    like '(New York City)' / '(Manhattan)' and collapse whitespace."""
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s or "").strip()
    return s or (s if s else "")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))

# ---------------------------------------------------------------- 1. EXTRACT
def extract_overture(c):
    cache = os.path.join(CACHE, f"{c['key']}_overture.csv")
    if os.path.exists(cache) and os.path.getsize(cache) > 0:
        print(f"  [extract] cache hit {cache}", file=sys.stderr)
    else:
        w, s, e, n = c["bbox"]
        q = f"""
        INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';
        COPY (
          SELECT id, names.primary AS name, categories.primary AS category, confidence,
                 ST_Y(geometry) AS lat, ST_X(geometry) AS lng, operating_status
          FROM read_parquet('s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme=places/type=place/*.parquet', hive_partitioning=1)
          WHERE bbox.xmin >= {w} AND bbox.xmax <= {e} AND bbox.ymin >= {s} AND bbox.ymax <= {n}
            AND names.primary IS NOT NULL AND categories.primary IS NOT NULL
            AND regexp_matches(categories.primary, '{INCLUDE_RE.pattern}')
        ) TO '{cache}' (HEADER, DELIMITER ',');
        """
        print(f"  [extract] querying Overture {OVERTURE_RELEASE} bbox={c['bbox']} ...", file=sys.stderr)
        rc = os.system(f'duckdb -c "{q}" 2>/dev/null')
        if rc != 0 or not os.path.exists(cache):
            print(f"  [extract] FAILED for {c['key']}", file=sys.stderr); return []
    rows = []
    with open(cache) as f:
        for r in csv.DictReader(f):
            try:
                lat, lng = float(r["lat"]), float(r["lng"])
            except Exception:
                continue
            rows.append({"id": r["id"], "name": r["name"], "cat_raw": r["category"],
                         "conf": float(r.get("confidence") or 0), "lat": lat, "lng": lng,
                         "op": (r.get("operating_status") or "").strip()})
    print(f"  [extract] {len(rows)} tourism POIs", file=sys.stderr)
    return rows

# ---------------------------------------------------------------- 2. JOIN
def wikidata_box(bbox):
    w, s, e, n = bbox
    q = f"""SELECT ?item ?article ?sitelinks ?coord WHERE {{
      SERVICE wikibase:box {{ ?item wdt:P625 ?coord .
        bd:serviceParam wikibase:cornerWest "Point({w} {s})"^^geo:wktLiteral .
        bd:serviceParam wikibase:cornerEast "Point({e} {n})"^^geo:wktLiteral . }}
      ?item wikibase:sitelinks ?sitelinks .
      ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
    }} ORDER BY DESC(?sitelinks) LIMIT 2500"""
    res = http("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q))
    if not res or "__error__" in res:
        print(f"  [join] WDQS error: {res.get('__error__') if res else 'none'}", file=sys.stderr); return []
    out = []
    for b in res["results"]["bindings"]:
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", b["coord"]["value"])
        if not m:
            continue
        title = urllib.parse.unquote(b["article"]["value"].rsplit("/wiki/", 1)[-1]).replace("_", " ")
        out.append({"qid": b["item"]["value"].rsplit("/", 1)[-1], "title": title,
                    "sitelinks": int(b["sitelinks"]["value"]),
                    "lat": float(m.group(2)), "lng": float(m.group(1)), "norm": norm(title)})
    print(f"  [join] {len(out)} Wikidata items in box", file=sys.stderr)
    return out

def wd_classify(qids):
    """For each QID return the set of OF-INTEREST class QIDs it is an instance/subclass of
    (STRONG ∪ INCLUDE ∪ RESI), in one VALUES-bounded pass per chunk (fast: P279* is walked
    UP from each item, not down from the class). Returns {qid: set(class_qids)}."""
    of_interest = sorted(set(STRONG_CLASSES + INCLUDE_CLASSES + RESI_BUILDING + RESI_HARD))
    vals = " ".join("wd:" + c for c in of_interest)
    out, B = {}, 180
    for i in range(0, len(qids), B):
        chunk = " ".join("wd:" + q for q in qids[i:i+B])
        q = (f"SELECT ?item ?c WHERE {{ VALUES ?item {{ {chunk} }} "
             f"?item wdt:P31/wdt:P279* ?c . VALUES ?c {{ {vals} }} }}")
        r = http("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q))
        if r and "__error__" not in r:
            for b in r["results"]["bindings"]:
                qid = b["item"]["value"].rsplit("/", 1)[-1]
                cls = b["c"]["value"].rsplit("/", 1)[-1]
                out.setdefault(qid, set()).add(cls)
        time.sleep(0.3)
    return out

def jaccard(a, b):
    sa, sb = set(a.split()), set(b.split())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)

def confirm_items(wd, pois):
    """WD titles are the ranked BACKBONE (clean names + fame). Each WD item is kept
    only if an Overture attraction-POI sits near its coordinate — that owned-POI
    presence is the visitability filter (removes demolished/abstract). Confirmation is
    GEO-primary (name-agnostic, robust to Overture's messy names) with a name match
    PREFERRED when available (gives a precise coord + reliable category). Fame belongs
    to the WD title that IS the display name, so inherited-fame false matches can't hide.
    RAD_NAME = accept a name-matched POI out to here; RAD_GEO = geo-only confirm radius."""
    RAD_NAME, RAD_GEO = 900, 350
    # coarse grid (~0.01deg ~1.1km) so nearest-POI scan is O(1) per item
    grid = {}
    for p in pois:
        p["norm"] = norm(p["name"])
        grid.setdefault((round(p["lat"], 2), round(p["lng"], 2)), []).append(p)
    def nearby(lat, lng):
        out = []
        for dla in (-0.01, 0.0, 0.01):
            for dlo in (-0.01, 0.0, 0.01):
                out += grid.get((round(lat + dla, 2), round(lng + dlo, 2)), [])
        return out
    confirmed = []
    for w in wd:
        wn = w["norm"]
        if not wn:
            continue
        best, best_key = None, None
        for p in nearby(w["lat"], w["lng"]):
            dm = haversine(w["lat"], w["lng"], p["lat"], p["lng"])
            j = jaccard(wn, p["norm"])
            if j >= 0.5 and dm <= RAD_NAME:
                key = (1, round(j, 3), -dm)        # name-matched: precise coord + category
            elif dm <= RAD_GEO:
                key = (0, 0.0, -dm)                # geo-only: real place nearby, cat approx
            else:
                continue
            if best is None or key > best_key:
                best, best_key = p, key
        if best:
            named = best_key[0] == 1
            wtoks, ptoks = set(wn.split()), set(best["norm"].split())
            confirmed.append({
                "qid": w["qid"], "title": w["title"], "sitelinks": w["sitelinks"],
                "lat": best["lat"] if named else w["lat"],   # precise POI coord if name-matched
                "lng": best["lng"] if named else w["lng"],
                "cat_raw": best["cat_raw"], "op": best["op"] if named else "",
                "conf": best["conf"], "poi_name": best["name"], "named": named, "norm": wn,
                "subset": named and wtoks.issubset(ptoks),   # WD title fully inside POI name
                "ntok": len(wtoks),
            })
    print(f"  [join] {len(confirmed)}/{len(wd)} Wikidata items confirmed by a nearby Overture POI", file=sys.stderr)
    return confirmed

_PV_PATH = os.path.join(CACHE, "pageviews.json")
try:
    _PV_CACHE = json.load(open(_PV_PATH))
except Exception:
    _PV_CACHE = {}

def save_pv_cache():
    try:
        json.dump(_PV_CACHE, open(_PV_PATH, "w"))
    except Exception:
        pass

def pageviews(title):
    key = f"{title}|{PV_START}-{PV_END}"
    if key in _PV_CACHE:
        return _PV_CACHE[key]
    t = urllib.parse.quote(title.replace(" ", "_"), safe="")
    d = http(f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
             f"en.wikipedia/all-access/user/{t}/monthly/{PV_START}/{PV_END}", timeout=30)
    v = sum(i.get("views", 0) for i in d["items"]) if d and "items" in d else 0
    _PV_CACHE[key] = v
    return v

# ---------------------------------------------------------------- 3+4 FILTER + SCORE
def sigmoid(x):
    return 1 / (1 + math.exp(-x))

def build_city(c):
    print(f"[{c['key']}] {c['city']}, {c['country']}", file=sys.stderr)
    pois = extract_overture(c)
    if not pois:
        return []
    wd = wikidata_box(c["bbox"])
    items = confirm_items(wd, pois)

    # gate 2 (exclude cats + name keywords on the confirming POI), gate 3 (op status), gate 4 (deny)
    kept = []
    for p in items:
        if EXCLUDE_CAT_RE.search(p["cat_raw"]):
            continue
        # residential/office keyword filter: always on the WD title; on the confirming
        # POI name ONLY when it was a real name-match (a geo-only proximity witness like
        # "HomeAway Eiffel Tower Apartment" must not veto the clean-titled attraction).
        if EXCLUDE_NAME_RE.search(p["title"] or "") or (p["named"] and EXCLUDE_NAME_RE.search(p["poi_name"] or "")):
            continue
        if p["op"] and DEAD_RE.search(p["op"]):
            continue
        if DEMOLISHED_TITLE_RE.search(p["title"] or ""):
            continue
        if norm(clean_title(p["title"])) in DENY_NAMES:
            continue
        p["cat"] = CAT_MAP.get(p["cat_raw"], "landmark")
        kept.append(p)

    # gate 4b: Wikidata type decision. Keep if the item is an attraction supertype
    # (INCLUDE) and not merely residential/office/hotel/org (RESI) — unless it is ALSO
    # a STRONG attraction type (Empire State = skyscraper + tourist attraction survives).
    # Plus a name-patch: a multi-word title fully inside a real attraction POI's name is
    # kept even if its typing is incomplete (rescues Statue of Liberty, Grand Central...).
    # patch cats include landmark/tower/historic so a genuine multi-word NAME match
    # rescues famous buildings whose Wikidata typing is only "office building"/"skyscraper"
    # (e.g. Empire State Building, Grand Central, Rockefeller Center). A real name match to
    # a physical POI is trusted even past the RESI guard; geo-only confirms are NOT patched.
    PATCH_CATS = {"museum", "art_gallery", "monument", "park", "national_park", "garden",
                  "cathedral", "temple", "shrine", "mosque", "palace", "fortress",
                  "observation_deck", "viewpoint", "theme_park", "zoo", "aquarium",
                  "waterfall", "beach", "experience", "tower", "square",
                  "landmark", "historic"}
    cls = wd_classify([p["qid"] for p in kept])
    S, I, RB, RH = set(STRONG_CLASSES), set(INCLUDE_CLASSES), set(RESI_BUILDING), set(RESI_HARD)
    typed, before = [], len(kept)
    for p in kept:
        cs = cls.get(p["qid"], set())
        strong, incl = bool(cs & S), bool(cs & I)
        rb, rh = bool(cs & RB), bool(cs & RH)
        # A STRONG attraction type (tourist attraction / museum / observation deck / monument)
        # overrides ANY reject — Eiffel Tower is also tagged an administrative entity, Times
        # Square a neighborhood; both are still attractions. Otherwise require no reject.
        type_ok = incl and (strong or not (rh or rb))
        patch = p["subset"] and p["ntok"] >= 2 and p["cat"] in PATCH_CATS and not (cs & RH_PATCH)
        if type_ok or patch:
            typed.append(p)
    kept = typed
    print(f"  [filter] type gate kept {len(kept)}/{before}", file=sys.stderr)

    # gate 6 dedup: by QID (inherent), then collapse near-identical titles within 80m
    by_qid = {}
    for p in kept:
        prev = by_qid.get(p["qid"])
        if prev is None or p["sitelinks"] > prev["sitelinks"]:
            by_qid[p["qid"]] = p
    deduped, seen = [], []
    for p in sorted(by_qid.values(), key=lambda x: x["sitelinks"], reverse=True):
        if any(p["norm"] == q["norm"] and haversine(p["lat"], p["lng"], q["lat"], q["lng"]) <= 80
               for q in seen):
            continue
        seen.append(p); deduped.append(p)

    # fame: pageviews for all confirmed (bounded by sitelinks priority)
    ranked_for_pv = sorted(deduped, key=lambda x: x["sitelinks"], reverse=True)
    for i, p in enumerate(ranked_for_pv[:PV_CAP]):
        p["pv"] = pageviews(p["title"])
        if i % 40 == 0:
            print(f"  [fame] {i}/{min(len(ranked_for_pv), PV_CAP)}", file=sys.stderr)
        time.sleep(0.04)
    for p in deduped:
        p.setdefault("pv", 0)
    save_pv_cache()

    # gate 5 notability floor: drop generic landmark/historic/tower with no real traction
    deduped = [p for p in deduped if not (
        p["cat"] in ("landmark", "historic", "tower") and p["pv"] < 3000 and p["sitelinks"] < 3)]

    # score: min-max normalize log(pv) and log(sitelinks) WITHIN city
    lpv = [math.log10(p["pv"] + 1) for p in deduped]
    lsl = [math.log10(p["sitelinks"] + 1) for p in deduped]
    mxpv, mxsl = max(lpv) or 1, max(lsl) or 1
    for p in deduped:
        npv = math.log10(p["pv"] + 1) / mxpv if mxpv else 0
        nsl = math.log10(p["sitelinks"] + 1) / mxsl if mxsl else 0
        prior = CAT_PRIOR.get(p["cat"], 0.4)
        p["pop_score"] = round(100 * (0.55 * npv + 0.20 * nsl + 0.25 * prior), 1)

    # gate 7 rank + cut
    deduped.sort(key=lambda p: p["pop_score"], reverse=True)
    top = deduped[:TOP_N]

    rows = []
    for p in top:
        disp = ALIAS.get(norm(clean_title(p["title"])), clean_title(p["title"]))
        rows.append({
            "name": disp, "category": p["cat"], "lat": round(p["lat"], 6), "lng": round(p["lng"], 6),
            "city": c["city"], "country": c["country"], "description": "", "why_visit": "",
            "typical_minutes": MINUTES.get(p["cat"], 60),
            "is_marquee": 1 if p["pop_score"] >= MARQUEE_MIN else 0,
            "free_to_visit": 1 if p["cat"] in FREE_CATEGORIES else 0,
            "pop_score": p["pop_score"], "pageviews": p["pv"], "sitelinks": p["sitelinks"],
        })
    # preview
    with open(os.path.join(OUT, f"{c['key']}.preview.txt"), "w") as f:
        f.write(f"{c['city']}, {c['country']} — top {min(30, len(rows))} of {len(rows)} curated\n")
        f.write(f"{'#':>2}  {'score':>5}  {'marq':>4}  {'pageviews':>10}  {'cat':<14}  name\n")
        for i, r in enumerate(rows[:30], 1):
            f.write(f"{i:>2}  {r['pop_score']:>5}  {'★' if r['is_marquee'] else ' ':>4}  "
                    f"{r['pageviews']:>10,}  {r['category']:<14}  {r['name']}\n")
    with open(os.path.join(OUT, f"{c['key']}.attractions.json"), "w") as f:
        json.dump({"result": {"attractions": rows}}, f, indent=2, ensure_ascii=False)
    print(f"  [done] {len(rows)} curated rows, {sum(r['is_marquee'] for r in rows)} marquee", file=sys.stderr)
    return rows

def main():
    conf = json.load(open(os.path.join(HERE, "cities.json")))["cities"]
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(0)
    keys = [x["key"] for x in conf] if "--all" in args else args
    chosen = [x for x in conf if x["key"] in keys]
    if not chosen:
        print(f"No matching city keys. Available: {[x['key'] for x in conf]}"); sys.exit(1)
    allrows = []
    for c in chosen:
        allrows += build_city(c)
    combined = os.path.join(OUT, "seed_attractions.curation.json")
    json.dump({"result": {"attractions": allrows}}, open(combined, "w"), indent=2, ensure_ascii=False)
    print("\n" + "=" * 64)
    print(f"COMBINED: {len(allrows)} attractions across {len(chosen)} cities -> {combined}")
    print("Next steps (operator runs — needs your Cloudflare creds):")
    print("  1. python3 scripts/emit_d1_seed.py scripts/attractions-rank/out/seed_attractions.curation.json")
    print("     (add the pop_score column first: scripts/attractions-rank/01_alter_pop_score.sql)")
    print("  2. cd \"<repo>\" && npx wrangler d1 execute globeskimmers-attractions --remote \\")
    print("       --file cloudflare-worker/sql/seed_attractions.sql")
    print("=" * 64)

if __name__ == "__main__":
    main()

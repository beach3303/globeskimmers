"""Stage 5b + 7 + 8 - assemble candidates, dedupe against our owned attractions,
suggest a footprint radius, score, and write the review files:

  candidates.csv   every work x spot candidate (wikidata + curated)
  seed_400.csv     the chosen 400 spots, one row per spot (also_in lists other works)
  review_40.csv    the 40 seed rows most in need of a human look, with `why`

Nothing is written to any database.
"""
import csv
import difflib
import json
import math
import os
import re
import unicodedata
import urllib.parse
from collections import defaultdict

import lib
from curated_scenes import S as SCENES

HERE = lib.HERE
SEED_N = 400
MIN_NON_USUK = 100          # >= 25% of 400
MIN_CURATED_NONWEST = 60
NONWEST = {"asia", "me", "africa", "latam", "pacific"}

# ---------------------------------------------------------------- radius (stage 7)
RADIUS_RULES = [  # (radius_m, rule name, class keywords) - first match wins
    (60, "stairs/street/cafe/shop", ["stair", "step", "street", "café", "cafe", "coffee", "restaurant", "shop",
                                     "store", "bar", "pub", "diner", "alley", "bakery", "bookshop", "boutique"]),
    (120, "square/bridge/viaduct", ["square", "plaza", "bridge", "viaduct", "fountain", "statue", "pier",
                                    "crossing", "monument", "gate", "arch", "lighthouse"]),
    (500, "mountain/natural site", ["mountain", "hill", "cliff", "waterfall", "lake", "valley", "canyon", "desert",
                                    "cave", "glacier", "volcano", "rock formation", "national park", "forest", "bay",
                                    "gorge", "dune", "salt", "river", "reservoir", "peninsula", "cape", "island",
                                    "natural", "karst", "oasis", "coast", "wetland", "grotto", "headland", "nature reserve",
                                    "protected area", "moor", "loch", "fjord", "sea stack", "arch (geology)"]),
    (300, "beach/park/ranch/set", ["beach", "park", "garden", "ranch", "film set", "set", "studio", "estate",
                                   "cemetery", "zoo", "campus", "golf", "farm", "resort", "village", "town",
                                   "amusement", "stadium", "racecourse", "vineyard", "square (large)"]),
    (150, "building/castle/station", ["building", "castle", "palace", "station", "hotel", "church", "cathedral",
                                      "museum", "tower", "skyscraper", "house", "mansion", "theatre", "theater",
                                      "school", "college", "library", "temple", "shrine", "mosque", "fort",
                                      "abbey", "manor", "hall", "prison", "jail", "court", "ruins", "ksar", "dzong"]),
]
CURATED_RADIUS = {"stairs": 60, "street": 60, "cafe": 60, "square": 120, "bridge": 120, "viaduct": 120,
                  "building": 150, "castle": 150, "station": 150, "beach": 300, "park": 300, "set": 300,
                  "village": 300, "natural": 500, "mountain": 500}
CURATED_RULE = {60: "stairs/street/cafe/shop", 120: "square/bridge/viaduct", 150: "building/castle/station",
                300: "beach/park/ranch/set", 500: "mountain/natural site"}


def radius_for(classes):
    txt = " | ".join(c.lower() for c in classes)
    for r, name, kws in RADIUS_RULES:
        for k in kws:
            if re.search(r"(^|[\s|(/-])" + re.escape(k), txt):
                return r, f"{name} ({k})"
    return 150, "building/castle/station (default)"


# ---------------------------------------------------------------- class filters
NOT_A_SPOT = ["continent", "ocean", "sea", "part of the world", "geographical pole", "country", "sovereign state",
              "archipelago", "mountain range", "geographic region", "historical region", "region", "county",
              "province", "state of the united states", "television production company", "film production company",
              "enterprise", "business", "company", "organization", "broadcaster", "river", "federal agency",
              "government agency", "destroyed building or structure", "demolished building or structure"]
MAX_AREA_KM2 = 25   # a Wikidata "spot" bigger than this is a region (Long Island, Kaua'i), not a spot
VISITOR = ["tourist attraction", "museum", "amusement park", "theme park", "visitor attraction", "historic site",
           "heritage", "monument", "film set"]
STUDIO = ["film studio", "television studio", "sound stage", "studio complex", "backlot"]
CITYISH = ["neighborhood", "neighbourhood", "district", "borough", "quarter", "suburb", "census-designated place",
           "unincorporated community", "hamlet", "locality", "human settlement", "city", "town", "village",
           "municipality", "commune", "county seat", "ward"]
LARGE = ["island", "desert", "national park", "national forest", "river", "lake", "bay", "peninsula", "valley",
         "canyon", "forest", "protected area", "state park", "wilderness", "glacier", "mountain", "national monument",
         "sea", "salt flat", "dune"]


def has_class(classes, words):
    cl = [c.lower() for c in classes]
    return [w for w in words if any(c == w or c.startswith(w + " ") or c.endswith(" " + w) for c in cl)]


# ---------------------------------------------------------------- helpers
def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"^the ", "", s)
    return s


def name_sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a == b or (len(a) > 4 and a in b) or (len(b) > 4 and b in a):
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def pv_key(title):
    return urllib.parse.unquote(title or "").replace(" ", "_")


def score(sitelinks, pv):
    return round(sitelinks * math.log10(1 + (pv or 0)), 2)


def wd(q):
    return f"https://www.wikidata.org/wiki/{q}" if q else ""


def enwiki(t):
    return "https://en.wikipedia.org/wiki/" + urllib.parse.quote(pv_key(t)) if t else ""


COUNTRY_ALIAS = {"china": "CN", "palestinian territories": "PS", "cabo verde": "CV", "hong kong (territory)": "HK",
                 "macau (territory)": "MO", "puerto rico (us territory)": "PR", "micronesia (federated states)": "FM",
                 "gibraltar (uk, territory)": "GI", "vatican city": "VA", "timor-leste": "TL",
                 "republic of the congo": "CG", "democratic republic of the congo": "CD", "côte d'ivoire": "CI",
                 "north korea": "KP", "south korea": "KR", "turkey": "TR", "the bahamas": "BS", "bahamas": "BS"}


def country_iso(v, names):
    if not v:
        return ""
    if len(v) == 2 and v.isupper():
        return v
    k = v.lower()
    if k in COUNTRY_ALIAS:
        return COUNTRY_ALIAS[k]
    if k in names:
        return names[k]
    k2 = re.sub(r"\s*\(.*\)$", "", k)
    return COUNTRY_ALIAS.get(k2) or names.get(k2, v)


# ---------------------------------------------------------------- attractions index
class Attractions:
    def __init__(self, rows, names):
        self.rows = rows
        self.grid = defaultdict(list)
        self.by_qid = defaultdict(list)
        self.by_name = defaultdict(list)
        for r in rows:
            if r.get("lat") is None or r.get("lng") is None:
                continue
            r["cc"] = country_iso(r.get("country"), names)
            self.grid[(int(math.floor(r["lat"] * 100)), int(math.floor(r["lng"] * 100)))].append(r)
            if r.get("qid"):
                self.by_qid[r["qid"]].append(r)
            self.by_name[(norm(r["name"]), r["cc"])].append(r)

    def near(self, lat, lng, max_m):
        gi, gj = int(math.floor(lat * 100)), int(math.floor(lng * 100))
        span = max(1, int(max_m / 1000) + 1)
        out = []
        for di in range(-span, span + 1):
            for dj in range(-span, span + 1):
                for r in self.grid.get((gi + di, gj + dj), []):
                    d = lib.haversine_m(lat, lng, r["lat"], r["lng"])
                    if d <= max_m:
                        out.append((d, r))
        return sorted(out, key=lambda x: x[0])


def dedupe(c, idx):
    """Stage 5 rule: within 150 m of a stampable (is_marquee) attraction, or the same
    normalized name in the same country -> film_line_on_existing. QID equality is
    also accepted as a match. Unstamped attraction rows are recorded as flags only."""
    flags, match, how = [], None, ""
    same_q = [r for r in idx.by_qid.get(c["spot_qid"], [])] if c["spot_qid"] else []
    near = idx.near(c["lat"], c["lng"], 400)
    near150 = [(d, r) for d, r in near if d <= 150]
    named = idx.by_name.get((norm(c["spot_name"]), c["country_code"]), [])
    stamp = lambda r: bool(r.get("is_marquee"))
    for r in same_q:
        if stamp(r):
            match, how = r, "same_qid"
            break
    if not match:
        for d, r in near150:
            if not stamp(r):
                continue
            sim = name_sim(c["spot_name"], r["name"])
            if sim < 0.6 and r.get("qid") and c["spot_qid"] and r["qid"] != c["spot_qid"]:
                # two different Wikidata items with different names: a neighbour, not the
                # same place (Cafe des 2 Moulins is 132 m from the Moulin Rouge)
                flags.append(f"possible_dup:near_stamp_distinct_item({r['name']}|{int(d)}m)")
                continue
            match, how = r, f"within_{int(d)}m"
            if sim < 0.6:
                flags.append(f"possible_dup:name_mismatch({r['name']}|{int(d)}m)")
            break
    if not match:
        for r in named:
            if stamp(r):
                d = lib.haversine_m(c["lat"], c["lng"], r["lat"], r["lng"])
                match, how = r, f"same_name_{int(d)}m"
                if d > 5000:
                    flags.append(f"possible_dup:same_name_far({int(d / 1000)}km)")
                break
    if match:
        c["existing_attraction_id"] = match["id"]
        c["action"] = "film_line_on_existing"
        c["_match"] = f"{how}:{match['name']}"
        fr = match.get("footprint_radius_m")
        if fr and not how.startswith("same_qid"):
            pass
    else:
        c["existing_attraction_id"] = ""
        c["action"] = "new_spot"
        c["_match"] = ""
        # near-misses a reviewer should see
        for d, r in near:
            if stamp(r) and d > 150 and name_sim(c["spot_name"], r["name"]) >= 0.6:
                flags.append(f"possible_dup:near_stamp({r['id']}|{int(d)}m)")
                break
        for d, r in near:
            if stamp(r) and r.get("footprint_radius_m") and d <= r["footprint_radius_m"]:
                flags.append(f"inside_stamp_footprint({r['id']}|{int(d)}m)")
                break
        unst = [r for r in same_q if not stamp(r)] or [r for d, r in near150 if not stamp(r) and
                                                       name_sim(c["spot_name"], r["name"]) >= 0.6]
        if unst:
            flags.append(f"reuses_unstamped_row({unst[0]['id']})")
    return flags


# ---------------------------------------------------------------- build candidates
def build():
    s1 = lib.load("stage1_rows.json")
    labels = lib.load("labels.json")
    L, W = labels["spots"], labels["works"]
    cast = lib.load("cast.json")
    pv = {pv_key(k): v for k, v in lib.load("pageviews.json").items()}
    cur = lib.load("curated_verified.json")
    names = lib.load("country_names.json")
    att = json.load(open(os.path.join(lib.CACHE, "attractions_export.json"), encoding="utf-8"))["rows"]
    wp_ev = lib.load("wikidata_evidence.json") if os.path.exists(os.path.join(lib.DATA, "wikidata_evidence.json")) else {}
    idx = Attractions(att, names)

    cands = {}

    def work_fields(wq, wtype, sitelinks):
        w = W.get(wq, {})
        cst = cast.get(wq, {"cast": [], "flags": ["needs_roles"]})
        cl = cst["cast"] + [{"name": "", "role": ""}] * 2
        return {"work_qid": wq, "work_title": w.get("label", ""), "work_type": wtype, "year": w.get("year") or "",
                "imdb_id": w.get("imdb", ""), "sitelinks": sitelinks,
                "cast1": cl[0]["name"], "role1": cl[0]["role"], "cast2": cl[1]["name"], "role2": cl[1]["role"],
                "_cast_flags": list(cst["flags"])}

    # ---- wikidata rows
    for r in s1:
        s = L.get(r["loc"], {})
        pt = lib.parse_point(r["coord"])
        if not pt:
            continue
        flags = []
        if r["coord_source"] == "qualifier":
            flags.append("coord_from_qualifier")
        spv = pv.get(pv_key(s.get("enwiki")), 0) if s.get("enwiki") else 0
        if r["coord_source"] == "qualifier" and s.get("coarse"):
            flags += ["needs_spot_name", "city_level_suspect"]
            spv = 0  # the item is a city - its pageviews say nothing about the spot
        if r.get("via") == "season_or_episode":
            flags.append("via_season_or_episode")
        c = {"source": "wikidata", "spot_qid": r["loc"], "spot_name": s.get("label") or r["loc"],
             "lat": round(pt[0], 6), "lng": round(pt[1], 6), "city": s.get("city", ""),
             "country_code": s.get("country_code", ""), "spot_class": "; ".join(s.get("classes", [])[:4]),
             "spot_pageviews_12m": spv, "scene": "", "_classes": s.get("classes", []), "_spot": s,
             "_region": "", "_enwiki": s.get("enwiki", ""), "_evidence": []}
        c.update(work_fields(r["work"], r["work_type"], r["sitelinks"]))
        ev = wp_ev.get(f"{r['loc']}|{r['work']}")
        if ev is not None:
            flags.append("wp_mention" if ev else "no_wp_mention")
        c["_flags"] = flags + ["needs_scene"]
        c["source_urls"] = " ".join(u for u in [wd(r["work"]) + "#P915", wd(r["loc"]), enwiki(s.get("enwiki"))] if u)
        key = (c["spot_qid"], c["work_qid"])
        old = cands.get(key)
        # prefer the qualifier (spot-level) coordinate over the item's own
        if old is None or (r["coord_source"] == "qualifier" and "coord_from_qualifier" not in old["_flags"]):
            cands[key] = c

    # ---- curated rows
    for r in cur:
        if r["status"] != "verified":
            continue
        sq = r["spot"]["qid"]
        s = L.get(sq, {})
        sc = None
        for k in ((sq, r["work_article"]), (r["spot_article"], r["work_article"])):
            if k in SCENES:
                sc = SCENES[k]
                break
        flags = list(r.get("flags", []))
        scene = ""
        if isinstance(sc, tuple):
            scene, extra = sc[0], sc[1]
            flags.append(extra)
        elif sc:
            scene = sc
        else:
            flags.append("needs_scene")
        # pageviews: the spot item's own enwiki article, else the verified article (proxy)
        own = s.get("enwiki", "")
        if own:
            spv = pv.get(pv_key(own), 0)
        else:
            spv = pv.get(pv_key(r["spot"].get("title", "")), 0)
            if r["spot"].get("title"):
                flags.append(f"pageviews_proxy({r['spot']['title']})")
        if s.get("multi_country"):
            flags.append("multi_country")
        wq = r["work"]["qid"]
        cc = r.get("country_code") or s.get("country_code", "")
        if r.get("cc_override"):
            cc = r["cc_override"]
        elif s.get("country_code"):
            cc = s["country_code"]  # HK/MO special-administrative-region codes win
        c = {"source": "curated", "spot_qid": sq, "spot_name": r["spot_label"],
             "lat": round(r["lat"], 6), "lng": round(r["lng"], 6), "city": s.get("city", ""),
             "country_code": cc, "spot_class": r["spot_class"], "spot_pageviews_12m": spv, "scene": scene,
             "_classes": [r["spot_class"]], "_spot": s, "_region": r["region"], "_enwiki": own,
             "_evidence": r["evidence"]}
        wtype = r.get("work_type") or "film"
        c.update(work_fields(wq, wtype, r.get("sitelinks") or 0))
        if r.get("coord_from") == "wikipedia_geodata":
            flags.append("coord_from_wikipedia_geodata")
        c["_flags"] = flags
        urls = [wd(sq)] + sorted({e["source_url"] for e in r["evidence"]})
        c["source_urls"] = " ".join(u for u in urls if u)
        key = (sq, wq)
        if key in cands and cands[key]["source"] == "wikidata":
            c["_flags"].append("also_in_wikidata")
        cands[key] = c
    return list(cands.values()), idx


def finish(cands, idx):
    for c in cands:
        f = c["_flags"] + [x for x in c.pop("_cast_flags", [])
                           if not (x.startswith("large_cast") and c["work_type"] != "tv")]  # films bill fine
        cl = c["_classes"]
        s = c["_spot"]
        if c["source"] == "curated":
            c["radius_m"] = CURATED_RADIUS[c["spot_class"]]
            c["radius_rule"] = CURATED_RULE[c["radius_m"]] + f" (curated class {c['spot_class']})"
        else:
            c["radius_m"], c["radius_rule"] = radius_for(cl)
            bad = has_class(cl, NOT_A_SPOT)
            if bad and not has_class(cl, VISITOR):
                f.append("not_a_spot(" + bad[0] + ")")
            st = has_class(cl, STUDIO)
            if st and not has_class(cl, VISITOR):
                f.append("studio_backlot(" + st[0] + ")")
            ci = has_class(cl, CITYISH)
            if ci and "city_level_suspect" not in f:
                f.append("city_level_suspect")
            if has_class(cl, LARGE) and "large_area_centroid" not in f:
                f.append("large_area_centroid")
            if not cl:
                f.append("no_class")
            if not has_class(cl, VISITOR) and re.search(r"\bstudios?\b", c["spot_name"], re.I) \
                    and not any(x.startswith("studio_backlot") for x in f):
                f.append("studio_backlot(name)")
            area = s.get("area_m2")
            if area and area / 1e6 > MAX_AREA_KM2:
                f.append(f"area_too_large({int(area / 1e6)}km2)")
            gone = s.get("gone", "")
            if gone and (not gone.isdigit() or int(gone) >= 1950):
                f.append(f"demolished_or_closed({gone if gone.isdigit() else 'date unknown'})")
        for b in s.get("ban", []):
            if b in ("prison", "hospital", "power station"):
                if c["source"] == "curated" or has_class(cl, VISITOR):
                    f.append(f"review_class({b})")
                else:  # a working prison / hospital / power station is not a place to visit
                    f.append(f"not_a_spot({b}, no visitor class)")
            else:
                f.append(f"class_ban({b})")
        if not c["city"]:
            f.append("no_city")
        if not c["country_code"]:
            f.append("no_country")
        c["score"] = score(int(c["sitelinks"] or 0), c["spot_pageviews_12m"])
        f += dedupe(c, idx)
        if c["action"] == "film_line_on_existing":
            # the stamp already exists; size/closure of the Wikidata item doesn't matter
            f = [x for x in f if not x.startswith(("area_too_large", "demolished_or_closed"))]
        seen, out = set(), []
        for x in f:
            if x and x not in seen:
                seen.add(x)
                out.append(x)
        c["_flags"] = out
        c["flags"] = ";".join(out)
    return cands


EXCLUDE = ("not_a_spot", "studio_backlot", "class_ban", "needs_spot_name", "no_country", "area_too_large",
           "demolished_or_closed")


def eligible(c):
    return not any(x.startswith(EXCLUDE) for x in c["_flags"]) and c["score"] > 0


def title_year(c):
    return f"{c['work_title']} ({c['year']})" if c["year"] else c["work_title"]


def group_spots(cands):
    """One row per spot: same QID, or distinct items < 60 m apart with matching names."""
    by = defaultdict(list)
    for c in cands:
        by[c["spot_qid"] or f"{c['lat']},{c['lng']}"].append(c)
    keys = list(by)
    # merge near-identical items (e.g. hotel item vs its tower item)
    parent = {k: k for k in keys}

    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k
    pts = [(k, by[k][0]) for k in keys]
    grid = defaultdict(list)
    for k, c in pts:
        grid[(int(c["lat"] * 200), int(c["lng"] * 200))].append((k, c))
    for (gi, gj), items in list(grid.items()):
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for k2, c2 in grid.get((gi + di, gj + dj), []):
                    for k1, c1 in items:
                        if k1 >= k2:
                            continue
                        d = lib.haversine_m(c1["lat"], c1["lng"], c2["lat"], c2["lng"])
                        if d < 60 and name_sim(c1["spot_name"], c2["spot_name"]) >= 0.6:
                            parent[find(k1)] = find(k2)
    groups = defaultdict(list)
    for k in keys:
        groups[find(k)] += by[k]
    return list(groups.values())


def pick_primary(group):
    # most famous work first (sitelinks); a statement on the work itself beats one found
    # only on a season/episode item (Doctor Who's episodes would otherwise claim Central
    # Park); a curated row wins ties (it has a sourced scene)
    ok = [c for c in group if eligible(c)] or group
    ok.sort(key=lambda c: ("via_season_or_episode" in c["_flags"], -int(c["sitelinks"] or 0),
                           c["source"] != "curated", -c["score"]))
    p = dict(ok[0])
    others = sorted({title_year(c) for c in group if (c["work_qid"], c["spot_qid"]) != (p["work_qid"], p["spot_qid"])
                     and c["work_qid"] != p["work_qid"]})
    p["also_in"] = "; ".join(others)
    p["_group"] = group
    p["_eligible"] = eligible(p)
    # a curated row in the group counts for the non-Western quota
    reg = [c["_region"] for c in group if c["source"] == "curated"]
    p["_curated_nonwest"] = p["source"] == "curated" and p["_region"] in NONWEST
    if p["source"] != "curated" and any(r in NONWEST for r in reg):
        p["_flags"] = p["_flags"] + ["curated_row_in_group"]
        p["flags"] = ";".join(p["_flags"])
    return p


REQUIRE_WP_MENTION = True  # tier 1 = Wikipedia text backs the pairing (all curated rows do)


def backed(s):
    return s["source"] == "curated" or "wp_mention" in s["_flags"]


def select_seed(spots):
    pool = sorted([s for s in spots if s["_eligible"]], key=lambda s: -s["score"])
    if REQUIRE_WP_MENTION:  # backed rows by score, then (only if short) the rest by score
        pool = [s for s in pool if backed(s)] + [s for s in pool if not backed(s)]
    chosen = pool[:SEED_N]
    rest = pool[SEED_N:]
    is_usuk = lambda s: s["country_code"] in ("US", "GB")

    def swap(need, pick_pred, drop_pred):
        nonlocal chosen, rest
        while need(chosen):
            add = next((s for s in rest if pick_pred(s)), None)
            drop = next((s for s in reversed(chosen) if drop_pred(s)), None)
            if not add or not drop:
                return False
            chosen.remove(drop)
            rest.remove(add)
            chosen.append(add)
            rest.append(drop)
            rest.sort(key=lambda s: (REQUIRE_WP_MENTION and not backed(s), -s["score"]))
            chosen.sort(key=lambda s: (REQUIRE_WP_MENTION and not backed(s), -s["score"]))
        return True
    ok1 = swap(lambda ch: sum(s["_curated_nonwest"] for s in ch) < MIN_CURATED_NONWEST,
               lambda s: s["_curated_nonwest"], lambda s: not s["_curated_nonwest"] and is_usuk(s))
    ok2 = swap(lambda ch: sum(not is_usuk(s) for s in ch) < MIN_NON_USUK,
               lambda s: not is_usuk(s), lambda s: is_usuk(s))
    chosen.sort(key=lambda s: -s["score"])
    return chosen, ok1 and ok2


def proximity_flags(chosen):
    for i, a in enumerate(chosen):
        for b in chosen[i + 1:]:
            d = lib.haversine_m(a["lat"], a["lng"], b["lat"], b["lng"])
            if d < 150:
                for x, y in ((a, b), (b, a)):
                    x["_flags"] = x["_flags"] + [f"possible_dup:seed_neighbour({y['spot_name']}|{int(d)}m)"]
                    x["flags"] = ";".join(x["_flags"])


REVIEW_WEIGHTS = [  # (flag prefix, weight, plain-language reason)
    ("possible_dup", 5, "uncertain dedupe"),
    ("needs_roles", 4, "fewer than two cast members with a role on Wikidata"),
    ("lead_without_role", 2, "top-billed cast member has no role qualifier"),
    ("cast_skips_unroled", 2, "a higher-billed actor with no role was skipped"),
    ("large_cast", 3, "very large cast - pick the two leads by hand"),
    ("city_level_suspect", 4, "may be a town/area rather than a spot"),
    ("large_area_centroid", 2, "large area - coordinate is a centroid"),
    ("coord_is_island_not_grotto", 3, "coordinate is the island, not the grotto"),
    ("coord_from_qualifier", 2, "coordinate comes from a P915 qualifier"),
    ("evidence_weak", 4, "source wording is weak (inspired/used backgrounds)"),
    ("pageviews_proxy", 1, "pageviews taken from a parent article"),
    ("review_class", 3, "prison/hospital/power-station class"),
    ("animated_depiction", 2, "animated work - depicted, not filmed"),
    ("work_qid_is_manga", 3, "work item is the manga, not the anime series"),
    ("scene_generic", 1, "scene line is generic"),
    ("inside_stamp_footprint", 3, "inside an existing stamp's footprint"),
    ("reuses_unstamped_row", 1, "an unstamped attraction row already exists"),
    ("no_city", 2, "no city resolved"),
    ("multi_country", 1, "item has several countries"),
    ("no_class", 2, "Wikidata item has no class"),
]


REVIEW_QUOTA = [  # (category, rows) - the 40 are spread across kinds of doubt, then topped up by weight
    ("dedupe", 12), ("roles", 10), ("city", 8), ("evidence", 5), ("low", 5)]
CATEGORY = {"possible_dup": "dedupe", "inside_stamp_footprint": "dedupe", "needs_roles": "roles",
            "cast_skips_unroled": "roles", "large_cast": "roles",
            "city_level_suspect": "city", "large_area_centroid": "city",
            "coord_is_island_not_grotto": "city", "evidence_weak": "evidence", "animated_depiction": "evidence",
            "work_qid_is_manga": "evidence", "review_class": "evidence"}


def review(chosen, n=40):
    lo = sorted(s["score"] for s in chosen)[len(chosen) // 10]  # bottom decile
    per_work = defaultdict(int)
    for s in chosen:
        if "needs_roles" in s["_flags"]:
            per_work[s["work_qid"]] += 1
    rows = []
    for s in chosen:
        w, why, cats = 0, [], set()
        for pre, wt, reason in REVIEW_WEIGHTS:
            hit = [x for x in s["_flags"] if x.startswith(pre)]
            if not hit:
                continue
            w += wt
            if pre in CATEGORY:
                cats.add(CATEGORY[pre])
            m = re.search(r"\((.*)\)$", hit[0])
            detail = m.group(1) if m and pre in ("possible_dup", "inside_stamp_footprint", "review_class",
                                                 "pageviews_proxy") else ""
            if pre == "needs_roles" and per_work[s["work_qid"]] > 1:
                detail = f"same work in {per_work[s['work_qid']] - 1} other seed rows"
            why.append(reason + (f" [{hit[0].split(':')[1].split('(')[0]}: {detail}]" if pre == "possible_dup"
                                 else f" [{detail}]" if detail else ""))
        if s["action"] == "film_line_on_existing" and not s["_match"].startswith("same_qid"):
            w += 2
            cats.add("dedupe")
            why.append(f"linked to existing stamp by {s['_match'].split(':')[0]} ('{s['_match'].split(':', 1)[1]}')")
        if s["score"] <= lo:
            w += 2
            cats.add("low")
            why.append(f"low score ({s['score']})")
        if w:
            rows.append({"w": w, "s": s, "why": "; ".join(why), "cats": cats})
    rows.sort(key=lambda r: (-r["w"], -r["s"]["score"]))
    picked, seen_works = [], set()
    for cat, k in REVIEW_QUOTA:
        got = 0
        # roles / city: the most visible (highest-ranked) rows first; others by weight
        pool = sorted(rows, key=lambda r: -r["s"]["score"]) if cat in ("roles", "city") else rows
        for r in pool:
            if got >= k:
                break
            if r in picked or cat not in r["cats"]:
                continue
            if cat == "roles":  # one row per work: fixing the work fixes all its rows
                if r["s"]["work_qid"] in seen_works:
                    continue
                seen_works.add(r["s"]["work_qid"])
            picked.append(r)
            got += 1
    for r in rows:
        if len(picked) >= n:
            break
        if r not in picked:
            picked.append(r)
    return [(r["w"], r["s"], r["why"]) for r in picked[:n]]


CAND_COLS = ["source", "spot_qid", "spot_name", "lat", "lng", "city", "country_code", "spot_class", "work_qid",
             "work_title", "work_type", "year", "imdb_id", "sitelinks", "spot_pageviews_12m", "score", "cast1",
             "role1", "cast2", "role2", "scene", "radius_m", "radius_rule", "existing_attraction_id", "action",
             "flags", "source_urls"]


def write(name, rows, cols):
    with open(os.path.join(HERE, name), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def run():
    cands, idx = build()
    cands = finish(cands, idx)
    cands.sort(key=lambda c: (-c["score"], c["spot_name"]))
    write("candidates.csv", cands, CAND_COLS)
    spots = [pick_primary(g) for g in group_spots(cands)]
    chosen, quotas_ok = select_seed(spots)
    proximity_flags(chosen)
    for i, s in enumerate(chosen, 1):
        s["rank"] = i
    write("seed_400.csv", chosen, ["rank"] + CAND_COLS[:21] + ["also_in"] + CAND_COLS[21:])
    rv = review(chosen)
    rrows = []
    for w, s, why in rv:
        d = dict(s)
        d["why"] = why
        d["review_weight"] = w
        rrows.append(d)
    write("review_40.csv", rrows, ["rank", "review_weight", "why"] + CAND_COLS[:21] + ["also_in"] + CAND_COLS[21:])
    stats = {
        "candidates": len(cands),
        "candidates_wikidata": sum(c["source"] == "wikidata" for c in cands),
        "candidates_curated": sum(c["source"] == "curated" for c in cands),
        "spots_total": len(spots),
        "spots_eligible": sum(s["_eligible"] for s in spots),
        "seed": len(chosen),
        "seed_wikidata": sum(s["source"] == "wikidata" for s in chosen),
        "seed_curated": sum(s["source"] == "curated" for s in chosen),
        "seed_curated_nonwest": sum(s["_curated_nonwest"] for s in chosen),
        "seed_non_us_uk": sum(s["country_code"] not in ("US", "GB") for s in chosen),
        "seed_needs_roles": sum("needs_roles" in s["_flags"] for s in chosen),
        "seed_film_line_on_existing": sum(s["action"] == "film_line_on_existing" for s in chosen),
        "seed_tv": sum(s["work_type"] == "tv" for s in chosen),
        "quotas_met": quotas_ok,
        "spots_eligible_backed": sum(s["_eligible"] and backed(s) for s in spots),
        "seed_backed": sum(backed(s) for s in chosen),
    }
    from collections import Counter
    stats["seed_countries_top10"] = Counter(s["country_code"] for s in chosen).most_common(10)
    stats["excluded_reasons"] = Counter(x.split("(")[0] for s in spots if not s["_eligible"]
                                        for x in s["_flags"] if x.startswith(EXCLUDE)).most_common()
    lib.save("build_stats.json", stats)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    run()

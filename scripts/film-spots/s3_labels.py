"""Stage 3 - English labels for spots and works, the spot's city (first
city/town up its P131 chain) and country (P17 -> ISO 3166-1 alpha-2, P297).

Input : data/stage1_rows.json, data/curated_verified.json
Output: data/labels.json  {"spots": {qid: {...}}, "works": {qid: {...}}}
"""
import re
import lib

CITY_CLASSES = ("wd:Q515 wd:Q3957 wd:Q7930989 wd:Q1549591 wd:Q5119 wd:Q532 wd:Q15284 "
                "wd:Q1637706 wd:Q200250")
# A spot inside one of these is shown under the metro name, not the borough/ward.
METRO = {"Q23306": "London", "Q84": "London", "Q60": "New York City", "Q90": "Paris",
         "Q1490": "Tokyo", "Q8646": "Hong Kong", "Q14773": "Macau", "Q1353": "Delhi",
         "Q1156": "Mumbai", "Q220": "Rome", "Q64": "Berlin", "Q1741": "Vienna"}
# Special administrative regions get their own ISO code.
CC_OVERRIDE = {"Q8646": "HK", "Q14773": "MO"}


def vals(qs):
    return " ".join("wd:" + q for q in qs)


def spot_basics(qids):
    out = {}
    for batch in lib.chunks(qids, 80):
        rows = lib.sparql(f"""
SELECT ?item ?itemLabel ?enwiki ?country ?cc WHERE {{
  VALUES ?item {{ {vals(batch)} }}
  OPTIONAL {{ ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }}
  OPTIONAL {{ ?item wdt:P17 ?country . OPTIONAL {{ ?country wdt:P297 ?cc }} }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,mul". }}
}}""")
        for r in rows:
            q = lib.qid(r["item"])
            d = out.setdefault(q, {"label": r.get("itemLabel", ""), "enwiki": "", "countries": []})
            if r.get("enwiki"):
                d["enwiki"] = r["enwiki"].split("/wiki/", 1)[1]
            if r.get("country"):
                c = (lib.qid(r["country"]), r.get("cc", ""))
                if c not in d["countries"]:
                    d["countries"].append(c)
        rows = lib.sparql(f"""
SELECT ?item ?clsLabel WHERE {{
  VALUES ?item {{ {vals(batch)} }}
  ?item wdt:P31 ?cls .
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,mul". }}
}}""")
        for r in rows:
            out.setdefault(lib.qid(r["item"]), {"label": "", "enwiki": "", "countries": []}) \
               .setdefault("classes", []).append(r.get("clsLabel", ""))
    return out


def parents(qids, cache):
    todo = [q for q in qids if q not in cache]
    for batch in lib.chunks(todo, 40):
        rows = lib.sparql(f"""
SELECT ?item ?parent ?parentLabel ?isCity ?cc WHERE {{
  VALUES ?item {{ {vals(batch)} }}
  ?item wdt:P131 ?parent .
  BIND(EXISTS {{ VALUES ?c {{ {CITY_CLASSES} }} ?parent wdt:P31/wdt:P279* ?c . }} AS ?isCity)
  OPTIONAL {{ ?parent wdt:P17/wdt:P297 ?cc }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,mul". }}
}}""")
        for q in batch:
            cache.setdefault(q, [])
        for r in rows:
            p = {"qid": lib.qid(r["parent"]), "label": r.get("parentLabel", ""),
                 "is_city": r.get("isCity") == "true", "cc": r.get("cc", "")}
            if p not in cache[lib.qid(r["item"])]:
                cache[lib.qid(r["item"])].append(p)
    return cache


def pick_parent(ps):
    if not ps:
        return None
    cities = [p for p in ps if p["is_city"]]
    pool = cities or ps
    return sorted(pool, key=lambda p: int(p["qid"][1:]))[0]


def resolve_city(qids, is_city_self):
    """Climb P131 up to 8 levels; returns {qid: (city, chain_qids, parent_cc, how)}."""
    cache = {}
    chains = {q: [] for q in qids}
    frontier = {q: q for q in qids}
    for level in range(8):
        live = {q: cur for q, cur in frontier.items() if cur}
        if not live:
            break
        parents(sorted(set(live.values())), cache)
        for q, cur in live.items():
            p = pick_parent(cache.get(cur, []))
            if not p or p["qid"] in [c["qid"] for c in chains[q]]:
                frontier[q] = None
                continue
            chains[q].append(p)
            frontier[q] = p["qid"]
            if p["qid"] in METRO or (p["is_city"] and level >= 0):
                # keep climbing one more level only to spot a METRO wrapper
                pass
    out = {}
    for q in qids:
        ch = chains[q]
        metro = next((c for c in ch if c["qid"] in METRO), None)
        city = next((c for c in ch if c["is_city"]), None)
        cc_parent = next((c["cc"] for c in ch if c["cc"]), "")
        sar = next((CC_OVERRIDE[c["qid"]] for c in ch if c["qid"] in CC_OVERRIDE), "")
        if metro:
            out[q] = (METRO[metro["qid"]], "metro", cc_parent, sar)
        elif city:
            out[q] = (city["label"], "p131_city", cc_parent, sar)
        elif ch:
            out[q] = (ch[0]["label"], "p131_first_admin", cc_parent, sar)
        else:
            out[q] = ("", "none", "", sar)
    return out


# Classes from the stamp bar (scripts/attractions-seed/score-fame.mjs), checked
# through the P279 closure. s8 excludes the hard bans (airports have their own
# stamps) and only flags prison / hospital / power station, because heritage
# ones are real destinations (Alcatraz, Kilmainham Gaol, Battersea).
BAN = {"Q1248784": "airport", "Q46622": "controlled-access highway",
       "Q7540126": "corporate headquarters", "Q245016": "military base",
       "Q40357": "prison", "Q16917": "hospital", "Q159719": "power station"}


def banned(qids):
    out = {}
    for batch in lib.chunks(qids, 60):
        rows = lib.sparql(f"""
SELECT DISTINCT ?item ?ban WHERE {{
  VALUES ?item {{ {vals(batch)} }}
  VALUES ?ban {{ {vals(BAN)} }}
  ?item wdt:P31/wdt:P279* ?ban .
}}""")
        for r in rows:
            out.setdefault(lib.qid(r["item"]), []).append(BAN[lib.qid(r["ban"])])
    return out


COARSE = ("wd:Q515 wd:Q6256 wd:Q3957 wd:Q532 wd:Q7930989 wd:Q10864048 wd:Q56061 "
          "wd:Q486972 wd:Q1549591 wd:Q5119 wd:Q35657 wd:Q107390")


def coarse(qids):
    """Spots that are themselves city/country-level (same class list as stage 1)."""
    out = set()
    for batch in lib.chunks(qids, 60):
        rows = lib.sparql(f"""
SELECT DISTINCT ?item WHERE {{
  VALUES ?item {{ {vals(batch)} }}
  VALUES ?coarse {{ {COARSE} }}
  ?item wdt:P31/wdt:P279* ?coarse .
}}""")
        out |= {lib.qid(r["item"]) for r in rows}
    return out


def size_and_state(qids):
    """Area (P2046, normalised to m2) and dissolved/demolished date (P576)."""
    out = {}
    for batch in lib.chunks(qids, 80):
        rows = lib.sparql(f"""
SELECT ?item (MAX(?a) AS ?area) (MIN(?d) AS ?gone) WHERE {{
  VALUES ?item {{ {vals(batch)} }}
  OPTIONAL {{ ?item p:P2046/psn:P2046/wikibase:quantityAmount ?a . }}
  OPTIONAL {{ ?item wdt:P576 ?d . }}
}} GROUP BY ?item""")
        for r in rows:
            out[lib.qid(r["item"])] = {"area_m2": float(r["area"]) if r.get("area") else None,
                                       "gone": r.get("gone", "")[:4]}
    return out


def work_meta(qids):
    out = {}
    for batch in lib.chunks(qids, 80):
        rows = lib.sparql(f"""
SELECT ?work ?workLabel ?enwiki ?imdb ?date ?start ?cls WHERE {{
  VALUES ?work {{ {vals(batch)} }}
  OPTIONAL {{ ?enwiki schema:about ?work ; schema:isPartOf <https://en.wikipedia.org/> . }}
  OPTIONAL {{ ?work wdt:P345 ?imdb }}
  OPTIONAL {{ ?work wdt:P577 ?date }}
  OPTIONAL {{ ?work wdt:P580 ?start }}
  OPTIONAL {{ ?work wdt:P31 ?cls }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,mul". }}
}}""")
        for r in rows:
            q = lib.qid(r["work"])
            d = out.setdefault(q, {"label": r.get("workLabel", ""), "enwiki": "", "imdb": "", "years": [],
                                   "start": [], "classes": []})
            if r.get("enwiki"):
                d["enwiki"] = r["enwiki"].split("/wiki/", 1)[1]
            if r.get("imdb") and not d["imdb"]:
                d["imdb"] = r["imdb"]
            for k, key in (("date", "years"), ("start", "start")):
                if r.get(k) and re.match(r"^\d{4}", r[k]):
                    y = int(r[k][:4])
                    if y not in d[key]:
                        d[key].append(y)
            if r.get("cls") and lib.qid(r["cls"]) not in d["classes"]:
                d["classes"].append(lib.qid(r["cls"]))
    for q, d in out.items():
        m = re.search(r"\((\d{4})_(?:[A-Za-z]+_)?(?:film|TV_series|miniseries)\)", d["enwiki"])
        if m:
            d["year"] = int(m.group(1))
        elif d["years"] or d["start"]:
            d["year"] = min(d["years"] or d["start"])
        else:
            d["year"] = None
    return out


def run():
    s1 = lib.load("stage1_rows.json")
    cur = [r for r in lib.load("curated_verified.json") if r["status"] == "verified"]
    spot_q = sorted({r["loc"] for r in s1} | {r["spot"]["qid"] for r in cur if r["spot"]["qid"]})
    work_q = sorted({r["work"] for r in s1} | {r["work"]["qid"] for r in cur if r["work"]["qid"]})
    print("spots", len(spot_q), "works", len(work_q), flush=True)
    basics = spot_basics(spot_q)
    cities = resolve_city(spot_q, None)
    spots = {}
    for q in spot_q:
        b = basics.get(q, {"label": "", "enwiki": "", "countries": []})
        city, how, cc_parent, sar = cities[q]
        ccs = [c[1] for c in b["countries"] if c[1]]
        if sar:
            cc = sar
        elif len(ccs) == 1:
            cc = ccs[0]
        elif cc_parent and cc_parent in ccs:
            cc = cc_parent
        elif ccs:
            cc = sorted(ccs)[0]
        else:
            cc = cc_parent
        spots[q] = {"label": b["label"], "enwiki": b["enwiki"], "classes": b.get("classes", []),
                    "city": city, "city_how": how, "country_code": cc,
                    "multi_country": len(set(ccs)) > 1}
    bans = banned(spot_q)
    for q, b in bans.items():
        spots[q]["ban"] = sorted(set(b))
    for q, v in size_and_state(spot_q).items():
        spots[q].update(v)
    for q in coarse(spot_q):
        spots[q]["coarse"] = True
    works = work_meta(work_q)
    lib.save("labels.json", {"spots": spots, "works": works})
    print("no city:", sum(1 for s in spots.values() if not s["city"]),
          "no country:", sum(1 for s in spots.values() if not s["country_code"]))


if __name__ == "__main__":
    run()

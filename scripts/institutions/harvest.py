#!/usr/bin/env python3
"""Local food institutions — restaurants, cafés, bakeries, pubs, bars, breweries
and beer halls that have a Wikipedia article (fix 5 of the worldwide search
work, founder 2026-10-07: famous places like Mary Mac's or the Hofbräuhaus
were missing from "best southern food in Atlanta" / "beer in Germany").

Re-runnable, Python 3.9 stdlib only:

    python3 scripts/institutions/harvest.py          # uses cached responses
    python3 scripts/institutions/harvest.py --fresh  # refetch Wikidata + Wikipedia

Writes scripts/institutions/data/institutions.json (review copy) and
scripts/institutions/data/load_institutions.sql (D1, globeskimmers-attractions):

    npx wrangler d1 execute globeskimmers-attractions --remote \
      --file=scripts/institutions/data/load_institutions.sql

Wikidata is CC0. Wikipedia intro sentences are used ONLY as match keywords
(never shown), so no CC BY-SA text is redistributed. Whether a place is still
open is NOT trusted from here: the worker confirms each one with Google
(businessStatus) before showing it.
"""
import hashlib
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
CACHE = os.path.join(HERE, ".cache")
os.makedirs(DATA, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)
UA = "GlobeSkimmersSeed/1.0 (founder@globeskimmers.io) institutions harvest; python-urllib"
FRESH = "--fresh" in sys.argv

QLEVER = "https://qlever.dev/api/wikidata"
PREFIX = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""
# restaurant, café, bakery, pub, bar, brewery, beer hall, confectionery store
ROOTS = "wd:Q11707 wd:Q30022 wd:Q274393 wd:Q212198 wd:Q187456 wd:Q131734 wd:Q858012 wd:Q3574069"
NAME_LANGS = '"en","mul","de","fr","it","es","pt","ja","zh","ko","nl","th","tr","pl","cs","sv","da","el","vi","id","tl","ar","he","ru","hu"'
QUERY = PREFIX + """
SELECT ?item (SAMPLE(?coord) AS ?c) (SAMPLE(?sl) AS ?sitelinks) (SAMPLE(?lab) AS ?label)
  (SAMPLE(?desc) AS ?description) (SAMPLE(?enTitle) AS ?enwiki) (SAMPLE(?iso) AS ?cc)
  (GROUP_CONCAT(DISTINCT ?clsLab; separator="|") AS ?kinds)
  (GROUP_CONCAT(DISTINCT ?cuisLab; separator="|") AS ?cuisines)
  (SAMPLE(?inc) AS ?inception) (COUNT(DISTINCT ?wpArt) AS ?wps)
WHERE {
  VALUES ?root { %s }
  ?cls wdt:P279* ?root .
  ?item wdt:P31 ?cls ; wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  ?wpArt schema:about ?item ; schema:isPartOf ?wp . FILTER(CONTAINS(STR(?wp), "wikipedia.org"))
  MINUS { ?item wdt:P576 ?d }
  MINUS { ?item wdt:P3999 ?d2 }
  OPTIONAL { ?item rdfs:label ?lab FILTER(LANG(?lab) = "en") }
  OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?enArt schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enTitle }
  OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P297 ?iso }
  OPTIONAL { ?item wdt:P31 ?k . ?k rdfs:label ?clsLab FILTER(LANG(?clsLab) = "en") }
  OPTIONAL { ?item wdt:P2012 ?cu . ?cu rdfs:label ?cuisLab FILTER(LANG(?cuisLab) = "en") }
  OPTIONAL { ?item wdt:P571 ?inc }
} GROUP BY ?item
""" % ROOTS
LANGS = [x.strip('"') for x in NAME_LANGS.split(",")]


def local_names(qids):
    """Labels in the languages Google may show (a SPARQL join with them timed out)."""
    out = {}
    for i in range(0, len(qids), 50):
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({
            "action": "wbgetentities", "ids": "|".join(qids[i:i + 50]), "props": "labels",
            "languages": "|".join(LANGS), "format": "json"})
        for qid, e in (http_json(url, min_gap=0.2).get("entities") or {}).items():
            out[qid] = list(dict.fromkeys(l["value"] for l in (e.get("labels") or {}).values()))
        if i and i % 2000 == 0:
            print(f"  names {i}/{len(qids)}", flush=True)
    return out

# Wikidata classes under those roots that are history, not places to eat today.
DROP_KINDS = re.compile(
    r"\b(station of the|shukuba|postal station|stage station|mevlevihane|wardroom|society house|"
    r"university cafeteria|school cafeteria|cafeteria|bed and breakfast|former|canteen|mess|"
    r"military|prison|hospital|chain\b)", re.I)
DROP_DESC = re.compile(
    r"\b(former|defunct|closed|demolished|now (?:used as|a|an|houses|home)|apartments|historic building|"
    r"listed building|ruin|museum|archaeological|archeological)\b", re.I)


def http_json(url, data=None, accept="application/json", min_gap=0.25):
    key = url + ("|" + data if data else "")
    cp = os.path.join(CACHE, hashlib.sha1(key.encode()).hexdigest() + ".json")
    if os.path.exists(cp) and not FRESH:
        with open(cp, encoding="utf-8") as f:
            return json.load(f)
    delay = 5
    for attempt in range(7):
        time.sleep(min_gap)
        req = urllib.request.Request(url, data=data.encode() if data else None,
                                     headers={"User-Agent": UA, "Accept": accept})
        if data:
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                out = json.loads(r.read().decode("utf-8"))
            with open(cp, "w", encoding="utf-8") as f:
                json.dump(out, f)
            return out
        except Exception as e:  # noqa: BLE001 — network errors and 429/5xx all back off
            print(f"  {type(e).__name__} {e}; retry in {delay}s", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 120)
    raise RuntimeError(f"gave up on {url}")


def wikidata_rows():
    out = http_json(QLEVER, urllib.parse.urlencode({"query": QUERY}), accept="application/sparql-results+json")
    names = local_names([b["item"]["value"].rsplit("/", 1)[-1] for b in out["results"]["bindings"]])
    rows = []
    for b in out["results"]["bindings"]:
        v = {k: x["value"] for k, x in b.items()}
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", v.get("c", ""), re.I)
        if not m:
            continue
        rows.append({
            "qid": v["item"].rsplit("/", 1)[-1],
            "lng": round(float(m.group(1)), 6), "lat": round(float(m.group(2)), 6),
            "sitelinks": int(v.get("sitelinks", 0)), "wps": int(v.get("wps", 0)),
            "label": v.get("label", ""), "description": v.get("description", ""),
            "enwiki": v.get("enwiki", ""), "cc": v.get("cc", ""),
            "kinds": [k for k in v.get("kinds", "").split("|") if k],
            "cuisines": [k for k in v.get("cuisines", "").split("|") if k],
            "names": names.get(v["item"].rsplit("/", 1)[-1], []),
            "since": int(v["inception"][:4]) if re.match(r"^\d{4}", v.get("inception", "")) else None,
        })
    return rows


def enwiki_intros(titles):
    """First two sentences of each English article — match keywords only."""
    out = {}
    titles = sorted(set(t for t in titles if t))
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1, "exsentences": 2,
            "exlimit": 20, "redirects": 1, "format": "json", "titles": "|".join(chunk)})
        d = http_json(url, min_gap=0.1)
        q = d.get("query", {})
        back = {}
        for r in q.get("normalized", []) + q.get("redirects", []):
            back[r["to"]] = back.get(r["from"], r["from"])
        for p in q.get("pages", {}).values():
            t = p.get("title", "")
            out[back.get(t, t)] = (p.get("extract") or "").strip()
        if i and i % 1000 == 0:
            print(f"  intros {i}/{len(titles)}", flush=True)
    return out


# One coarse bucket per place, used to pick what a search may show.
BUCKETS = [
    ("beer_hall", r"beer hall|beer garden|biergarten|bierkeller|brewpub"),
    ("brewery", r"brewery"),
    ("pub", r"\bpub\b|public house|tavern|inn\b|gasthaus|estaminet|izakaya"),
    ("bar", r"\bbar\b|cocktail|wine bar|speakeasy|lounge|nightclub"),
    ("ice_cream", r"ice cream|gelat"),
    ("bakery", r"bakery|patisserie|pâtisserie|pastry|confectioner|boulangerie|konditorei"),
    ("cafe", r"café|cafe|coffee|tea ?house|teahouse|tea room|kaffeehaus"),
]


def bucket(r):
    """Every bucket the place's Wikidata types fit, "|"-joined: Botín is a
    restaurant AND a bar, Café de Flore a café AND a restaurant."""
    text = " ".join(r["kinds"]).lower()
    out = [name for name, rx in BUCKETS if re.search(rx, text)]
    if re.search(r"restaurant|diner|bistro|brasserie|trattoria|osteria|steakhouse|pizzeria|deli|eatery|food", text) or not out:
        out.append("restaurant")
    return "|".join(dict.fromkeys(out))


def main():
    rows = wikidata_rows()
    print(f"wikidata: {len(rows)} places with a Wikipedia article", flush=True)
    kept = [r for r in rows if not any(DROP_KINDS.search(k) for k in r["kinds"]) and not DROP_DESC.search(r["description"])]
    print(f"after dropping history-only kinds/descriptions: {len(kept)}", flush=True)
    intros = enwiki_intros([r["enwiki"] for r in kept])
    for r in kept:
        intro = intros.get(r["enwiki"], "")
        if intro and DROP_DESC.search(intro.split(".")[0]) and re.search(r"\b(was|were)\b", intro.split(".")[0]):
            r["drop"] = True  # "X was a restaurant…" — Wikipedia already speaks of it in the past
        names = [r["label"]] + r["names"]
        r["name"] = next((n for n in names if n), r["qid"])
        r["names"] = sorted(set(n for n in names if n), key=names.index)[:8]
        r["kind"] = bucket(r)
        words = " ".join([r["name"], r["description"], " ".join(r["kinds"]), " ".join(r["cuisines"]), intro]).lower()
        r["words"] = re.sub(r"\s+", " ", re.sub(r"[^\w\s'&-]", " ", words)).strip()[:600]
        # fame: language editions matter most; a founding year adds a little
        r["fame"] = round(math.log2(1 + r["wps"]) * 10 + math.log2(1 + r["sitelinks"]) * 2
                          + (3 if r["since"] and r["since"] < 1950 else 0), 2)
    kept = [r for r in kept if not r.get("drop")]
    print(f"after dropping past-tense articles: {len(kept)}", flush=True)
    fields = ["qid", "name", "names", "lat", "lng", "cc", "kind", "kinds", "cuisines", "since", "sitelinks", "wps", "fame", "enwiki", "description", "words"]
    with open(os.path.join(DATA, "institutions.json"), "w", encoding="utf-8") as f:
        json.dump([{k: r[k] for k in fields} for r in sorted(kept, key=lambda r: -r["fame"])], f, ensure_ascii=False, indent=0)

    def q(s):
        return "NULL" if s is None else ("'" + str(s).replace("'", "''") + "'")
    lines = [
        "-- Generated by scripts/institutions/harvest.py — do not edit by hand.",
        "CREATE TABLE IF NOT EXISTS institutions (qid TEXT PRIMARY KEY, name TEXT NOT NULL, names TEXT, lat REAL NOT NULL, lng REAL NOT NULL, cc TEXT, kind TEXT, since INTEGER, fame REAL, enwiki TEXT, words TEXT, updated_at TEXT);",
        "CREATE INDEX IF NOT EXISTS idx_institutions_lat_lng ON institutions(lat, lng);",
        "DELETE FROM institutions;",
    ]
    batch = []
    for r in kept:
        batch.append("(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,datetime('now'))" % (
            q(r["qid"]), q(r["name"]), q("|".join(r["names"])), r["lat"], r["lng"], q(r["cc"] or None), q(r["kind"]),
            r["since"] if r["since"] else "NULL", r["fame"], q(r["enwiki"] or None), q(r["words"])))
        if len(batch) == 40:
            lines.append("INSERT INTO institutions VALUES " + ",".join(batch) + ";")
            batch = []
    if batch:
        lines.append("INSERT INTO institutions VALUES " + ",".join(batch) + ";")
    with open(os.path.join(DATA, "load_institutions.sql"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    by = {}
    for r in kept:
        for k in r["kind"].split("|"):
            by[k] = by.get(k, 0) + 1
    print("by kind:", dict(sorted(by.items(), key=lambda x: -x[1])))
    print("wrote data/institutions.json and data/load_institutions.sql")


if __name__ == "__main__":
    main()

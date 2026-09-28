"""Stage 1 - spot-level filming locations (Wikidata P915) of famous films and TV series.

Output: data/stage1_rows.json  (one row per work x location statement)
"""
import sys
import lib

# Location classes treated as city/country level (dropped unless the P915
# statement itself carries a spot coordinate as a P625 qualifier).
COARSE = ("wd:Q515 wd:Q6256 wd:Q3957 wd:Q532 wd:Q7930989 wd:Q10864048 wd:Q56061 "
          "wd:Q486972 wd:Q1549591 wd:Q5119 wd:Q35657 wd:Q107390")

WORKS = {
    # work_type: (class VALUES, sitelinks floor)
    "film": ("wd:Q11424", 40),
    # television series + television miniseries (Chernobyl, Band of Brothers)
    "tv": ("wd:Q5398426 wd:Q1259759", 30),
}

FAME = "FILTER EXISTS {{ {{ ?work wdt:P345 [] }} UNION {{ ?work wdt:P1258 [] }} }}"


def item_query(classes, floor, extra=""):
    # Location statements on the work itself (best rank), location with its own P625.
    return f"""
SELECT DISTINCT ?work ?sl ?loc ?coord WHERE {{
  VALUES ?cls {{ {classes} }}
  ?work wdt:P31 ?cls ; wikibase:sitelinks ?sl .
  FILTER(?sl >= {floor})
  {FAME.format()}
  {extra}
  ?work wdt:P915 ?loc .
  ?loc wdt:P625 ?coord .
  FILTER NOT EXISTS {{ VALUES ?coarse {{ {COARSE} }} ?loc wdt:P31/wdt:P279* ?coarse . }}
}}"""


def qualifier_query(classes, floor):
    # P915 statements whose qualifier P625 pins a spot (any location class).
    return f"""
SELECT DISTINCT ?work ?sl ?loc ?qcoord ?partLabel ?named WHERE {{
  VALUES ?cls {{ {classes} }}
  ?work wdt:P31 ?cls ; wikibase:sitelinks ?sl .
  FILTER(?sl >= {floor})
  {FAME.format()}
  ?work p:P915 ?st . ?st ps:P915 ?loc ; pq:P625 ?qcoord .
  OPTIONAL {{ ?st pq:P518 ?part . ?part rdfs:label ?partLabel . FILTER(LANG(?partLabel) = "en") }}
  OPTIONAL {{ ?st pq:P1810 ?named }}
}}"""


def season_query(floor):
    # TV: filming locations recorded on season/episode items (P179 part of the series).
    return f"""
SELECT DISTINCT ?work ?sl ?loc ?coord WHERE {{
  VALUES ?cls {{ wd:Q5398426 wd:Q1259759 }}
  ?work wdt:P31 ?cls ; wikibase:sitelinks ?sl .
  FILTER(?sl >= {floor})
  {FAME.format()}
  ?part wdt:P179 ?work ; wdt:P915 ?loc .
  ?loc wdt:P625 ?coord .
  FILTER NOT EXISTS {{ VALUES ?coarse {{ {COARSE} }} ?loc wdt:P31/wdt:P279* ?coarse . }}
}}"""


DECADES = [(None, 1950)] + [(y, y + 10) for y in range(1950, 2030, 10)]


def by_decade(classes, floor):
    """Fallback when the one-shot query times out: split by P577 decade."""
    rows = []
    for lo, hi in DECADES:
        cond = []
        if lo is not None:
            cond.append(f'?d >= "{lo}-01-01"^^xsd:dateTime')
        cond.append(f'?d < "{hi}-01-01"^^xsd:dateTime')
        extra = "?work wdt:P577 ?d . FILTER(" + " && ".join(cond) + ")"
        print(f"   decade {lo}-{hi}", flush=True)
        rows += lib.sparql(item_query(classes, floor, extra))
    return rows


def run():
    out, log = [], {}
    for wtype, (classes, floor) in WORKS.items():
        print(f"[{wtype}] item-coordinate query (sitelinks >= {floor})", flush=True)
        try:
            rows = lib.sparql(item_query(classes, floor))
        except Exception as e:  # WDQS timeout -> split by decade
            print("  one-shot failed:", e, "- splitting by decade", flush=True)
            rows = by_decade(classes, floor)
        log[f"{wtype}_item_rows"] = len(rows)
        for r in rows:
            out.append({"work": lib.qid(r["work"]), "work_type": wtype, "sitelinks": int(r["sl"]),
                        "loc": lib.qid(r["loc"]), "coord": r["coord"], "coord_source": "item",
                        "via": "work"})
        print(f"[{wtype}] qualifier-coordinate query", flush=True)
        rows = lib.sparql(qualifier_query(classes, floor))
        log[f"{wtype}_qualifier_rows"] = len(rows)
        for r in rows:
            out.append({"work": lib.qid(r["work"]), "work_type": wtype, "sitelinks": int(r["sl"]),
                        "loc": lib.qid(r["loc"]), "coord": r["qcoord"], "coord_source": "qualifier",
                        "via": "work", "part_label": r.get("partLabel", ""), "named_as": r.get("named", "")})
        if wtype == "tv":
            print("[tv] season/episode-level query", flush=True)
            rows = lib.sparql(season_query(floor))
            log["tv_season_episode_rows"] = len(rows)
            for r in rows:
                out.append({"work": lib.qid(r["work"]), "work_type": wtype, "sitelinks": int(r["sl"]),
                            "loc": lib.qid(r["loc"]), "coord": r["coord"], "coord_source": "item",
                            "via": "season_or_episode"})
    # de-duplicate identical work x loc x coord rows
    seen, uniq = set(), []
    for r in out:
        k = (r["work"], r["loc"], r["coord"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    log["rows"] = len(uniq)
    log["works"] = len({r["work"] for r in uniq})
    log["locations"] = len({r["loc"] + ("|" + r["coord"] if r["coord_source"] == "qualifier" else "") for r in uniq})
    lib.save("stage1_rows.json", uniq)
    lib.save("stage1_log.json", log)
    print(log)


if __name__ == "__main__":
    run()

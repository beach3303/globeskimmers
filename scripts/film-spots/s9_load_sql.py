"""Stage 9 - turn seed_400.csv into one D1 load file (no database access).

Writes data/load_film_scenes.sql for globeskimmers-attractions:
  * new_spot rows -> INSERT OR IGNORE INTO attractions (id 'film:<qid|slug>',
    an existing browse category, footprint from radius_m, scope 'regional' so
    the spot is stampable; the stamp-worthiness bar is the seed's fame cut)
  * rows flagged reuses_unstamped_row(<id>) -> no new row: the film goes on
    that attraction, which is promoted to founder_scope 'regional' only when
    it is not already stampable (the app's stampsOnly rule is
    coalesce(founder_scope, scope) IN world/national/regional), and gets the
    spot's footprint only when it has none
  * every kept row -> INSERT OR REPLACE INTO film_scenes keyed by the
    attraction (the existing one for film_line_on_existing rows)
Corrections, applied in order when the files exist:
  1. scenes_roles.csv   - scene / cast fixes and a verdict per row
                          (drop_not_filmed_here | drop_weak_evidence drop it)
  2. review_decisions.csv - keep | drop | merge:<attraction_id>, the founder's
                          review of review_40.csv (merge = film line on that
                          existing stamp instead of a new spot)
Rows are matched on (spot_qid or spot_name, work_qid).
A spot that appears for several works keeps the highest-scoring work; the
others join its also_in line.

Run:  python3 s9_load_sql.py
Then the founder applies, in order:
  npx wrangler d1 execute globeskimmers-attractions --remote --file=cloudflare-worker/sql/13_film_scenes.sql
  npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/film-spots/data/load_film_scenes.sql
"""
import argparse
import csv
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))

# spot_class (Wikidata "instance of" labels) -> an existing attractions.category,
# so film spots show up in the normal browse filters. First match wins.
CATEGORY_RULES = [
    (r"beach|coast|bay|cove", "beach"),
    (r"national park|nature reserve|protected area|biotope", "national_park"),
    (r"waterfall", "waterfall"),
    (r"lake|reservoir", "lake"),
    (r"river|canyon|gorge|valley", "river"),
    (r"mountain|hill|cliff|volcano|pass|island|desert|dune|natural|woodland|forest|glacier|cave|rock", "viewpoint"),
    (r"garden|botanical", "garden"),
    (r"theme park|amusement", "theme_park"),
    (r"\bpark\b", "park"),
    (r"square|plaza", "square"),
    (r"castle|fort|citadel|ksar|kasbah", "fortress"),
    (r"palace|château|chateau|country house|manor|mansion|stately", "palace"),
    (r"cathedral", "cathedral"),
    (r"church|chapel|abbey|monastery|basilica|hermitage", "religious"),
    (r"temple", "temple"),
    (r"shrine", "shrine"),
    (r"mosque", "mosque"),
    (r"museum|gallery", "museum"),
    (r"market", "market"),
    (r"tower|skyscraper|observation", "tower"),
    (r"zoo", "zoo"),
    (r"aquarium", "aquarium"),
    (r"ruin|archaeolog|historic|heritage|village|old town", "historic"),
    (r"street|road|bridge|viaduct|station|stairs|steps|building|hotel|restaurant|diner|cafe|café|bar|pub|"
     r"school|university|college|hospital|prison|stadium|theatre|theater|hall|house|home|library|"
     r"cemetery|power station|office|court|fire station|institute|center|centre", "landmark"),
]


def category_for(spot_class):
    s = (spot_class or "").lower()
    for pat, cat in CATEGORY_RULES:   # national park and theme park sit above plain park
        if re.search(pat, s):
            return cat
    return "landmark"


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60] or "spot"


def q(v):
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def num(v, cast=float):
    try:
        return str(cast(float(v)))
    except (TypeError, ValueError):
        return "NULL"


def key(r):
    return ((r.get("spot_qid") or r.get("spot_name") or "").strip(), (r.get("work_qid") or "").strip())


def read_csv(path):
    return list(csv.DictReader(open(path, encoding="utf-8"))) if os.path.exists(path) else []


STAMPABLE = ("world", "national", "regional")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", default=os.path.join(HERE, "seed_400.csv"))
    ap.add_argument("--overlay", default=os.path.join(HERE, "scenes_roles.csv"))
    ap.add_argument("--decisions", default=os.path.join(HERE, "review_decisions.csv"))
    ap.add_argument("--out", default=os.path.join(HERE, "data", "load_film_scenes.sql"))
    a = ap.parse_args()
    rows = read_csv(a.seed)
    overlay = {key(o): o for o in read_csv(a.overlay)}
    decisions = {key(d): (d.get("decision") or "").strip() for d in read_csv(a.decisions)}

    kept, dropped = [], []
    for r in rows:
        o = overlay.get(key(r))
        if o:
            for f in ("scene", "cast1", "role1", "cast2", "role2"):
                if (o.get(f) or "").strip():
                    r[f] = o[f].strip()
            if (o.get("verdict") or "").startswith("drop"):
                dropped.append((r["spot_name"], r["work_title"], o["verdict"]))
                continue
        dec = decisions.get(key(r), "keep")
        if dec == "drop":
            dropped.append((r["spot_name"], r["work_title"], "review: drop"))
            continue
        r["_merge"] = dec[6:].strip() if dec.startswith("merge:") else ""
        kept.append(r)

    def aid(r):
        if r["_merge"]:
            return r["_merge"], None
        if r["action"] == "film_line_on_existing" and r.get("existing_attraction_id"):
            return r["existing_attraction_id"], None
        m = re.search(r"reuses_unstamped_row\(([^)|]+)\)", r.get("flags") or "")
        if m:
            return m.group(1).strip(), "reuse"
        return "film:" + (r["spot_qid"] or slug(r["spot_name"] + "-" + (r.get("country_code") or ""))), "new"

    by_spot = {}
    for r in kept:
        spot_id, how = aid(r)
        by_spot.setdefault(spot_id, {"how": how, "rows": []})["rows"].append(r)

    out = ["-- Film scenes load, generated by scripts/film-spots/s9_load_sql.py from "
           + os.path.basename(a.seed) + ". Apply 13_film_scenes.sql first.",
           "-- New spots use ids 'film:<qid>'; spots we already had get a film line (and, if they were",
           "-- not stampable yet, founder_scope 'regional'). Safe to re-run.", ""]
    n_new = n_reuse = n_film = 0
    for spot_id, g in by_spot.items():
        group = sorted(g["rows"], key=lambda r: -float(r.get("score") or 0))
        r = group[0]
        others = [f"{x['work_title']} ({x['year']})" if x.get("year") else x["work_title"] for x in group[1:]]
        also = "; ".join([x for x in [r.get("also_in") or ""] + others if x])
        radius = num(r.get("radius_m"), int)
        if g["how"] == "new":
            pv = r.get("spot_pageviews_12m")
            pop = num(float(pv) / 12, int) if pv not in (None, "") else "NULL"
            out.append(
                "INSERT OR IGNORE INTO attractions (id, name, category, lat, lng, city, country, source, source_id, "
                "footprint_radius_m, tier, scope, qid, sitelinks, popularity) VALUES ("
                + ", ".join([q(spot_id), q(r["spot_name"]), q(category_for(r["spot_class"])), num(r["lat"]), num(r["lng"]),
                             q(r.get("city") or ""), q(r.get("country_code")), q("film_seed"), q(r["spot_qid"]),
                             radius, q("page"), q("regional"), q(r["spot_qid"]),
                             num(r.get("sitelinks"), int), pop]) + ");")
            n_new += 1
        elif g["how"] == "reuse":
            out.append(f"UPDATE attractions SET founder_scope = 'regional', updated_at = datetime('now') WHERE id = {q(spot_id)} "
                       f"AND coalesce(founder_scope, scope, 'local') NOT IN ('world', 'national', 'regional');")
            if radius != "NULL":
                out.append(f"UPDATE attractions SET footprint_radius_m = {radius} WHERE id = {q(spot_id)} AND footprint_radius_m IS NULL;")
            n_reuse += 1
        out.append(
            "INSERT OR REPLACE INTO film_scenes (attraction_id, work_qid, work_title, work_type, year, cast1, role1, "
            "cast2, role2, scene, also_in, source_urls, updated_at) VALUES ("
            + ", ".join([q(spot_id), q(r.get("work_qid")), q(r["work_title"]), q(r.get("work_type") or "film"),
                         num(r.get("year"), int), q(r.get("cast1")), q(r.get("role1")), q(r.get("cast2")), q(r.get("role2")),
                         q(r.get("scene")), q(also), q(r.get("source_urls"))]) + ", datetime('now'));")
        n_film += 1
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    open(a.out, "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(f"wrote {a.out}: {n_new} new attractions, {n_reuse} existing rows reused, {n_film} film_scenes rows; "
          f"{len(kept)} seed rows kept, {len(dropped)} dropped")
    for d in dropped:
        print("  dropped:", *d)


if __name__ == "__main__":
    main()

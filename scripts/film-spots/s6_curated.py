"""Stage 6 - verify the hand-added supplement (curated_input.py) against English
Wikipedia, and resolve every spot and work to its Wikidata item.

For each claim (spot article, work article):
  1. fetch both articles' plain text + Wikidata id + GeoData coordinate
     (MediaWiki action API, redirects followed);
  2. keep the claim only if the spot article mentions the work (film_terms,
     case-sensitive) or the work article mentions the spot (spot_terms);
  3. store the matching sentences as evidence (data/curated_evidence.json and
     curated_evidence.csv) - scene lines in curated_scenes.py are written from
     this evidence only.
Coordinates: the spot item's P625 (Wikidata), else the article's GeoData point.

Output: data/curated_verified.json, data/curated_works.json (work QIDs for s2)
"""
import csv
import os
import re
import urllib.parse
import lib
from curated_input import C

WP = "https://en.wikipedia.org/w/api.php"
WD = "https://www.wikidata.org/w/api.php"


def page(title):
    url = WP + "?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "redirects": 1, "titles": title,
        "prop": "extracts|pageprops|coordinates", "explaintext": 1, "exsectionformat": "plain",
        "ppprop": "wikibase_item", "coprimary": "primary"})
    js = lib.http_json(url, bucket="wp", min_gap=0.3)
    pages = (js or {}).get("query", {}).get("pages", {})
    for pid, p in pages.items():
        if pid.startswith("-"):
            return None
        co = (p.get("coordinates") or [{}])[0]
        return {"title": p["title"], "text": p.get("extract", ""),
                "qid": p.get("pageprops", {}).get("wikibase_item", ""),
                "geo": (co.get("lat"), co.get("lon")) if co.get("lat") is not None else None}
    return None


SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")
FILMING = re.compile(r"\b(film|filmed|filming|shot|shoot|location|scene|featured|set|used|appear)", re.I)


def evidence(text, terms, limit=6):
    """Sentences containing any term (case-sensitive); sentences that also talk
    about filming come first."""
    if not terms:
        return []
    out = []
    for para in text.split("\n"):
        for s in SENT.split(para):
            s = s.strip()
            if s and any(t in s for t in terms) and s not in out:
                out.append(s)
    out.sort(key=lambda s: 0 if FILMING.search(s) else 1)
    return out[:limit]


WIKILINK = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]")


def wikitext_list_evidence(title, terms, limit=3):
    """Bulleted list lines ("* ''Gladiator'' (2000)") are dropped by the plain-text
    extract; read them from the wikitext instead."""
    url = WP + "?" + urllib.parse.urlencode({"action": "query", "format": "json", "redirects": 1, "titles": title,
                                             "prop": "revisions", "rvprop": "content", "rvslots": "main"})
    js = lib.http_json(url, bucket="wp", min_gap=0.3)
    out = []
    for p in (js or {}).get("query", {}).get("pages", {}).values():
        for rev in p.get("revisions", []):
            txt = rev.get("slots", {}).get("main", {}).get("*", "")
            for line in txt.split("\n"):
                if not line.startswith("*"):
                    continue
                clean = WIKILINK.sub(r"\1", line).replace("''", "")
                clean = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>|\{\{[^}]*\}\}", "", clean).strip("* ").strip()
                if any(t in clean for t in terms) and clean not in out:
                    out.append("list entry: " + clean)
    return out[:limit]


def wiki_url(title):
    return "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))


def entities(qids, props="claims|sitelinks|labels"):
    out = {}
    for batch in lib.chunks(sorted(set(q for q in qids if q)), 50):
        url = WD + "?" + urllib.parse.urlencode({"action": "wbgetentities", "format": "json",
                                                 "ids": "|".join(batch), "props": props, "languages": "en"})
        js = lib.http_json(url, bucket="wdapi", min_gap=0.5)
        out.update((js or {}).get("entities", {}))
    return out


def claim_ids(ent, prop):
    ids = []
    for c in ent.get("claims", {}).get(prop, []):
        dv = c.get("mainsnak", {}).get("datavalue")
        if dv and isinstance(dv.get("value"), dict) and "id" in dv["value"]:
            ids.append(dv["value"]["id"])
    return ids


def claim_str(ent, prop):
    for c in ent.get("claims", {}).get(prop, []):
        dv = c.get("mainsnak", {}).get("datavalue")
        if dv:
            return dv["value"]
    return None


def year(ent):
    ys = []
    for prop in ("P577", "P580"):
        for c in ent.get("claims", {}).get(prop, []):
            dv = c.get("mainsnak", {}).get("datavalue")
            if dv:
                ys.append(int(dv["value"]["time"][1:5]))
        if ys:
            return min(ys)
    return None


def run():
    rows = []
    for e in C:
        sp = page(e["article"]) if e.get("article") else None
        wk = page(e["work"])
        rec = {"spot_article": e.get("article") or "", "work_article": e["work"], "spot_class": e["cls"],
               "region": e["region"], "name_override": e.get("name", ""), "flags": list(e.get("flags", [])),
               "cc_override": e.get("cc", ""), "work_type_override": e.get("work_type", ""),
               "spot": sp and {k: sp[k] for k in ("title", "qid", "geo")},
               "work": wk and {k: wk[k] for k in ("title", "qid")}, "evidence": [], "status": ""}
        if e.get("qid"):
            rec["spot"] = dict(rec["spot"] or {"title": "", "geo": None}, qid=e["qid"])
        if e.get("article") and not sp:
            rec["status"] = "spot_article_missing"
        elif not wk:
            rec["status"] = "work_article_missing"
        else:
            ev = []
            if sp:
                ev += [{"source_url": wiki_url(sp["title"]), "text": t} for t in evidence(sp["text"], e["ft"])]
            ev += [{"source_url": wiki_url(wk["title"]), "text": t} for t in evidence(wk["text"], e["st"])]
            for x in e.get("extra", []):
                xp = page(x)
                if xp:
                    ev += [{"source_url": wiki_url(xp["title"]), "text": t}
                           for t in evidence(xp["text"], e["ft"] + e["st"])]
            if sp:
                ev += [{"source_url": wiki_url(sp["title"]), "text": t}
                       for t in wikitext_list_evidence(sp["title"], e["ft"])]
            rec["evidence"] = ev
            rec["status"] = "verified" if ev else "no_evidence"
        rows.append(rec)
        print(f"{rec['status']:22} {e.get('name') or e.get('article')} <- {e['work']} ({len(rec['evidence'])})", flush=True)

    ok = [r for r in rows if r["status"] == "verified"]
    ents = entities([r["spot"]["qid"] for r in ok] + [r["work"]["qid"] for r in ok])
    countries = entities([c for r in ok for c in claim_ids(ents.get(r["spot"]["qid"], {}), "P17")[:1]])
    for r in ok:
        se = ents.get(r["spot"]["qid"], {})
        we = ents.get(r["work"]["qid"], {})
        co = claim_str(se, "P625")
        if co:
            r["lat"], r["lng"], r["coord_from"] = co["latitude"], co["longitude"], "wikidata_P625"
        elif r["spot"]["geo"]:
            r["lat"], r["lng"], r["coord_from"] = r["spot"]["geo"][0], r["spot"]["geo"][1], "wikipedia_geodata"
        else:
            r["lat"] = r["lng"] = None
            r["coord_from"] = ""
        if r["lat"] is None:
            r["status"] = "no_coordinates"
        cq = (claim_ids(se, "P17") or [""])[0]
        r["country_qid"] = cq
        r["country_code"] = r["cc_override"] or claim_str(countries.get(cq, {}), "P297") or ""
        r["spot_label"] = r["name_override"] or se.get("labels", {}).get("en", {}).get("value", r["spot"]["title"])
        r["spot_p31"] = claim_ids(se, "P31")
        r["work_label"] = we.get("labels", {}).get("en", {}).get("value", r["work"]["title"])
        w31 = set(claim_ids(we, "P31"))
        r["work_type"] = r["work_type_override"] or ("tv" if w31 & {"Q5398426", "Q1259759", "Q526877", "Q581714", "Q63952888"} else "film")
        r["work_p31"] = sorted(w31)
        r["year"] = year(we)
        r["imdb_id"] = claim_str(we, "P345") or ""
        r["sitelinks"] = len(we.get("sitelinks", {}))
        r["enwiki"] = se.get("sitelinks", {}).get("enwiki", {}).get("title", "")
    lib.save("curated_verified.json", rows)
    ok = [r for r in rows if r["status"] == "verified"]
    lib.save("curated_works.json", sorted({r["work"]["qid"] for r in ok if r["work"]["qid"]}))
    with open(os.path.join(lib.HERE, "curated_evidence.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["spot_article", "work_article", "status", "source_url", "evidence_sentence"])
        for r in rows:
            if not r["evidence"]:
                w.writerow([r["spot_article"], r["work_article"], r["status"], "", ""])
            for e in r["evidence"]:
                w.writerow([r["spot_article"], r["work_article"], r["status"], e["source_url"], e["text"]])
    print("verified", len(ok), "of", len(rows))


if __name__ == "__main__":
    run()

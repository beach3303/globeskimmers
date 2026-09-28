"""Stage 2 - the two leading cast members with their character, per work.

Roles: Wikidata P161 (cast member) statements with qualifier P453 (character
role, item) or P4633 (name of the character role, string). SPARQL, 50 works
per VALUES batch.

Billing order: qualifier P1545 (series ordinal) when present; otherwise the
order in which the P161 statements sit on the work's item (fetched from the
Wikidata action API, wbgetentities, 50 ids per call) - these lists are mostly
imported from the Wikipedia infobox "Starring" line, so the order is the credits
order. A work is flagged needs_roles when fewer than two roled cast exist, and
lead_without_role when the first-billed cast member has no role qualifier, and
cast_skips_unroled(names) when a higher-billed member without a role was passed
over for a lower-billed one (e.g. Lost in Translation: Scarlett Johansson).

Input : data/stage1_rows.json (+ data/curated_works.json when s6 has run)
Output: data/cast.json   {work_qid: {cast: [...], flags: [...]}}
"""
import os
import re
import lib

API = "https://www.wikidata.org/w/api.php"
QID_RE = re.compile(r"^Q\d+$")


def cast_query(qids):
    vals = " ".join("wd:" + q for q in qids)
    return f"""
SELECT ?work ?st ?actor ?actorLabel ?asl ?role ?roleLabel ?roleName ?ord WHERE {{
  VALUES ?work {{ {vals} }}
  ?work p:P161 ?st . ?st ps:P161 ?actor .
  OPTIONAL {{ ?st pq:P453 ?role . }}
  OPTIONAL {{ ?st pq:P4633 ?roleName . }}
  OPTIONAL {{ ?st pq:P1545 ?ord . }}
  OPTIONAL {{ ?actor wikibase:sitelinks ?asl . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,mul". }}
}}"""


def statement_order(qids):
    """{work: {actor_qid: first index}} from the item's P161 statement order."""
    out = {}
    for batch in lib.chunks(qids, 50):
        url = API + "?action=wbgetentities&format=json&props=claims&ids=" + "|".join(batch)
        js = lib.http_json(url, bucket="wdapi", min_gap=0.5)
        for q, ent in (js or {}).get("entities", {}).items():
            order = {}
            for i, c in enumerate(ent.get("claims", {}).get("P161", [])):
                dv = c.get("mainsnak", {}).get("datavalue")
                if dv:
                    a = dv["value"]["id"]
                    order.setdefault(a, i)
            out[q] = order
    return out


def works_to_fetch():
    qs = {r["work"] for r in lib.load("stage1_rows.json")}
    p = os.path.join(lib.DATA, "curated_works.json")
    if os.path.exists(p):
        qs |= set(lib.load("curated_works.json"))
    return sorted(qs)


def run():
    qids = works_to_fetch()
    print("works:", len(qids))
    rows = []
    for i, batch in enumerate(lib.chunks(qids, 50)):
        print(f"  cast batch {i + 1}", flush=True)
        rows += lib.sparql(cast_query(batch))
    order = statement_order(qids)
    per = {}
    for r in rows:
        w, a = lib.qid(r["work"]), lib.qid(r["actor"])
        d = per.setdefault(w, {}).setdefault(a, {"actor": a, "name": r.get("actorLabel", ""), "roles": [],
                                                 "ord": None, "asl": int(r.get("asl", 0) or 0)})
        role = r.get("roleLabel") if r.get("role") else None
        if role and QID_RE.match(role):
            role = None  # role item with no English label
        if not role and r.get("roleName"):
            role = r["roleName"]
        if role and role not in d["roles"]:
            d["roles"].append(role)
        if r.get("ord"):
            try:
                o = int(r["ord"])
                d["ord"] = o if d["ord"] is None else min(d["ord"], o)
            except ValueError:
                pass
    out = {}
    for w in qids:
        members = list(per.get(w, {}).values())
        so = order.get(w, {})
        for m in members:
            m["stmt_index"] = so.get(m["actor"], 9999)
            m["key"] = (m["ord"] if m["ord"] is not None else 1000 + m["stmt_index"], -m["asl"])
        members.sort(key=lambda m: m["key"])
        members = [m for m in members if m["name"] and not QID_RE.match(m["name"])]
        roled = [m for m in members if m["roles"]]
        flags = []
        if len(roled) < 2:
            flags.append("needs_roles")
        if members and not members[0]["roles"]:
            flags.append("lead_without_role")
        # a higher-billed cast member without a role was skipped for a lower-billed one
        top = members[:len(roled[:2])]
        skipped = [m["name"] for m in top if not m["roles"]]
        if len(members) > 60:  # long-running series: "the two leads" needs a human pick (Doctor Who)
            flags.append(f"large_cast({len(members)})")
        if skipped and roled:
            flags.append("cast_skips_unroled(" + ", ".join(skipped) + ")")
        out[w] = {"cast": [{"name": m["name"], "role": " / ".join(m["roles"]), "actor": m["actor"],
                            "ord": m["ord"], "stmt_index": m["stmt_index"]} for m in roled[:2]],
                  "billed_first": members[0]["name"] if members else "",
                  "flags": flags}
    lib.save("cast.json", out)
    print("with 2 roled cast:", sum(1 for v in out.values() if "needs_roles" not in v["flags"]), "of", len(out))


if __name__ == "__main__":
    run()

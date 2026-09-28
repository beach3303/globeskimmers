"""Stage 5a - read-only export of our owned attractions from D1
(globeskimmers-attractions), used by the dedupe in s8_build.py.

Only SELECT / PRAGMA statements are executed. The export is written to
.cache/attractions_export.json (not committed - it is a copy of production data).
"""
import json
import os
import subprocess
import lib

DB = "globeskimmers-attractions"
COLS = ["id", "name", "category", "lat", "lng", "city", "country", "qid", "is_marquee", "scope",
        "tier", "footprint_radius_m"]
OUT = os.path.join(lib.CACHE, "attractions_export.json")


def d1(sql):
    assert sql.lstrip().upper().startswith(("SELECT", "PRAGMA")), "read-only only"
    p = subprocess.run(["npx", "wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql],
                       cwd=os.path.join(lib.HERE, "..", ".."), capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        raise RuntimeError(p.stderr[-2000:])
    return json.loads(p.stdout)[0]["results"]


def run():
    info = d1("PRAGMA table_info(attractions)")
    have = [c["name"] for c in info]
    cols = [c for c in COLS if c in have]
    print("attractions columns:", have)
    rows, last = [], 0
    while True:
        chunk = d1(f"SELECT rowid AS _r, {', '.join(cols)} FROM attractions WHERE rowid > {last} "
                   f"ORDER BY rowid LIMIT 20000")
        if not chunk:
            break
        rows += chunk
        last = chunk[-1]["_r"]
        print("  exported", len(rows), flush=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"columns": have, "rows": rows}, f)
    print("rows:", len(rows), "marquee:", sum(1 for r in rows if r.get("is_marquee")))


if __name__ == "__main__":
    run()

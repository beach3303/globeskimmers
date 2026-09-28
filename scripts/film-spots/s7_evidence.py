"""Stage 7a - does English Wikipedia say so? For every Wikidata work x spot pair,
look for a sentence in the spot's article that names the work, or a sentence in
the work's article that names the spot, next to a filming word. The sentences are
saved (wikidata_evidence.csv) for the scene-writing phase and the match is used
as a notability check in s8 (flag wp_mention / no_wp_mention).
"""
import csv
import os
import re
import urllib.parse
import lib
from s6_curated import page, SENT, FILMING

YEAR = re.compile(r"\b(19|20)\d\d\b")


def base(title):
    t = urllib.parse.unquote(title or "").replace("_", " ")
    return re.sub(r"\s*\(.*?\)\s*$", "", t).strip()


def sentences(text):
    for para in text.split("\n"):
        for s in SENT.split(para):
            s = s.strip()
            if s:
                yield s


def find(text, terms, need):
    out = []
    terms = [t for t in terms if t and len(t) >= 3]
    for s in sentences(text):
        if any(re.search(r"(?<![A-Za-z])" + re.escape(t) + r"(?![a-z])", s) for t in terms) and need(s):
            if s not in out:
                out.append(s)
        if len(out) >= 3:
            break
    return out


def run():
    s1 = lib.load("stage1_rows.json")
    lab = lib.load("labels.json")
    L, W = lab["spots"], lab["works"]
    pairs = sorted({(r["loc"], r["work"]) for r in s1})
    texts = {}

    def text(title):
        if not title:
            return ""
        if title not in texts:
            p = page(urllib.parse.unquote(title).replace("_", " "))
            texts[title] = p["text"] if p else ""
        return texts[title]

    out = {}
    for i, (sq, wq) in enumerate(pairs):
        s, w = L.get(sq, {}), W.get(wq, {})
        wterms = {w.get("label", ""), base(w.get("enwiki", ""))}
        sterms = {s.get("label", ""), base(s.get("enwiki", ""))}
        short = min((len(t) for t in wterms if t), default=0) < 6
        need_s = (lambda x: FILMING.search(x) and (YEAR.search(x) or not short)) if short else (lambda x: True)
        ev = []
        if s.get("enwiki"):
            ev += [("spot", s["enwiki"], t) for t in find(text(s["enwiki"]), wterms, need_s)]
        if w.get("enwiki"):
            ev += [("work", w["enwiki"], t) for t in find(text(w["enwiki"]), sterms, lambda x: FILMING.search(x))]
        out[f"{sq}|{wq}"] = ev
        if i % 100 == 0:
            print(" ", i, "of", len(pairs), flush=True)
    lib.save("wikidata_evidence.json", out)
    with open(os.path.join(lib.HERE, "wikidata_evidence.csv"), "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f)
        wr.writerow(["spot_qid", "spot_name", "work_qid", "work_title", "found_in", "source_url", "sentence"])
        for k, ev in out.items():
            sq, wq = k.split("|")
            for where, title, t in ev:
                wr.writerow([sq, L.get(sq, {}).get("label", ""), wq, W.get(wq, {}).get("label", ""), where,
                             "https://en.wikipedia.org/wiki/" + title, t])
    print("pairs", len(out), "with mention", sum(1 for v in out.values() if v))


if __name__ == "__main__":
    run()

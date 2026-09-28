"""Stage 4 - English-Wikipedia pageviews of each spot, Sep 2025 - Aug 2026
(Wikimedia REST API, per-article monthly, all-access, user agents).

Article = the spot item's enwiki sitelink. Curated spots whose item has no
enwiki article use the article the claim was verified on (e.g. Maya Bay ->
Ko Phi Phi Le) and are flagged pageviews_proxy.
Output: data/pageviews.json {article_title: views_12m}
"""
import urllib.parse
import lib

URL = ("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/"
       "{}/monthly/2025090100/2026083100")


def views(title):
    t = urllib.parse.quote(title.replace(" ", "_"), safe="")
    js = lib.http_json(URL.format(t), bucket="pv", min_gap=0.12)
    if not js:
        return 0
    return sum(i.get("views", 0) for i in js.get("items", []))


def titles():
    L = lib.load("labels.json")["spots"]
    ts = {s["enwiki"] for s in L.values() if s.get("enwiki")}
    for r in lib.load("curated_verified.json"):
        if r["status"] == "verified" and r["spot"].get("title"):
            ts.add(r["spot"]["title"].replace(" ", "_"))
    return sorted(ts)


def run():
    ts = titles()
    print("articles:", len(ts), flush=True)
    out = {}
    for i, t in enumerate(ts):
        out[t] = views(urllib.parse.unquote(t))
        if i % 100 == 0:
            print(" ", i, t, out[t], flush=True)
    lib.save("pageviews.json", out)
    print("zero:", sum(1 for v in out.values() if not v))


if __name__ == "__main__":
    run()

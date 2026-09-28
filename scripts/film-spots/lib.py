"""Shared helpers for the film-spots seed pipeline (Python 3.9 stdlib only).

- WDQS (query.wikidata.org) calls are throttled to <= 1 request/second and back
  off on 429/5xx, honouring Retry-After.
- Every HTTP response is cached under .cache/ keyed by a hash of the request, so
  a re-run is cheap and deterministic. Delete .cache/ to refetch live data.
"""
import hashlib
import http.client
import json
import math
import os
import socket
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
CACHE = os.path.join(HERE, ".cache")
os.makedirs(DATA, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

UA = "GlobeSkimmersSeed/1.0 (founder@globeskimmers.io) film-spots seed; python-urllib"
WDQS = "https://query.wikidata.org/sparql"

_last_call = {}


def _throttle(bucket, min_gap):
    now = time.time()
    gap = now - _last_call.get(bucket, 0)
    if gap < min_gap:
        time.sleep(min_gap - gap)
    _last_call[bucket] = time.time()


def _cache_path(key):
    return os.path.join(CACHE, hashlib.sha1(key.encode("utf-8")).hexdigest() + ".json")


def http_json(url, data=None, bucket="default", min_gap=0.2, timeout=90, retries=7, accept="application/json"):
    """GET (or POST when data is a dict) returning parsed JSON, cached.
    Returns None on a definitive 404."""
    key = url + ("|" + urllib.parse.urlencode(data) if data else "")
    cp = _cache_path(key)
    if os.path.exists(cp):
        with open(cp, encoding="utf-8") as f:
            return json.load(f)
    body = urllib.parse.urlencode(data).encode("utf-8") if data else None
    delay = 5
    for attempt in range(retries):
        _throttle(bucket, min_gap)
        req = urllib.request.Request(url, data=body, headers={"User-Agent": UA, "Accept": accept})
        if body:
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                out = json.loads(r.read().decode("utf-8"))
            with open(cp, "w", encoding="utf-8") as f:
                json.dump(out, f)
            return out
        except urllib.error.HTTPError as e:
            if e.code == 404:
                with open(cp, "w", encoding="utf-8") as f:
                    json.dump(None, f)
                return None
            if e.code in (429, 500, 502, 503, 504):
                ra = e.headers.get("Retry-After")
                wait = int(ra) if ra and ra.isdigit() else delay
                print(f"  HTTP {e.code}; backing off {wait}s (attempt {attempt + 1})", flush=True)
                time.sleep(wait)
                delay = min(delay * 2, 120)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, socket.timeout, http.client.IncompleteRead) as e:
            print(f"  network error {e}; retry in {delay}s", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 120)
    raise RuntimeError("giving up on " + url[:200])


def sparql(query, timeout=300):
    """Run a SPARQL query against WDQS (POST, <= 1 req/s). Returns bindings as
    a list of {var: value} dicts (plain strings)."""
    out = http_json(WDQS, data={"query": query, "format": "json"}, bucket="wdqs",
                    min_gap=1.1, timeout=timeout, accept="application/sparql-results+json")
    rows = []
    for b in out["results"]["bindings"]:
        rows.append({k: v["value"] for k, v in b.items()})
    return rows


def qid(uri):
    return uri.rsplit("/", 1)[-1] if uri else ""


def parse_point(wkt):
    """'Point(lng lat)' -> (lat, lng)"""
    if not wkt or not wkt.startswith("Point("):
        return None
    lng, lat = wkt[6:-1].split()
    return float(lat), float(lng)


def haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def chunks(seq, n):
    seq = list(seq)
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def save(name, obj):
    with open(os.path.join(DATA, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)

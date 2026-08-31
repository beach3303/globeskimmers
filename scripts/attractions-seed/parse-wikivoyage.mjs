#!/usr/bin/env node
// parse-wikivoyage.mjs — extract See/Do listings from the enwikivoyage dump.
//
//   bzcat enwikivoyage-latest-pages-articles.xml.bz2 | node parse-wikivoyage.mjs OUTDIR
//
// Emits two JSONL files into OUTDIR:
//   listings.jsonl — one line per {{see}}/{{do}}/{{listing}} template:
//                    {page, section, idx, type, name, alt, lat, lng, wikidata,
//                     wikipedia, address, teaser}
//   pages.jsonl    — one line per destination article:
//                    {page, lat, lng, counts:{see,do,listing}, isDistrict}
//
// WHY THIS IS NOT A REGEX JOB
// Wikivoyage listings are MediaWiki templates with NESTED braces and links —
//   {{see | name=[[Louvre]] | content=Home of the {{w|Mona Lisa}} ... }}
// A line- or regex-based parser returns literally zero listings (verified during
// the source evaluation). This walks characters and tracks {{ }} and [[ ]] depth,
// splitting parameters only at depth 1.
//
// DISTRICT ROLL-UP
// Big cities keep their listings in district sub-pages ("Paris/1st arrondissement").
// We emit the page title verbatim and mark isDistrict; the loader rolls districts
// up to the parent city (title before the first "/"). Skipping this loses most of
// Paris, London and Tokyo.
//
// Licence note: Wikivoyage text is CC BY-SA. Names, coordinates and structure are
// facts and safe to use; the `teaser` field is capped raw prose kept ONLY for
// pipeline debugging — do not ship it to users (write our own descriptions).

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const OUT = process.argv[2];
if (!OUT) { console.error("usage: bzcat dump.bz2 | node parse-wikivoyage.mjs OUTDIR"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const listingsOut = fs.createWriteStream(path.join(OUT, "listings.jsonl"));
const pagesOut = fs.createWriteStream(path.join(OUT, "pages.jsonl"));

// The dump XML-escapes page text; undo the five standard entities.
const unxml = (s) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
  .replace(/&amp;/g, "&"); // last, or it double-unescapes

// Strip wiki markup from a value: [[target|label]] → label, [[target]] → target,
// '''bold'''/''italic'' → bare, nested {{templates}} → their last positional arg
// (covers {{w|Mona Lisa}} and friends), residual tags dropped.
function plain(s) {
  let t = String(s || "");
  for (let i = 0; i < 4 && /\{\{|\[\[/.test(t); i++) {
    t = t
      .replace(/\[\[(?:[^[\]|]*\|)?([^[\]|]*)\]\]/g, "$1")
      .replace(/\{\{(?:[^{}|]*\|)*([^{}|]*)\}\}/g, "$1");
  }
  return t.replace(/'{2,}/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Find the end of a template that opens at `start` (index of "{{"), walking
// nested {{ }}. Returns the index just past the closing "}}", or -1.
function templateEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    const two = text[i] + text[i + 1];
    if (two === "{{") { depth++; i++; }
    else if (two === "}}") { depth--; i++; if (depth === 0) return i + 1; }
  }
  return -1;
}

// Split template body on "|" at depth 1 only — pipes inside nested templates
// and [[links|with labels]] belong to their values, not to us.
function splitParams(body) {
  const parts = [];
  let cur = "", brace = 0, bracket = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body[i] + (body[i + 1] || "");
    if (two === "{{") { brace++; cur += two; i++; continue; }
    if (two === "}}") { brace--; cur += two; i++; continue; }
    if (two === "[[") { bracket++; cur += two; i++; continue; }
    if (two === "]]") { bracket--; cur += two; i++; continue; }
    if (body[i] === "|" && brace === 0 && bracket === 0) { parts.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  parts.push(cur);
  return parts;
}

const LISTING_RE = /\{\{\s*(see|do|listing)\s*[|}]/gi;
const num = (v) => { const n = parseFloat(String(v).trim()); return Number.isFinite(n) ? n : null; };

let pageCount = 0, destPages = 0, listingCount = 0;

function processPage(xml) {
  pageCount++;
  const ns = /<ns>(\d+)<\/ns>/.exec(xml)?.[1];
  if (ns !== "0") return;                       // articles only
  if (/<redirect /.test(xml)) return;
  const title = unxml(/<title>([^<]+)<\/title>/.exec(xml)?.[1] || "");
  if (!title) return;
  const m = /<text[^>]*>([\s\S]*?)<\/text>/.exec(xml);
  if (!m) return;
  const text = unxml(m[1]);

  // Page-level coordinates: {{geo|lat|long|...}}
  let plat = null, plng = null;
  const geo = /\{\{\s*geo\s*\|([^{}]*)\}\}/i.exec(text);
  if (geo) { const g = geo[1].split("|"); plat = num(g[0]); plng = num(g[1]); }

  // Walk listings, tracking the current == section == so See/Do context survives
  // even for bare {{listing}} templates.
  const counts = { see: 0, do: 0, listing: 0 };
  const sections = [...text.matchAll(/^==\s*([^=]+?)\s*==\s*$/gm)]
    .map((s) => ({ at: s.index, name: s[1] }));
  const sectionAt = (i) => { let cur = ""; for (const s of sections) { if (s.at > i) break; cur = s.name; } return cur; };

  let idx = 0;
  LISTING_RE.lastIndex = 0;
  let hit;
  while ((hit = LISTING_RE.exec(text))) {
    const start = hit.index;
    const end = templateEnd(text, start);
    if (end < 0) continue;                       // unbalanced — malformed page tail
    LISTING_RE.lastIndex = end;                  // never re-scan inside a listing
    const body = text.slice(start + 2, end - 2);
    const parts = splitParams(body);
    const tpl = parts[0].trim().toLowerCase();
    const kv = {};
    for (const p of parts.slice(1)) {
      const eq = p.indexOf("=");
      if (eq > 0) kv[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
    }
    // {{listing}} carries its kind in type=; default it into "listing" bucket.
    const type = tpl === "listing" ? (kv.type || "listing").toLowerCase() : tpl;
    if (!["see", "do", "listing"].includes(type)) continue;
    const name = plain(kv.name);
    if (!name) continue;                         // unnamed listings are unmappable
    counts[type] = (counts[type] || 0) + 1;
    listingCount++;
    listingsOut.write(JSON.stringify({
      page: title,
      section: sectionAt(start),
      idx: idx++,
      type,
      name,
      alt: plain(kv.alt) || undefined,
      lat: num(kv.lat), lng: num(kv.long ?? kv.lng),
      wikidata: (kv.wikidata || "").trim() || undefined,
      wikipedia: plain(kv.wikipedia) || undefined,
      address: plain(kv.address) || undefined,
      teaser: plain(kv.content).slice(0, 200) || undefined,
    }) + "\n");
  }

  if (counts.see + counts.do + counts.listing > 0) {
    destPages++;
    pagesOut.write(JSON.stringify({
      page: title, lat: plat, lng: plng, counts,
      isDistrict: title.includes("/"),
    }) + "\n");
  }
}

// ---- stream the dump: accumulate one <page> at a time -----------------------
let buf = "";
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  buf += line + "\n";
  if (line.includes("</page>")) {
    const s = buf.indexOf("<page>");
    if (s >= 0) processPage(buf.slice(s));
    buf = "";
    if (pageCount % 20000 === 0) console.error(`  ...${pageCount} pages, ${destPages} destinations, ${listingCount} listings`);
  }
  // A page with no </page> yet keeps accumulating; cap runaway memory just in case.
  if (buf.length > 30_000_000) buf = "";
});
rl.on("close", () => {
  listingsOut.end(); pagesOut.end();
  console.error(`DONE: ${pageCount} pages scanned, ${destPages} destination pages, ${listingCount} listings`);
});

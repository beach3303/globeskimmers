// The founder's PDF of the United States stamp list, printed from HTML by headless Chrome (2026-11-22):
//   node scripts/stamp-art/united-states/report.mjs            — the whole list
//   node scripts/stamp-art/united-states/report.mjs Tourist    — one kind only (Tourist | Novelty | Local)
// Reads list-2026-11-22.json, writes Globeskimmers-United-States[-<Kind>]-<N>-places.html/.pdf into "Claude outputs/".
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const DATE = "2026-11-22";
const KINDS = { Tourist: "Tourist landmarks", Novelty: "Novelty & roadside", Local: "Local favorites" };
const KIND = process.argv[2] ? process.argv[2][0].toUpperCase() + process.argv[2].slice(1).toLowerCase() : "";
if (KIND && !KINDS[KIND]) { console.error("kind must be one of", Object.keys(KINDS).join(" | ")); process.exit(1); }
const all = JSON.parse(fs.readFileSync(path.join(HERE, `list-${DATE}.json`), "utf8"));
// A single-kind list is numbered on its own, 1 … N, so it reads as a list in its own right.
const list = KIND ? all.filter((x) => x.kind === KIND).map((x, i) => ({ ...x, n: i + 1 })) : all;
const OUT = path.join(ROOT, "Claude outputs");
const base = `Globeskimmers-United-States-${KIND ? KIND + "-" : ""}${list.length}-places`;

// Novelty and Local carry almost no published counts: on a list with fewer than ten, the column goes and a count rides in the Note.
const SHOW_VIS = list.filter((x) => x.visitors).length >= 10;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const count = (f) => list.filter(f).length;
const tiles = [
  ...(KIND ? [] : [
    [count((x) => x.kind === "Tourist"), "Tourist landmarks"],
    [count((x) => x.kind === "Novelty"), "Novelty & roadside"],
    [count((x) => x.kind === "Local"), "Local favorites"],
  ]),
  [count((x) => x.status === "Stampable today"), "Stampable today"],
  [count((x) => x.status.startsWith("In the")), "In the database, not yet stampable"],
  [count((x) => x.status.startsWith("Not")), "Need a database row"],
  [count((x) => x.art && !x.shares), "Art on the server already"],
];
const regions = [...new Set(list.map((x) => x.region))];
const statusClass = (s) => (s.startsWith("Stampable") ? "ok" : s.startsWith("In the") ? "warn" : "no");

const rowsHtml = (rs) => rs.map((x) => `<tr>
<td class="n">${String(x.n).padStart(4, "0")}</td>
<td class="name">${esc(x.name)}</td>
<td>${esc(x.where)}</td>
<td>${esc(x.state)}</td>
${KIND ? "" : `<td class="kind ${x.kind.toLowerCase()}">${esc(x.kind)}</td>`}
<td>${esc(x.category)}</td>
${SHOW_VIS ? `<td class="vis">${esc(x.visitors)}</td>` : ""}
<td class="file">${esc(x.file)}</td>
<td class="${statusClass(x.status)}">${esc(x.status)}</td>
<td class="note">${[!SHOW_VIS && x.visitors ? esc(x.visitors) + " visitors" : "", x.art && !x.shares ? "art on the server" : x.shares ? `currently shares ${esc(x.shares)}` : ""].filter(Boolean).join(" · ")}</td>
</tr>`).join("\n");

const sections = regions.map((r) => {
  const rs = list.filter((x) => x.region === r);
  const states = [...new Set(rs.map((x) => x.stateName))].join(" · ");
  return `<tr class="region"><td colspan="${10 - (KIND ? 1 : 0) - (SHOW_VIS ? 0 : 1)}">${esc(r)} <span class="states">${esc(states)} · ${rs.length} places</span></td></tr>\n${rowsHtml(rs)}`;
}).join("\n");

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${base}</title>
<style>
@page { size: letter landscape; margin: 11mm 10mm 12mm; }
body { font: 8.6px/1.25 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 0; }
h1 { font-size: 20px; margin: 0 0 3px; } .sub { color: #555; font-size: 9px; margin: 0 0 8px; max-width: 1000px; }
.tiles { display: flex; gap: 6px; margin: 0 0 8px; flex-wrap: wrap; }
.tile { border: 1px solid #d8d2c4; border-radius: 5px; padding: 5px 9px; min-width: 96px; }
.tile b { display: block; font-size: 15px; } .tile span { color: #555; font-size: 8px; }
.legend { font-size: 8px; color: #555; margin: 0 0 8px; }
table { border-collapse: collapse; width: 100%; } th { background: #0E7C73; color: #fff; text-align: left; padding: 4px 5px; font-size: 8px; }
td { padding: 2.6px 5px; border-bottom: 1px solid #ece7dc; vertical-align: top; }
tr.region td { background: #FBF6EC; font-weight: 700; font-size: 9.5px; padding: 5px; border-top: 2px solid #0E7C73; }
.states { font-weight: 400; color: #555; font-size: 8px; margin-left: 8px; }
td.n { color: #777; font-family: ui-monospace, Menlo, monospace; } td.name { font-weight: 600; }
td.file { font-family: ui-monospace, Menlo, monospace; font-size: 7.6px; }
td.kind.tourist { color: #8A2A1B; font-weight: 700; } td.kind.novelty { color: #6A3D9A; font-weight: 700; } td.kind.local { color: #24316B; }
td.ok { color: #2E6B4E; } td.warn { color: #B36B00; } td.no { color: #B0472F; } td.vis { white-space: nowrap; color: #333; }
td.note { color: #555; font-family: ui-monospace, Menlo, monospace; font-size: 7.4px; }
thead { display: table-header-group; } tr { page-break-inside: avoid; }
.foot { color: #777; font-size: 7.5px; margin-top: 8px; }
</style></head><body>
<h1>The United States · ${KIND ? KINDS[KIND] + " · " : ""}${list.length} places to stamp</h1>
<p class="sub">${KIND === "Tourist" ? "The most visited places, by region, every state and D.C. The Visitors column is a published count where one exists — NPS recreation visits 2024, TEA/AECOM attendance 2023, or the operator's or city's own estimate — otherwise the place is listed by fame."
  : KIND === "Novelty" ? "Roadside America, by region, every state and D.C.: world's-largest things, oddball museums, mystery spots, and every Buc-ee's at the end."
  : KIND === "Local" ? "What locals send you to, by region, every state and D.C.: parks, markets, stadiums, institutions, swimming holes."
  : "By region, every state and D.C. In each region: <b>Tourist</b> (the most visited places; the Visitors column is a published count where one exists — NPS recreation visits 2024, TEA/AECOM attendance 2023, or the operator's or city's own estimate — otherwise listed by fame), then <b>Novelty</b> (roadside America, world's-largest things, oddball museums, mystery spots), then <b>Local</b> (what locals send you to)."}
 "File name" is exactly what the app looks for. "In the database" is checked against the live attractions database on ${DATE}; "art on the server" means a stamp file already answers to that name.${KIND ? ` This is the ${KINDS[KIND]} list on its own, numbered 1–${list.length}; the full list of ${all.length} places is Globeskimmers-United-States-${all.length}-places.pdf.` : ""}</p>
<div class="tiles">${tiles.map(([n, l]) => `<div class="tile"><b>${n}</b><span>${l}</span></div>`).join("")}</div>
<table><thead><tr><th>No.</th><th>Place</th><th>Where</th><th>State</th>${KIND ? "" : "<th>Kind</th>"}<th>Category</th>${SHOW_VIS ? "<th>Visitors</th>" : ""}<th>File name for the stamp</th><th>In the database</th><th>Note</th></tr></thead>
<tbody>${sections}</tbody></table>
<p class="foot">GlobeSkimmers · United States stamp list${KIND ? " · " + KINDS[KIND] : ""} · ${DATE} · ${list.length} places · scripts/stamp-art/united-states/</p>
</body></html>`;

fs.mkdirSync(OUT, { recursive: true });
const htmlPath = path.join(OUT, base + ".html");
fs.writeFileSync(htmlPath, html);
const pdfPath = path.join(OUT, base + ".pdf");
execFileSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${pdfPath}`, "file://" + htmlPath], { stdio: "ignore", timeout: 180000 });
console.log("wrote", pdfPath, Math.round(fs.statSync(pdfPath).size / 1024), "KB");

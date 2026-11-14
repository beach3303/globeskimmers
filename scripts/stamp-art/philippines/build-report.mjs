import fs from "node:fs";
const S = "/private/tmp/claude-501/-Users-lobster-Developer-globeskimmers/c1c5d61f-39a0-4429-b395-666ec626c732/scratchpad";
const { main: main0, ext: ext0 } = JSON.parse(fs.readFileSync(`${S}/ph-curated.json`, "utf8"));
const DEMOTE = new Set(["Paco Park","Marikina Shoe Museum","Las Piñas Bamboo Organ","Venice Grand Canal Mall","Ayala Triangle Gardens","Sky Ranch Tagaytay","Taal Heritage Town","Mount Maculot","Fortune Island","Lake Caliraya","Sampaloc Lake","Borawan Island","Treasure Mountain","Wawa Dam","Capones Island","Potipot Island","Ocean Adventure","Biak-na-Bato National Park","Betis Church","Mount Arayat","Capas National Shrine","Capisaan Cave","Baluarte Zoo","Plaza Salcedo","Bantay Abot Cave","Juan Luna Shrine","Ma-Cho Temple","Bahay na Bato","Enchanted Cave","Hapao Rice Terraces","Bomod-ok Falls","Maligcong Rice Terraces","Baguio Cathedral","Mount Ulap","Anguib Beach","Tumauini Church","House of Dakay","Chawa View Deck","Hoyop-Hoyopan Cave","Misibis Bay","Bagasbas Beach","Subic Beach Matnog","Shimizu Island","Matinloc Shrine","Siete Pecados","Maquinit Hot Springs","Bonbon Beach","Diniwid Beach","Bulabog Beach","Bakhawan Eco-Park","Roxas City Baybay Beach","Danjugan Island","Trappist Monastery","Colon Street","Casa Gorordo Museum","Heritage of Cebu Monument","Aguinid Falls","Inambakan Falls","Mantayupan Falls","Dumaluan Beach","Cabagnow Cave Pool","Danao Adventure Park","Loboc Church","Pamilacan Island","Pulangbato Falls","Santo Niño Shrine and Heritage Museum","Calbiga Caves","Sogod Bay","Walkway to the Old Volcano","Del Monte Pineapple Plantation","Mount Kitanglad","Tayangban Cave Pool","Mabua Pebble Beach","Davao Crocodile Park"]);
const BEYOND = new Set(["Chinese Cemetery","Greenhills Shopping Center","Manila Hotel","Ninoy Aquino Parks and Wildlife Center","Twin Lakes Tagaytay","Tagaytay Highlands","Lipa Cathedral","Matabungkay Beach","Verde Island Passage","Mount Talamitam","Island Cove","Tagaytay Picnic Grove Zipline","Majayjay Falls","Paete Woodcarving Town","Liliw","Nuvali","Tayabas Basilica","Dampalitan Island","Angono Petroglyphs","Mount Pamitinan","Calinawan Cave","Mount Purro Nature Reserve","Crystal Beach Resort","Mount Tapulao","Dunsulan Falls","Bataan Death March Kilometer Zero","Five Fingers Cove","Pulilan Carabao Festival","Malolos Cathedral","Holy Rosary Parish Angeles","Aqua Planet","Puning Hot Spring","Aquino Center and Museum","Pantabangan Dam","Baler Church","Diguisit Falls","Ermita Hill","Aglipay Caves","Crisologo Museum","Hidden Garden Vigan","Pagburnayan Pottery","Pinsal Falls","Tirad Pass","St. William Cathedral Laoag","Fort Ilocandia","Dos Hermanos Islands","Hannah's Beach Resort","Pindangan Ruins","Poro Point Lighthouse","Immuki Island","Cabongaoan Beach","Lingayen Gulf Landing","Dasol Salt Farms","Bangaan Village","Bontoc Museum","Marlboro Hills Sagada","Lake Danum","Chico River","Kaparkan Falls","Philippine Military Academy","Diplomat Hotel Ruins","Good Shepherd Convent","Valley of Colors","Mount Yangbew","Ambuklao Dam","Mount Kabuyao","Tuguegarao Cathedral","Magat Dam","Ilagan Sanctuary","Dalton Pass","Alapad Rock Formation","Diura Fishing Village","Homoron Blue Lagoon","Tayid Lighthouse","Sabtang Lighthouse","Dipnaysupuan Japanese Tunnel","Itbayat Island","Mayon Skyline","Legazpi Boulevard","Vera Falls","Naga Metropolitan Cathedral","Mount Isarog","Daet Rizal Monument","Rizal Beach Gubat","Paguriran Island","Buntod Reef Sandbar","Bato Church Catanduanes","Maribina Falls","Baker's Hill","Mitra's Ranch","Iwahig Firefly Watching","Nagtabon Beach","Plaza Cuartel","Taraw Cliff","Lio Beach","Duli Beach","Pass Island","Black Island","Pamuayan Falls","Punta Sebaring","Fort Santa Isabel","Linapacan","Sabang Beach Puerto Galera","Mount Halcon","Pandan Island","Tukuran Falls","Boac Cathedral","Tres Reyes Islands","Bathala Caves","Poctoy White Beach","Mount Malindig","Mount Guiting-Guiting","Tiamban Beach","Cobrador Island","Carabao Island","Fort San Andres","Ilig-Iligan Beach","D'Mall","Jawili Falls","Nabaoy River","Camiña Balay nga Bato","Museo Iloilo","Nelly Garden","San Joaquin Campo Santo","Nadsadjan Falls","Sicogon Island","Bucari Pine Forest","Nogas Island","Seco Island","Bugang River","Pan-ay Church","Olotayan Island","Capitol Park and Lagoon","Punta Ballo Beach","Tinagong Dagat","Don Salvador Benedicto","Carbin Reef","Mountain View Nature Park","Nalusuan Island","Caohagan Island","Casino Peak","Argao Church","Carcar Heritage","Hermit's Cove","Bojo River","Panagsama Beach","White Beach Basdaku","Kota Beach","Ogtong Cave","Bounty Beach","Lake Danao Camotes","Timubo Cave","Capitancillo Islet","Carnaza Island","Dauis Church","Cadapdapan Rice Terraces","Mag-Aso Falls","Lamanok Island","Chocolate Hills Adventure Park","Panglao Church","Capilay Spring Park","Cantabon Cave","St. Francis of Assisi Church Siquijor","Mount Bandilaan","Forest Camp","Lake Balanan","Niludhan Falls","Mount Talinis","Santo Niño Church Tacloban","Tinago Falls Biliran","Ulan-Ulan Falls","Guiuan Church","Lulugayan Falls","Pinipisakan Falls","Agas-Agas Bridge","Tangkaan Beach","Santo Niño Cold Spring","Tuasan Falls","Giant Clam Sanctuary","Taguines Lagoon","Macahambus Cave","Mount Dulang-Dulang","Communal Ranch Impasug-ong","Mimbalot Falls","Timoga Springs","Dolphin Island","Cotta Fort Ozamiz","Hoyohoy Highland Park","Kawhagan Island","Pamomoan Beach","Corregidor Island Siargao","Cagwait White Beach","Day-asan Floating Village","Lake Mainit","Islander's Castle","D' Bone Collector Museum","Japanese Tunnel Davao","Pujada Island","Awao Falls","Lake Agco","Baras Bird Sanctuary","Sarangani Bay","Kutawato Caves","Sunset Boulevard Dipolog","Linabo Peak","Pulacan Falls","Dao-Dao Islands","Aliguay Island","Tawi-Tawi Provincial Capitol"]);
const top = main0.filter((r) => !DEMOTE.has(r.name));
const next = [...main0.filter((r) => DEMOTE.has(r.name)), ...ext0.filter((r) => !BEYOND.has(r.name))];
const beyond = ext0.filter((r) => BEYOND.has(r.name));
const missing = [...DEMOTE].filter((n) => !main0.some((r) => r.name === n)); const missingB = [...BEYOND].filter((n) => !ext0.some((r) => r.name === n));
console.log("top:", top.length, "next:", next.length, "beyond:", beyond.length, "| names not found:", [...missing, ...missingB].join(", ") || "none");

// ── match against the database and the art ──
const rows = JSON.parse(fs.readFileSync(`${S}/ph-rows.json`, "utf8"));
const art = new Set(JSON.parse(fs.readFileSync(`${S}/art-keys.json`, "utf8")).map((a) => a.slug));
const grab = (file, name) => { const t = fs.readFileSync(file, "utf8"); const i = t.indexOf(name + " = {"); if (i < 0) return {}; let d = 0, j = i + name.length + 3; for (; j < t.length; j++) { if (t[j] === "{") d++; else if (t[j] === "}") { d--; if (d === 0) break; } } return new Function("return " + t.slice(i + name.length + 3, j + 1))(); };
const R = "/Users/lobster/Developer/globeskimmers/";
const ALIAS = grab(R + "src/lib/stampArt.js", "ALIAS"), ART_ALIAS = grab(R + "src/lib/stampArtIndex.js", "ART_ALIAS"), BY_ID = grab(R + "src/lib/stampArtIndex.js", "ART_BY_ID");
const slug = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\([^)]*\)/g, " ").toLowerCase().replace(/[\x27’]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const norm = (s) => slug(s).replace(/-/g, " ");
const STOP = new Set(["the","of","and","de","del","la","el","na","ng","island","islands","beach","falls","church","park","national","mount","mt","lake","cave","city","san","santa","santo","sto"]);
const words = (s) => norm(s).split(" ").filter((w) => w && !STOP.has(w));
const stampable = (r) => (r.tier === "secret" || ["world", "national", "regional"].includes(r.founder_scope || r.scope)) && r.class_ban !== "duplicate";
function match(place) {
  const n = norm(place.name), w = words(place.name);
  const whereN = norm(place.where + " " + place.province);
  let best = null, bestScore = 0;
  for (const r of rows) {
    const rn = norm(r.name); if (!rn) continue;
    let score = 0;
    if (rn === n) score = 100;
    else if (rn.includes(n) || n.includes(rn)) score = 70;
    else { const rw = words(r.name); const hit = w.filter((x) => rw.includes(x)).length; if (w.length && hit === w.length) score = 60; else if (hit >= 2 && hit >= w.length - 1) score = 45; }
    if (!score) continue;
    // A row that says MORE than the place (Baldomero Aguinaldo Shrine, SM Mall of Asia Globe, the Circle's zipline)
    // is a different thing: every extra word costs.
    const extra = words(r.name).filter((x) => !w.includes(x)).length; score -= 10 * extra;
    if (score < 100 && rn.length && n.length && Math.min(rn.length, n.length) / Math.max(rn.length, n.length) < 0.6) score -= 10;
    const city = norm(r.city || ""); if (city && whereN.includes(city.split(" ")[0]) && city.split(" ")[0].length > 3) score += 10;
    if (stampable(r)) score += 8; if (String(r.id).startsWith("icon:")) score += 6; if (r.class_ban === "duplicate") score -= 30;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore >= 55 ? { row: best, score: bestScore } : { row: null, score: 0 };
}
// The art a place would wear today: its own file, else (for a sure match) the file its database row resolves to.
const artFor = (place, row, score) => {
  const s = slug(place.name);
  if (art.has(s)) return { art: s, shared: false };
  if (row && score >= 70) { const rs = slug(row.name); const a = BY_ID[row.id] || ALIAS[rs] || ART_ALIAS[rs] || rs; if (art.has(a)) return { art: a, shared: a !== s }; }
  return null;
};
// Matches a human read as wrong or unsure (2026-11-13): these places get their own rows instead.
const NO_MATCH = new Set(["Aguinaldo Shrine","SM Mall of Asia","Quezon Memorial Circle","Subic Bay","Santa Maria Church","San Juan Surf Town","Cape Bolinao Lighthouse","Batad Rice Terraces","Mount Pulag","The Ruins","Apo Island","Twin Lakes Balinsasayao","Silliman University","Rizal Shrine Dapitan","Old Enchanted Balete Tree","Puerto Galera White Beach","San Sebastian Cathedral Bacolod"]);
const enrich = (list) => list.map((p) => {
  const m = NO_MATCH.has(p.name) ? { row: null, score: 0 } : match(p); const { row, score } = m; const a = artFor(p, row, score);
  const status = !row ? "Missing — needs a database row" : stampable(row) ? "Stampable today" : "Exists — needs promotion";
  return { ...p, file: slug(p.name) + ".png", art: a ? (a.shared ? `shares ${a.art}.png` : a.art + ".png") : "", status, dbName: row ? row.name : "", dbId: row ? row.id : "", dbScope: row ? (row.founder_scope || row.scope) : "" };
});
const out = { top: enrich(top), next: enrich(next), beyond: enrich(beyond) };
const tally = (l) => ({ n: l.length, stampable: l.filter((x) => x.status.startsWith("Stampable")).length, exists: l.filter((x) => x.status.startsWith("Exists")).length, missing: l.filter((x) => x.status.startsWith("Missing")).length, art: l.filter((x) => x.art).length, W: l.filter((x) => x.tier === "W").length, N: l.filter((x) => x.tier === "N").length, R: l.filter((x) => x.tier === "R").length });
console.log("top:", JSON.stringify(tally(out.top))); console.log("next:", JSON.stringify(tally(out.next))); console.log("beyond:", JSON.stringify(tally(out.beyond)));
console.log("\nTop 300 that already have art:"); console.log(out.top.filter((x) => x.art).map((x) => x.name + " → " + x.art).join("\n"));
console.log("\nAll matched rows (top 300), for a sanity read:"); for (const x of out.top.filter((y) => y.dbName)) console.log(` ${x.name} → ${x.dbName} [${x.dbId}] ${x.status.split(" ")[0]}`);
fs.writeFileSync(`${S}/ph-report.json`, JSON.stringify(out));

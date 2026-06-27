# FIX: Flag Home Card + Places to Eat (iPad) — for Claude Code

Two screens you built don't match the approved design. Below is exactly what's
wrong and the **exact CSS + markup to drop in**. Source of truth is
`iPad App Redesign.html` (frames "Home · Flag Active" and "Places to Eat · iPad").

Tokens used below (already in the design): `--serif:"Instrument Serif",Georgia,serif`,
`--sans:"Inter Tight",system-ui,sans-serif`, `--mono:"JetBrains Mono",monospace`,
`--card:#FFFFFF`, `--ink:#16110D`, `--ink2:#3A3128`, `--ink3:#736657`,
`--ivory2:#EFE8D9`, `--teal:#0E6E66`, `--rule:rgba(22,17,13,.10)`,
`--c-eat:#D8443C`, `--c-weather:#E0922F`.

---

## 1. FLAG HOME CARD — what's broken

Your build renders the home flag as a **giant centered circle** (the Japan red
disc blown up to ~600px) sitting *on top of* the greeting, covering "Oliver, in
Arcadia." That's a flag **emoji/icon** being scaled huge.

**The approved design never shows a flag circle.** The flag is the full,
rectangular flag image used as a **`background-size:cover` backdrop behind the
whole welcome card**, with a dark scrim gradient so the white serif name reads on
top. Think magazine cover, not a sticker.

### Rules
- Flag = rectangular country flag (SVG/PNG), set as `background-image` on a
  full-bleed layer with `background-size:cover; background-position:center`.
- **Never** render the flag emoji, never `border-radius:50%`, never center a
  blown-up disc. No circle anywhere.
- Always lay a scrim gradient over it (top transparent → bottom dark) so text contrasts.
- Name is white serif; the city accent word is gold `#FFD9A0` italic.
- A small frosted "Home flag · {Country}" chip sits top-left.

### CSS
```css
.greet.flag{position:relative;padding:0;overflow:hidden;min-height:400px;
  display:flex;align-items:flex-end;border-radius:30px;border:1px solid rgba(0,0,0,.06)}
.greet.flag .flagimg{position:absolute;inset:0;width:100%;height:100%;
  background-size:cover;background-position:center}            /* ← rectangular flag, COVER */
.greet.flag .flagscrim{position:absolute;inset:0;background:
  linear-gradient(180deg,rgba(8,10,14,0) 24%,rgba(8,10,14,.42) 62%,rgba(8,10,14,.80) 100%),
  linear-gradient(102deg,rgba(8,10,14,.46) 0%,rgba(8,10,14,0) 55%)}
.greet.flag .flagsheen{position:absolute;inset:0;mix-blend-mode:soft-light;
  background:linear-gradient(120deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,0) 30%)}
.greet.flag .flagcontent{position:relative;padding:46px 48px 38px;width:100%}
.greet.flag .kick{font-family:var(--mono);color:rgba(255,255,255,.88)}
.greet.flag .gname{font-family:var(--serif);font-weight:400;font-size:96px;
  line-height:.94;letter-spacing:-.02em;margin:10px 0 0;color:#fff;
  text-shadow:0 2px 28px rgba(0,0,0,.35)}
.greet.flag .gname em{color:#FFD9A0;font-style:italic}
.greet.flag .greetmeta{display:flex;align-items:center;justify-content:space-between;
  gap:18px;margin-top:30px;padding-top:28px;border-top:1px solid rgba(255,255,255,.28)}
.greet.flag .gmeta2{font-size:22px;color:rgba(255,255,255,.92);display:flex;gap:20px;align-items:center}
.greet.flag .locpill{display:inline-flex;align-items:center;gap:10px;border-radius:999px;
  padding:13px 22px;font-size:22px;font-weight:500;color:#fff;background:rgba(255,255,255,.16);
  border:1px solid rgba(255,255,255,.30);backdrop-filter:blur(12px)}
.greet.flag .locpill a{color:#FFD9A0}
.flagchip{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:9px 18px;
  font-size:18px;font-weight:600;color:#fff;background:rgba(255,255,255,.18);
  border:1px solid rgba(255,255,255,.32)}
```

### Markup
```html
<div class="greet flag">
  <div class="flagimg" style="background-image:url('FLAG_URL_FOR_HOME_COUNTRY')"></div>
  <div class="flagscrim"></div>
  <div class="flagsheen"></div>
  <div class="flagcontent">
    <span class="flagchip">Home flag · Japan</span>
    <div class="kick">Hello 👋</div>
    <h1 class="gname">Oliver, in <em>Arcadia</em></h1>
    <div class="greetmeta">
      <div class="gmeta2"><span>Fri, Jun 26</span><span>·</span><span>4:20 PM</span><span>·</span><span>☁ 80°F</span></div>
      <span class="locpill">📍 Arcadia · <a>Change</a></span>
    </div>
  </div>
</div>
```
`FLAG_URL_FOR_HOME_COUNTRY` = the rectangular flag asset (e.g. a 3:2 SVG). When no
flag is set, fall back to the plain `.greet` white card (no flag layer at all).

### Flag image source — flagcdn.com (free, no API key, public domain)

Rectangular flags by ISO 3166-1 **alpha-2** country code (lowercase). 3:2 ratio,
which is exactly what `background-size:cover` wants.

- **PNG (recommended for the cover backdrop):** `https://flagcdn.com/w1280/{cc}.png`
  → e.g. Japan `https://flagcdn.com/w1280/jp.png`, USA `https://flagcdn.com/w1280/us.png`,
  France `fr`, Mexico `mx`. Widths available: `w320 w640 w1280 w2560` — use `w1280` for the card.
- **SVG (crisp at any size):** `https://flagcdn.com/{cc}.svg` → `https://flagcdn.com/jp.svg`

Build the URL from the home country:
```js
// homeCountryCode is the ISO alpha-2 code you already store for the home flag
const flagUrl = `https://flagcdn.com/w1280/${homeCountryCode.toLowerCase()}.png`;
// then: flagEl.style.backgroundImage = `url('${flagUrl}')`;
```

If you'd rather bundle the assets (offline / no external fetch), the same flags are
in the npm package **`flag-icons`** (`/flags/4x3/{cc}.svg`) — vendor those SVGs and
point the URL at your local copy. Either way the markup is identical; only the URL changes.

**Note on Japan:** the spec's placeholder chip said "🇭🇵" — that's not a real flag.
Japan is `jp` → `https://flagcdn.com/w1280/jp.png`. The red disc you saw blown up
was that emoji being scaled; with the rectangular PNG as a cover backdrop the whole
problem disappears.

---

## 2. PLACES TO EAT — what's broken

Your build is a **narrow single column of default-iOS rows** floating on a wide
iPad, with cramped text and tiny system fonts. The approved design is a stack of
**full-width editorial restaurant cards**: a large 420px photo with a rank badge
and a "Dish Specialist" tag, then a serif name, a Say-it/Translate/rating row,
pill tags, a green "Open" bar, a blue phone bar, and three action buttons.

### CSS
```css
.ecards{display:flex;flex-direction:column;gap:30px}
.rcard{background:var(--card);border-radius:28px;overflow:hidden;
  box-shadow:0 24px 50px -30px rgba(22,17,13,.4)}
.rcard .rphoto{position:relative;width:100%;height:420px}
.rcard .rphoto .photo{width:100%;height:100%;object-fit:cover;display:block}
.rcard .rphoto .rank{position:absolute;top:22px;left:22px;width:48px;height:48px;
  border-radius:50%;background:var(--c-weather);color:#fff;display:flex;
  align-items:center;justify-content:center;font-size:24px;font-weight:700}
.rcard .rphoto .tag{position:absolute;top:22px;right:22px;background:rgba(255,255,255,.94);
  color:#2E7D46;border-radius:999px;padding:10px 18px;font-size:18px;font-weight:600}
.rcard .rbody{padding:30px 34px 34px}
.rcard .rkick{color:var(--c-eat);font-weight:600;font-size:19px}
.rcard .rname{font-family:var(--serif);font-size:42px;line-height:1.02;margin:6px 0 0}
.rcard .rsub{display:flex;gap:18px;align-items:center;margin-top:14px;font-size:20px;color:var(--ink3)}
.rcard .rsub a{color:var(--teal);text-decoration:underline}
.tagset{display:flex;gap:12px;margin-top:18px;flex-wrap:wrap}
.tg2{border-radius:999px;padding:10px 18px;font-size:18px;font-weight:600}
.tg2.din{background:#EAF0FB;color:#2E6FE0}.tg2.res{background:#FBE0DC;color:#C2392F}
.openbar{margin-top:20px;background:#E7F3EA;border-radius:16px;padding:18px 22px;
  font-size:20px;color:#2E7D46;font-weight:600;display:flex;align-items:center;gap:12px}
.phonebar{margin-top:16px;background:#EFF4FB;border-radius:16px;padding:20px 22px;
  display:flex;align-items:center;gap:16px}
.phonebar .pn{font-size:22px;font-weight:600;color:#2E6FE0}
.phonebar .ps{font-size:17px;color:var(--ink3)}
.ractions{display:flex;gap:14px;margin-top:22px}
.btn{flex:1;border-radius:16px;padding:16px;font-size:20px;font-weight:600;text-align:center}
.btn.primary{background:var(--c-eat);color:#fff}
.btn.ghost{background:var(--ivory2);color:var(--ink2)}
```

### Markup (one card; repeat per restaurant)
```html
<div class="ecards">
  <div class="rcard">
    <div class="rphoto">
      <img class="photo" src="RESTAURANT_PHOTO_URL" alt="">
      <div class="rank">1</div>
      <div class="tag">✓ Dish Specialist</div>
    </div>
    <div class="rbody">
      <div class="rkick">American Restaurant</div>
      <h3 class="rname">Longitude 118</h3>
      <div class="rsub"><a>🔊 Say it</a><a>🌐 Translate</a><span>★ 4.6 (10)</span><span>· 275 ft</span></div>
      <div class="tagset"><span class="tg2 din">🍴 Dine-in</span><span class="tg2 res">📅 Reservable</span></div>
      <div class="openbar">● Open · 6:30 AM – 11:00 PM</div>
      <div class="phonebar"><span style="font-size:26px">📞</span><div><div class="pn">(626) 412-8683</div><div class="ps">Tap to call</div></div></div>
      <div class="ractions"><div class="btn primary">Directions</div><div class="btn ghost">📍 Map</div><div class="btn ghost">More ▾</div></div>
    </div>
  </div>
  <!-- next .rcard … -->
</div>
```

### Header above the cards (pill, city card, distance chips, toolbar)
```html
<div class="finderhead">
  <span class="fpill eat">🍽️ Places to Eat</span>
  <div class="citycard eat">
    <div><div class="ck">City</div><div class="cn">Across Arcadia</div></div>
    <span class="change">Change</span>
  </div>
  <div class="chips">
    <span class="chip on eat">5 mi</span><span class="chip">10 mi</span>
    <span class="chip">15 mi</span><span class="chip">25 mi</span>
    <span style="margin-left:auto"></span>
    <span class="chip unit on">MI</span><span class="chip unit">KM</span>
  </div>
  <div class="toolbar">
    <div class="filterbar"><span>⚙ Advanced Filters</span><span style="color:var(--ink3)">72 results · 61 open ▾</span></div>
    <div class="viewtog"><button class="on" style="background:var(--c-eat);color:#fff">List</button><button>Map</button></div>
  </div>
</div>
```
Supporting CSS for the header is in `iPad App Redesign.html` lines 96–117 (`.fpill`,
`.citycard`, `.chip`, `.toolbar`, `.filterbar`, `.viewtog`) — copy as-is.

---

## 3. iPad layout note (why yours looked cramped)

On iPad the content column should be a **single centered column ~1024px wide** with
generous padding — not a phone-width column stranded on a huge canvas. The cards
go full-width within that column. Keep `padding-bottom:170px` on the scroll area so
the floating pill nav never covers the last card.

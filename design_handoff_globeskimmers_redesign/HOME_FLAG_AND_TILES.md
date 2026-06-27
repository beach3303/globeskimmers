# Home — Flag Greeting + Font-Scaling Tile Fix (for Claude Code)

Two changes for `Home.jsx` (React + Tailwind). Both are UI-only — no backend/logic changes.

---

## 1) Flag-background greeting card (the chosen direction)

When the user has a home country set, the greeting card becomes a **landscape (3:2) card with that country's full flag as the background**, "Oliver, in *Lisbon*" in white over a scrim, a country pill, and the location/weather chips on frosted-glass tiles. Ship the **BOLD** treatment (full-opacity flag) — that's the one approved — but the component supports `subtle` / `medium` / `bold` if you want a Settings toggle later.

Flag image: `https://flagcdn.com/w640/{cc}.png` (cc lowercased), `object-fit: cover`. Use `object-position:center` for flags with a central emblem (Japan, etc.) and `left center` otherwise.

```jsx
// FlagGreetingCard.jsx  — drop into Home, render when a home country is set
const LEVELS = {
  subtle: { flagOpacity:0.35, dim:0,    surface:"rgba(255,253,247,.55)", blur:"blur(8px) saturate(140%)",
            text:"#0F1419", subtext:"#475569", accent:"#0E7C73", pillBg:"rgba(15,20,25,.08)", pillText:"#0F1419",
            cardBg:"rgba(255,255,255,.62)", cardText:"#0F1419", border:"1px solid rgba(15,20,25,.08)", shadow:false },
  medium: { flagOpacity:0.7,  dim:0.55, surface:"transparent", blur:"none",
            text:"#fff", subtext:"rgba(255,255,255,.85)", accent:"#FFE7A3", pillBg:"rgba(255,255,255,.22)", pillText:"#fff",
            cardBg:"rgba(0,0,0,.32)", cardText:"#fff", border:"1px solid rgba(255,255,255,.16)", shadow:true },
  bold:   { flagOpacity:1,    dim:0.7,  surface:"transparent", blur:"none",
            text:"#fff", subtext:"rgba(255,255,255,.9)", accent:"#FFE7A3", pillBg:"rgba(255,255,255,.24)", pillText:"#fff",
            cardBg:"rgba(0,0,0,.38)", cardText:"#fff", border:"1px solid rgba(255,255,255,.16)", shadow:true },
};

export function FlagGreetingCard({
  cc = "US", level = "bold", name = "Oliver", city = "Lisbon",
  area = "Praça do Comércio", temp = "61°F", accentColor = "#B22234", centeredFlag = false,
}) {
  const c = LEVELS[level];
  const fade = `linear-gradient(180deg, rgba(0,0,0,${c.dim*0.4}) 0%, rgba(0,0,0,${c.dim}) 100%)`;
  return (
    <div style={{ position:"relative", borderRadius:22, overflow:"hidden", aspectRatio:"3 / 2",
      boxShadow:"0 14px 30px -14px rgba(15,20,25,.18), 0 0 0 1px rgba(15,20,25,.04)" }}>
      {/* flag */}
      <img src={`https://flagcdn.com/w640/${cc.toLowerCase()}.png`} alt="" draggable={false}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
          objectPosition: centeredFlag ? "center" : "left center", opacity:c.flagOpacity }} />
      {c.dim > 0 && <div style={{ position:"absolute", inset:0, background:fade }} />}
      {/* content */}
      <div style={{ position:"relative", zIndex:2, height:"100%", display:"flex", flexDirection:"column",
        justifyContent:"space-between", padding:"16px 18px",
        background:c.surface, backdropFilter:c.blur, WebkitBackdropFilter:c.blur }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:"0.9rem", color:c.subtext, fontWeight:500 }}>Hello 👋</div>
            <div style={{ fontSize:"1.9rem", fontWeight:800, color:c.text, letterSpacing:"-.018em",
              lineHeight:1.05, marginTop:2, textShadow:c.shadow?"0 2px 12px rgba(0,0,0,.25)":"none" }}>
              {name}, in <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:"italic",
                color:c.accent, fontWeight:400 }}>{city}</span>
            </div>
          </div>
          <div style={{ flex:"none", padding:"5px 11px", borderRadius:999, background:c.pillBg, color:c.pillText,
            fontSize:"0.72rem", fontWeight:700, display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap",
            backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)" }}>
            <span style={{ width:14, height:10, borderRadius:2, background:accentColor, display:"inline-block" }} />
            {cc} · home
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ flex:1, minWidth:0, padding:"10px 12px", borderRadius:12, background:c.cardBg, color:c.cardText,
            backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", border:c.border,
            display:"flex", alignItems:"center", gap:10 }}>
            <PinIcon style={{ flex:"none" }} color={c.accent}/>
            <span style={{ flex:1, fontSize:"0.82rem", fontWeight:600, whiteSpace:"nowrap",
              overflow:"hidden", textOverflow:"ellipsis" }}>{area}</span>
          </div>
          <div style={{ flex:"none", padding:"10px 12px", borderRadius:12, background:c.cardBg, color:c.cardText,
            backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", border:c.border,
            display:"flex", alignItems:"center", gap:8, fontSize:"0.8rem", fontWeight:600, whiteSpace:"nowrap" }}>
            <CloudIcon color={c.accent}/> {temp}
          </div>
        </div>
      </div>
    </div>
  );
}
```
- Render `<FlagGreetingCard cc={user.homeCountry} .../>` when `user.homeCountry` is set; otherwise the plain white greeting card.
- `accentColor` = the country's flag accent (used for the little swatch in the pill).
- `centeredFlag` = true for flags with a central emblem (JP, BD, etc.) so the emblem isn't cropped.

---

## 2) Fix: tile labels clipped at large font sizes — reflow columns, don't wrap

**Problem:** at increased system font size, "Convenience store" → "Convenier store" and "Nearby Restaurants" → "Restaurant" get cut off.

**What we want (per design direction):** keep each label on **one line** and instead **change the number of boxes per row** — 4-up at default text, collapsing to **2-up bigger boxes** (Things-to-do style) as the font grows. No cramped multi-line wrapping.

### The approach: reflow the columns, don't wrap the text

We do **NOT** wrap the labels. Instead the grid is **responsive to text size** — it fits as many columns as will hold a full-width label, so:

- **Default font** → **4 tiles per row** (compact, like today)
- **Larger font** → automatically drops to **3, then 2 per row** — each box gets **wider and chunkier** (like the Things-to-do cards), and the label stays on **one line**.

The trick is a single auto-fitting grid whose minimum column width is set in **`em`** (which scales with the user's font size). When text grows, each column's minimum grows, so fewer columns fit and the boxes enlarge — exactly the behaviour you asked for. Labels keep `white-space: nowrap`.

```jsx
// CategoryTile.jsx — single-line label, box grows to fit
export function CategoryTile({ icon, label, ink, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative flex aspect-square flex-col justify-between
                 overflow-hidden rounded-2xl p-3 text-left text-white"
      style={{ background: ink, boxShadow: `0 8px 20px -12px ${ink}` }}
    >
      <span className="pointer-events-none absolute -right-3 -top-3 h-12 w-12 rounded-full bg-white/15" />
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20">{icon}</span>
      {/* one line — never wraps, never clips, because the BOX widens to fit */}
      <span className="mt-2 whitespace-nowrap text-[0.95rem] font-bold leading-tight">
        {label}
      </span>
    </button>
  );
}
```

### One responsive grid (replaces the separate 3-up + 4-up rows)
```jsx
// 8.5em min ≈ enough for the longest label ("Convenience Store") on one line.
// Default text → 4 cols; bumped-up text → 3 → 2 cols automatically.
<div
  className="grid gap-2.5"
  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(8.5em, 1fr))" }}
>
  <CategoryTile icon={<Bus/>}    label="Transit Info"        ink="#3F49D4" />
  <CategoryTile icon={<Fork/>}   label="Nearby Restaurants"  ink="#E63946" />
  <CategoryTile icon={<Coffee/>} label="Coffee Shop Finder"  ink="#A85A2E" />
  <CategoryTile icon={<Card/>}   label="ATM Finder"          ink="#1F5BD6" />
  <CategoryTile icon={<Rest/>}   label="Restroom Finder"     ink="#0E8A7C" />
  <CategoryTile icon={<Store/>}  label="Convenience Store"   ink="#15803D" />
  <CategoryTile icon={<Sun/>}    label="Weather"             ink="#D4861A" />
</div>
```

**Tuning the breakpoints**
- The `8.5em` min controls everything. **Larger value → fewer columns / bigger boxes sooner.** Try `8em`–`10em` to taste.
- Want to *guarantee* it never goes below 2-up even at the largest setting? Clamp it: `minmax(min(8.5em, 45%), 1fr)` (the `45%` floor keeps at least 2 per row).
- `aspect-square` keeps the chunky look; as boxes widen at larger text they also get taller, staying proportional like the Things-to-do cards.

**Belt-and-suspenders:** for the two longest labels you can also shorten them so they fit even sooner — e.g. **"Restaurants"** and **"Convenience"** — but with the responsive grid above it isn't required.

> Do NOT use `truncate`, `line-clamp`, a fixed `grid-cols-4`, or a fixed pixel height — those are what cause the clipping. The label stays `whitespace-nowrap`; the **grid** does the adapting.

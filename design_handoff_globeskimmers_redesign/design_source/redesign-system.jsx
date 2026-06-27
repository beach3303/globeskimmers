// redesign-system.jsx — tokens, icons, shared bits

// Category color system — each finder gets its own world.
// Ink + bg pair, plus a "wash" for soft fills.
const CAT = {
  food:     { name:"Food",        ink:"#A33E1F", bg:"#FFE6D6", wash:"#FFD6BD", glyph:"🍜" },
  coffee:   { name:"Coffee",      ink:"#704018", bg:"#F4E0C8", wash:"#E8C99E", glyph:"☕" },
  money:    { name:"Money",       ink:"#13502E", bg:"#D9EBDF", wash:"#BFDEC8", glyph:"$¥€" },
  atm:      { name:"ATM",         ink:"#1B4E8F", bg:"#DCE9F8", wash:"#BFD6F0", glyph:"💳" },
  transit:  { name:"Transit",     ink:"#26408A", bg:"#DDE3F5", wash:"#B8C5EC", glyph:"🚇" },
  restroom: { name:"Restroom",    ink:"#0A5752", bg:"#D6E9E6", wash:"#B0D7D2", glyph:"🚻" },
  weather:  { name:"Weather",     ink:"#2A6F94", bg:"#DDEAF3", wash:"#B6D2E3", glyph:"☀️" },
  todo:     { name:"Things to do",ink:"#9F3E22", bg:"#FBE0D2", wash:"#F6C5AE", glyph:"✦" },
  shopping: { name:"Shopping",    ink:"#6B3478", bg:"#EFE0F2", wash:"#E0C2E8", glyph:"🛍" },
  phrases:  { name:"Phrases",     ink:"#8E6E1F", bg:"#F5EBC9", wash:"#EBD89A", glyph:"あ" },
  culture:  { name:"Culture",     ink:"#5A3A1F", bg:"#EFE0CC", wash:"#E2CBA8", glyph:"⌘" },
  convenience:{ name:"24h Store", ink:"#4A621E", bg:"#E6ECCF", wash:"#D2DDA4", glyph:"⏱" },
};

// ─── tiny icon set ─────────────────────────────────────────────────────────
const I = ({ name, size = 20, color = "currentColor", w = 1.6 }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "pin":     return <svg {...p}><path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case "search":  return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "map":     return <svg {...p}><path d="m3 7 6-3 6 3 6-3v14l-6 3-6-3-6 3z"/><path d="M9 4v17M15 7v17"/></svg>;
    case "list":    return <svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>;
    case "filter":  return <svg {...p}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>;
    case "bookmark":return <svg {...p}><path d="M6 4h12v16l-6-4-6 4z"/></svg>;
    case "home":    return <svg {...p}><path d="m3 11 9-8 9 8v9H3z"/><path d="M9 20v-5h6v5"/></svg>;
    case "saved":   return <svg {...p}><path d="M5 4h14v17l-7-4-7 4z"/></svg>;
    case "settings":return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "compass": return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="m15 9-4 1.5L9.5 14l4-1.5L15 9Z" fill={color} stroke="none" opacity=".9"/></svg>;
    case "fork":    return <svg {...p}><path d="M7 3v8a2 2 0 0 0 2 2v8"/><path d="M11 3v6"/><path d="M15 3v18"/><path d="M19 3c-1.5 3-2 4-2 7a2 2 0 0 0 2 2"/></svg>;
    case "cup":     return <svg {...p}><path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/><path d="M16 9h2a3 3 0 0 1 0 6h-2"/><path d="M8 3v2M11 3v2"/></svg>;
    case "cash":    return <svg {...p}><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v0M18 15v0"/></svg>;
    case "atm":     return <svg {...p}><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5v14M16 5v14"/><circle cx="12" cy="12" r="1.5"/></svg>;
    case "rest":    return <svg {...p}><circle cx="8" cy="6" r="2"/><path d="M8 9v9M6 13l-1 4M10 13l1 4"/><circle cx="16" cy="6" r="2"/><path d="M16 9v9M14 13v3M18 13v3"/></svg>;
    case "cloud":   return <svg {...p}><path d="M7 18a4 4 0 1 1 .5-7.97A6 6 0 0 1 19 12a3.5 3.5 0 0 1-.5 6.97"/></svg>;
    case "sun":     return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>;
    case "bus":     return <svg {...p}><rect x="4" y="5" width="16" height="12" rx="2"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/><path d="M4 12h16M9 5v4M15 5v4"/></svg>;
    case "star":    return <svg {...p}><path d="m12 3 2.6 6 6.4.6-4.8 4.4 1.4 6.4L12 17l-5.6 3.4 1.4-6.4L3 9.6l6.4-.6z" fill={color} stroke="none"/></svg>;
    case "bag":     return <svg {...p}><path d="M6 8h12l-1 12H7Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>;
    case "globe":   return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/></svg>;
    case "lang":    return <svg {...p}><path d="M4 5h10M9 4v3M4 9c1 5 4 8 9 9M14 9c-1 5-4 8-9 9"/><path d="M14 20l4-9 4 9M16 17h4"/></svg>;
    case "scan":    return <svg {...p}><path d="M3 7V5a2 2 0 0 1 2-2h2M3 17v2a2 2 0 0 0 2 2h2M21 7V5a2 2 0 0 0-2-2h-2M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 12h10"/></svg>;
    case "store":   return <svg {...p}><path d="M3 9h18l-1 11H4Z"/><path d="M3 9V5h18v4M9 13v3M15 13v3"/></svg>;
    case "clock":   return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "walk":    return <svg {...p}><circle cx="13" cy="4" r="2"/><path d="M9 21l3-7 2 2v5M9 13l-2-4 3-3 4 3 3 1"/></svg>;
    case "arrow":   return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "chev":    return <svg {...p}><path d="m9 6 6 6-6 6"/></svg>;
    case "heart":   return <svg {...p}><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9Z"/></svg>;
    case "plus":    return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case "x":       return <svg {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case "phone":   return <svg {...p}><path d="M5 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>;
    case "share":   return <svg {...p}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/></svg>;
    case "navs":    return <svg {...p}><path d="m4 12 16-8-6 16-2-6Z"/></svg>;
    case "logo":    return <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill={color}/><path d="M3 12h18M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/></svg>;
    default: return null;
  }
};

// ─── status bar replacement glyphs (so iOS frame layers correctly) ─────────
// We rely on IOSDevice — but our content sits below the status bar zone.

// ─── shared building blocks ────────────────────────────────────────────────

// Statusbar spacer used inside our screen surface
const StatusSpacer = ({ h = 54 }) => <div style={{ height: h }} />;

// Small kicker label
const Kicker = ({ children, color = "var(--ink-3)" }) => (
  <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color, fontWeight: 500 }}>{children}</div>
);

// Editorial title with optional italic accent
const EdTitle = ({ children, size = 34, color = "var(--ink)" }) => (
  <div style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: size, letterSpacing: "-.014em", lineHeight: 1.02, color }}>{children}</div>
);

// Floating pill nav — used across home / finder
const FloatingNav = ({ active = "home", dark = false }) => {
  const bg = dark ? "rgba(20,20,20,0.78)" : "rgba(22,17,13,0.92)";
  const fg = "#FAF7EE";
  const items = [
    { id: "home",     ico: "home"     },
    { id: "saved",    ico: "saved"    },
    { id: "settings", ico: "settings" },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 4, padding: 6,
      background: bg, color: fg, borderRadius: 999,
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      boxShadow: "0 18px 40px -10px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.06) inset",
      zIndex: 40,
    }}>
      {items.map(it => (
        <div key={it.id} style={{
          width: 52, height: 44, display:"flex", alignItems:"center", justifyContent:"center",
          background: active === it.id ? "rgba(255,255,255,.14)" : "transparent",
          borderRadius: 999, color: fg, opacity: active === it.id ? 1 : .7,
        }}>
          <I name={it.ico} size={20} w={1.7} />
        </div>
      ))}
    </div>
  );
};

// Phone-screen surface helper. Renders a div sized to the iOS device's interior
// and gives us a normal flow.
const Screen = ({ bg = "var(--ivory)", color = "var(--ink)", children, style = {} }) => (
  <div style={{
    minHeight: 874, background: bg, color, fontFamily: "var(--sans)",
    position: "relative", ...style,
  }}>
    {children}
  </div>
);

// Compact greeting band used by home variants
const Greeting = ({ name = "Maya", city = "Lisbon", area = "Alfama", temp = "22°", time = "14:08", italic = true }) => (
  <div>
    <Kicker>Welcome back</Kicker>
    <div style={{ marginTop: 6, fontFamily: "var(--serif)", fontSize: 38, lineHeight: 1, letterSpacing: "-.018em" }}>
      Hi {name}, <em style={{ fontStyle: italic ? "italic" : "normal", color: "var(--teal)" }}>{city}</em>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, color: "var(--ink-3)", fontSize: 13 }}>
      <I name="pin" size={14} color="var(--teal)" /> <span style={{ color: "var(--ink-2)" }}>{area}</span>
      <span style={{ width:3, height:3, borderRadius:"50%", background:"currentColor", opacity:.4 }} />
      {time} · {temp}
    </div>
  </div>
);

// Each finder cell: title + icon, takes category color
const CatTile = ({ cat, accent = "var(--teal)", subtitle, size = "md", note }) => {
  const big = size === "lg";
  return (
    <div style={{
      borderRadius: 16,
      background: cat.bg,
      color: cat.ink,
      padding: big ? "16px 16px 14px" : "14px",
      minHeight: big ? 124 : 100,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: `${cat.ink}1a`,
        display:"flex", alignItems:"center", justifyContent:"center", color: cat.ink,
      }}>
        <I name={cat.icon || "globe"} size={18} color={cat.ink} w={1.8} />
      </div>
      <div>
        <div style={{ fontFamily: "var(--serif)", fontSize: big ? 22 : 18, lineHeight:1.05, letterSpacing:"-.008em", color: cat.ink }}>
          {cat.label}
        </div>
        {subtitle && <div style={{ fontSize: 11.5, marginTop: 3, opacity:.75 }}>{subtitle}</div>}
      </div>
      {note && <div style={{ position:"absolute", top: 14, right: 14, fontFamily:"var(--mono)", fontSize: 9.5, letterSpacing:".12em", color: cat.ink, opacity:.7 }}>{note}</div>}
    </div>
  );
};

// Default tile defs used by Home V1 & V3 (with category color + icon name)
const TILES = [
  { ...CAT.food,    label: "Places to eat",  icon: "fork",   note: "12 near" },
  { ...CAT.money,   label: "Money",          icon: "cash",   note: "live" },
  { ...CAT.coffee,  label: "Coffee",         icon: "cup",    note: "8 open" },
  { ...CAT.atm,     label: "ATM",            icon: "atm",    note: "5 nearby" },
  { ...CAT.restroom,label: "Restrooms",      icon: "rest",   note: "3 clean" },
  { ...CAT.transit, label: "Transit",        icon: "bus",    note: "tram 28" },
  { ...CAT.weather, label: "Weather",        icon: "sun",    note: "22°" },
  { ...CAT.todo,    label: "Things to do",   icon: "star",   note: "today" },
  { ...CAT.shopping,label: "Shopping",       icon: "bag",    note: "" },
  { ...CAT.phrases, label: "Phrases",        icon: "lang",   note: "pt-PT" },
  { ...CAT.culture, label: "Culture",        icon: "compass",note: "" },
  { ...CAT.convenience, label: "24h store",  icon: "store",  note: "" },
];

Object.assign(window, { CAT, I, StatusSpacer, Kicker, EdTitle, FloatingNav, Screen, Greeting, CatTile, TILES });

// landing-phone.jsx — Phone mockup for landing hero + gallery, matches BoldHome

const LIcon = ({ name, size = 18, color = "currentColor", w = 2 }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "pin":   return <svg {...p}><path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case "fork":  return <svg {...p}><path d="M7 3v8a2 2 0 0 0 2 2v8"/><path d="M11 3v6"/><path d="M15 3v18"/><path d="M19 3c-1.5 3-2 4-2 7a2 2 0 0 0 2 2"/></svg>;
    case "cup":   return <svg {...p}><path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/><path d="M16 9h2a3 3 0 0 1 0 6h-2"/><path d="M8 3v2M11 3v2"/></svg>;
    case "cash":  return <svg {...p}><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>;
    case "atm":   return <svg {...p}><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5v14M16 5v14"/><circle cx="12" cy="12" r="1.5"/></svg>;
    case "rest":  return <svg {...p}><circle cx="8" cy="6" r="2"/><path d="M8 9v9M6 13l-1 4M10 13l1 4"/><circle cx="16" cy="6" r="2"/><path d="M16 9v9M14 13v3M18 13v3"/></svg>;
    case "bus":   return <svg {...p}><rect x="4" y="5" width="16" height="12" rx="2"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/><path d="M4 12h16M9 5v4M15 5v4"/></svg>;
    case "sun":   return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>;
    case "star":  return <svg {...p}><path d="m12 3 2.6 6 6.4.6-4.8 4.4 1.4 6.4L12 17l-5.6 3.4 1.4-6.4L3 9.6l6.4-.6z" fill={color} stroke="none"/></svg>;
    case "bag":   return <svg {...p}><path d="M6 8h12l-1 12H7Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>;
    case "lang":  return <svg {...p}><path d="M4 5h10M9 4v3M4 9c1 5 4 8 9 9M14 9c-1 5-4 8-9 9"/><path d="M14 20l4-9 4 9M16 17h4"/></svg>;
    case "compass":return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="m15 9-4 1.5L9.5 14l4-1.5L15 9Z" fill={color} stroke="none" opacity=".9"/></svg>;
    case "store": return <svg {...p}><path d="M3 9h18l-1 11H4Z"/><path d="M3 9V5h18v4M9 13v3M15 13v3"/></svg>;
    case "chev":  return <svg {...p}><path d="m9 6 6 6-6 6"/></svg>;
    case "arrow": return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "home":  return <svg {...p}><path d="m3 11 9-8 9 8v9H3z"/><path d="M9 20v-5h6v5"/></svg>;
    case "saved": return <svg {...p}><path d="M5 4h14v17l-7-4-7 4z"/></svg>;
    case "phone": return <svg {...p}><path d="M5 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>;
    case "mail":  return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
    case "gear":  return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    default: return null;
  }
};

const LCAT = {
  food:        { ink:"#E63946", name:"Eat",     icon:"fork" },
  money:       { ink:"#0F9A6B", name:"Money",   icon:"cash" },
  coffee:      { ink:"#A85A2E", name:"Coffee",  icon:"cup" },
  transit:     { ink:"#3F49D4", name:"Transit", icon:"bus" },
  restroom:    { ink:"#0F8A82", name:"Restroom",icon:"rest" },
  atm:         { ink:"#1F5BD6", name:"ATM",     icon:"atm" },
};

// Floating pill nav (matches app)
const LFloatingNav = ({ active = "home" }) => (
  <div style={{
    position:"absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
    display:"flex", gap: 4, padding: 5, borderRadius: 999,
    background:"rgba(15,20,25,.92)", color:"#FAF7EE",
    backdropFilter:"blur(20px) saturate(160%)", WebkitBackdropFilter:"blur(20px) saturate(160%)",
    boxShadow:"0 18px 40px -10px rgba(0,0,0,.3)", zIndex: 5,
  }}>
    {["home","saved","gear"].map((ic, i) => (
      <div key={ic} style={{
        width: 46, height: 38, display:"flex", alignItems:"center", justifyContent:"center",
        background: i === 0 ? "rgba(255,255,255,.14)" : "transparent",
        borderRadius: 999, opacity: i === 0 ? 1 : .7,
      }}>
        <LIcon name={ic} size={17} color="#FAF7EE" />
      </div>
    ))}
  </div>
);

// Compact Home screen (BoldHomeV2-style) sized for landing
const LandingHomeScreen = () => (
  <div style={{ flex: 1, display:"flex", flexDirection:"column", paddingBottom: 80, fontFamily:"var(--sans)" }}>
    {/* Statusbar spacer */}
    <div style={{ height: 38 }} />
    {/* Brand banner */}
    <div style={{ background:"linear-gradient(135deg, #0E8077 0%, #14B5A6 60%, #2DD4BF 100%)", height: 36, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight: 800, fontSize: 12, letterSpacing:".02em" }}>
      Globeskimmers
    </div>
    {/* Greeting card */}
    <div style={{ padding: "12px 14px 0" }}>
      <div style={{
        background:"#fff", borderRadius: 16, padding: "12px 14px 12px",
        border:"1px solid #F0E9DC",
        boxShadow:"0 1px 0 rgba(15,20,25,.04), 0 6px 16px -8px rgba(15,20,25,.08)",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap: 6, color:"#6B7280", fontSize: 10 }}>
          Hello 👋
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color:"#0F1419", letterSpacing:"-.014em", marginTop: 2 }}>
          Oliver, in <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", color:"#0E7C73", fontWeight: 400 }}>Lisbon</span>
        </div>
        <div style={{ marginTop: 8, padding:"7px 9px", borderRadius: 10, background:"#F7F4EC", display:"flex", alignItems:"center", gap: 7, fontSize: 11, fontWeight: 600, color:"#0F1419" }}>
          <LIcon name="pin" size={12} color="#0E7C73" w={2.2} /> Praça do Comércio
        </div>
      </div>

      {/* Money exchange featured */}
      <div style={{
        marginTop: 10, padding:"12px 14px", borderRadius: 16,
        background:"linear-gradient(135deg, #0F9A6B 0%, #10B981 60%, #34D399 100%)",
        color:"#fff", display:"flex", alignItems:"center", gap: 10,
        boxShadow:"0 10px 20px -10px rgba(15,154,107,.5)",
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background:"rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center", flex:"none", fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 13, fontWeight: 400 }}>$€¥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.1 }}>Money Exchange</div>
          <div style={{ marginTop: 2, fontSize: 9.5, opacity:.9 }}>Compare rates · 4 live</div>
        </div>
        <LIcon name="chev" size={14} color="#fff" w={2.4} />
      </div>

      {/* Top 3 categories */}
      <div style={{ marginTop: 10, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 6 }}>
        {[LCAT.transit, LCAT.food, LCAT.coffee].map((c, i) => (
          <div key={i} style={{
            aspectRatio:"1/1", borderRadius: 14, background: c.ink, color:"#fff", padding: 9,
            display:"flex", flexDirection:"column", justifyContent:"space-between",
            position:"relative", overflow:"hidden",
            boxShadow:`0 8px 18px -10px ${c.ink}80`,
          }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background:"rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <LIcon name={c.icon} size={14} color="#fff" w={2.2} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 10.5 }}>{c.name}</div>
          </div>
        ))}
      </div>
      {/* 4 small */}
      <div style={{ marginTop: 6, display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap: 6 }}>
        {[LCAT.atm, LCAT.restroom, { ink:"#15803D", name:"24h", icon:"store" }, { ink:"#D4861A", name:"Weather", icon:"sun" }].map((c, i) => (
          <div key={i} style={{
            aspectRatio:"1/1", borderRadius: 12, background: c.ink, color:"#fff", padding: 7,
            display:"flex", flexDirection:"column", justifyContent:"space-between",
            boxShadow:`0 8px 18px -10px ${c.ink}80`,
          }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background:"rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <LIcon name={c.icon} size={11} color="#fff" w={2.2} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 8.5 }}>{c.name}</div>
          </div>
        ))}
      </div>
      {/* Explore more 2x2 */}
      <div style={{ marginTop: 10, fontFamily:"var(--mono)", fontSize: 8.5, letterSpacing:".14em", color:"#6B7280", textTransform:"uppercase", fontWeight: 600 }}>Explore more</div>
      <div style={{ marginTop: 6, display:"grid", gridTemplateColumns:"1fr 1fr", gap: 6 }}>
        {[
          { c:"#C5197A", g:"linear-gradient(135deg, #C5197A 0%, #E84393 60%, #FF7DB1 100%)", name:"Things to do", icon:"star" },
          { c:"#7C3AED", g:"linear-gradient(135deg, #7C3AED 0%, #A855F7 60%, #C084FC 100%)", name:"Shopping",      icon:"bag" },
          { c:"#8B5A1A", g:"linear-gradient(135deg, #8B5A1A 0%, #D97706 60%, #FBBF24 100%)", name:"Culture",       icon:"compass" },
          { c:"#A37013", g:"linear-gradient(135deg, #A37013 0%, #CA8A04 60%, #EAB308 100%)", name:"Phrases",       icon:"lang" },
        ].map((t, i) => (
          <div key={i} style={{
            aspectRatio:"1.4 / 1", borderRadius: 12, background: t.g, color:"#fff", padding: 8,
            display:"flex", flexDirection:"column", justifyContent:"space-between",
            position:"relative", overflow:"hidden",
          }}>
            <div style={{ position:"absolute", top:-6, right:-6, width: 32, height: 32, borderRadius:"50%", background:"rgba(255,255,255,.16)" }} />
            <div style={{ width: 22, height: 22, borderRadius: 7, background:"rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
              <LIcon name={t.icon} size={11} color="#fff" w={2.2} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 10, position:"relative" }}>{t.name}</div>
          </div>
        ))}
      </div>
    </div>
    <LFloatingNav />
  </div>
);

Object.assign(window, { LIcon, LCAT, LFloatingNav, LandingHomeScreen });

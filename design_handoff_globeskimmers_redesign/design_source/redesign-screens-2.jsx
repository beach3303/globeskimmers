// redesign-screens-2.jsx — Map, Smart Text Scanner, Transportation (route planner)
// Built from the real repo features.

// ============================================================================
// MAP VIEW — full-screen Leaflet-style map, teal header, recenter FAB
// ============================================================================
const BoldMap = () => (
  <Screen bg="#DCEAF3">
    <StatusSpacer h={54} />

    {/* Header — gradient teal (matches repo #088395 → #05BFDB) */}
    <div style={{
      background:"linear-gradient(90deg, #0E8077 0%, #14B5A6 60%, #06B6D4 100%)",
      color:"#fff", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between",
    }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing:"-.012em" }}>Lisbon</div>
        <div style={{ fontSize: 11.5, opacity:.9 }}>Your current location</div>
      </div>
      <div style={{ width: 34, height: 34, borderRadius:"50%", background:"rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <I name="x" size={18} color="#fff" w={2.2} />
      </div>
    </div>

    {/* Map surface */}
    <div style={{ flex: 1, position:"relative", overflow:"hidden", background:`
      radial-gradient(ellipse at 40% 35%, #EAF3EC 0%, #DCEAE0 50%, #D2E4DA 100%)
    `, minHeight: 620 }}>
      {/* Streets */}
      <svg width="100%" height="100%" viewBox="0 0 402 620" style={{ position:"absolute", inset:0 }}>
        {/* water */}
        <path d="M-10 480 Q 120 440 220 480 T 420 470 L420 640 L-10 640Z" fill="#BBD9EC" opacity=".75" />
        {/* parks */}
        <circle cx="90" cy="180" r="50" fill="#C3E0C0" opacity=".7" />
        <rect x="250" y="120" width="90" height="70" rx="12" fill="#C3E0C0" opacity=".7" />
        {/* road grid */}
        <g stroke="#fff" strokeWidth="6" fill="none" opacity=".9">
          <path d="M-10 120 L420 90" />
          <path d="M-10 260 L420 240" />
          <path d="M-10 380 L420 400" />
          <path d="M70 -10 L50 520" />
          <path d="M200 -10 L210 520" />
          <path d="M330 -10 L310 520" />
        </g>
        <g stroke="#E8E2D2" strokeWidth="2.5" fill="none">
          <path d="M-10 180 L420 165" />
          <path d="M-10 320 L420 330" />
          <path d="M135 -10 L125 520" />
          <path d="M265 -10 L262 520" />
        </g>
      </svg>

      {/* Selected location marker (gold, large) */}
      <div style={{ position:"absolute", left:"50%", top:"42%", transform:"translate(-50%,-100%)", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ background:"#fff", borderRadius: 12, padding:"8px 12px", boxShadow:"0 8px 22px -8px rgba(0,0,0,.3)", textAlign:"center", marginBottom: 6, whiteSpace:"nowrap" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color:"#0F1419" }}>Praça do Comércio</div>
          <div style={{ fontSize: 10.5, color:"#6B7280" }}>Your current location</div>
        </div>
        <svg width="34" height="44" viewBox="0 0 34 44">
          <path d="M17 44C17 44 32 26 32 15A15 15 0 1 0 2 15C2 26 17 44 17 44Z" fill="#E63946" stroke="#fff" strokeWidth="2.5"/>
          <circle cx="17" cy="15" r="6" fill="#fff"/>
        </svg>
      </div>

      {/* a couple of secondary pins */}
      <svg style={{ position:"absolute", left:"26%", top:"30%" }} width="26" height="34" viewBox="0 0 34 44"><path d="M17 44C17 44 32 26 32 15A15 15 0 1 0 2 15C2 26 17 44 17 44Z" fill="#F4B400" stroke="#fff" strokeWidth="2.5"/><circle cx="17" cy="15" r="6" fill="#fff"/></svg>
      <svg style={{ position:"absolute", left:"68%", top:"55%" }} width="26" height="34" viewBox="0 0 34 44"><path d="M17 44C17 44 32 26 32 15A15 15 0 1 0 2 15C2 26 17 44 17 44Z" fill="#F4B400" stroke="#fff" strokeWidth="2.5"/><circle cx="17" cy="15" r="6" fill="#fff"/></svg>

      {/* Recenter FAB */}
      <div style={{ position:"absolute", bottom: 96, right: 18, width: 48, height: 48, borderRadius:"50%", background:"#fff", boxShadow:"0 8px 20px -6px rgba(0,0,0,.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <I name="navs" size={20} color="#0E8077" w={2} />
      </div>

      {/* attribution */}
      <div style={{ position:"absolute", bottom: 4, left: 6, fontSize: 8, color:"#6B7280", opacity:.7 }}>© OpenStreetMap</div>
    </div>

    <FloatingNav active="home" />
  </Screen>
);

// ============================================================================
// SMART TEXT SCANNER — vibrant "coming soon" + preview of what it'll do
// ============================================================================
const BoldTextScanner = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />

    {/* Header — violet gradient (matches repo #667eea → #764ba2, but bolder) */}
    <div style={{
      background:"linear-gradient(135deg, #6D28D9 0%, #7C3AED 55%, #A855F7 100%)",
      color:"#fff", padding:"16px 20px 22px", borderRadius:"0 0 24px 24px",
      boxShadow:"0 14px 30px -16px rgba(124,58,237,.55)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap: 8, marginBottom: 14 }}>
        <I name="chev" size={18} color="#fff" w={2.2} style={{ transform:"rotate(180deg)" }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Back</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing:"-.018em" }}>
        Smart <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400 }}>Text Scanner</span>
      </div>
    </div>

    <div style={{ padding:"24px 20px 0" }}>
      {/* Hero icon */}
      <div style={{ textAlign:"center" }}>
        <div style={{
          width: 88, height: 88, margin:"0 auto", borderRadius: 26,
          background:"linear-gradient(135deg, #7C3AED 0%, #C5197A 100%)",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 16px 34px -14px rgba(124,58,237,.6)",
        }}>
          <I name="scan" size={42} color="#fff" w={1.8} />
        </div>
        <div style={{ marginTop: 18, fontSize: 28, fontWeight: 800, color:"#0F1419", letterSpacing:"-.018em" }}>Coming soon</div>
        <div style={{ marginTop: 8, fontSize: 15, color:"#475569", lineHeight: 1.55, maxWidth: 320, marginInline:"auto" }}>
          Point your camera at a menu, sign, or document — and read it in your language, instantly.
        </div>
      </div>

      {/* Preview of capabilities */}
      <div style={{ marginTop: 24, display:"flex", flexDirection:"column", gap: 10 }}>
        {[
          { ico:"scan",  c: BC.shopping, t:"Scan any text",      s:"Menus, signs, labels, documents" },
          { ico:"lang",  c: BC.transit,  t:"Auto-translate",     s:"100+ languages, on-device fast" },
          { ico:"star",  c: BC.todo,     t:"Save & speak it",    s:"Hear pronunciation, save phrases" },
        ].map((row, i) => (
          <div key={i} style={{ padding:"14px 16px", borderRadius: 16, background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: row.c.bg, color: row.c.ink, display:"flex", alignItems:"center", justifyContent:"center", flex:"none" }}>
              <I name={row.ico} size={20} color={row.c.ink} w={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color:"#0F1419" }}>{row.t}</div>
              <div style={{ fontSize: 12.5, color:"#6B7280", marginTop: 2 }}>{row.s}</div>
            </div>
            <span style={{ fontFamily:"var(--mono)", fontSize: 9, letterSpacing:".12em", textTransform:"uppercase", color: row.c.ink, padding:"3px 7px", borderRadius: 999, background: row.c.bg, fontWeight: 700 }}>Soon</span>
          </div>
        ))}
      </div>

      {/* Notify CTA */}
      <div style={{ marginTop: 20 }}>
        <div style={{ height: 54, borderRadius: 16, background:"#0F1419", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap: 8, fontSize: 15.5, fontWeight: 700, boxShadow:"0 12px 28px -14px rgba(15,20,25,.4)" }}>
          Notify me when it's ready <I name="arrow" size={18} color="#fff" w={2.4} />
        </div>
        <div style={{ marginTop: 14, padding:"14px 16px", borderRadius: 14, background: BC.todo.bg, color: BC.todo.ink, fontSize: 13, lineHeight: 1.5, fontWeight: 600, textAlign:"center" }}>
          💜 Thanks for your patience — travelers like you make Globeskimmers better.
        </div>
      </div>
    </div>

    <div style={{ height: 100 }} />
    <FloatingNav active="search" />
  </Screen>
);

// ============================================================================
// TRANSPORTATION — route planner (the real feature set)
// ============================================================================
const RIDE_PROVIDERS = [
  { name:"Bolt",  glyph:"⚡", bg:"#0F9A6B", note:"~€8–11 · 3 min away", est:"€9.40" },
  { name:"Uber",  glyph:"▪",  bg:"#0F1419", note:"~€10–13 · 5 min away", est:"€11.20" },
];

const TRANSIT_OPTIONS = [
  { mode:"Tram 28",    icon:"bus",     color: BC.transit,     time:"28 min", fare:"€3.10", traffic:null, tag:"Scenic route", best:true },
  { mode:"Metro · Blue", icon:"bus",   color: BC.atm,         time:"16 min", fare:"€1.65", traffic:"light", tag:"Fastest" },
  { mode:"Walk",       icon:"compass", color: BC.convenience, time:"42 min", fare:"Free",  traffic:null, tag:"Uphill · healthiest" },
  { mode:"Taxi",       icon:"bus",     color: BC.weather,     time:"14 min", fare:"€8–11", traffic:"moderate", tag:"Door to door" },
];

const TrafficBadge = ({ level }) => {
  const map = {
    light:    { c:"#15803D", bg:"#D4F0DA", t:"Light traffic", dot:"🟢" },
    moderate: { c:"#B45309", bg:"#FEF3C7", t:"Moderate",      dot:"🟡" },
    heavy:    { c:"#C2410C", bg:"#FFE4D6", t:"Heavy traffic", dot:"🟠" },
  };
  const m = map[level]; if (!m) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:999, background:m.bg, color:m.c, fontSize:10.5, fontWeight:700, fontFamily:"var(--mono)", letterSpacing:".06em" }}>
      {m.dot} {m.t}
    </span>
  );
};

const BoldTransportationV2 = ({ onBack }) => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    <div style={{ padding:"14px 18px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div onClick={onBack} style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
        <I name="chev" size={18} style={{ transform:"rotate(180deg)" }} />
      </div>
      <Pill bg={BC.transit.bg} color={BC.transit.ink} icon="bus">Transportation</Pill>
      <div style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <I name="map" size={16} />
      </div>
    </div>

    <div style={{ padding:"16px 18px 0" }}>
      {/* Route card: origin → destination */}
      <div style={{ padding:"16px 18px", borderRadius: 20, background:"#fff", border:"1px solid #F0E9DC", boxShadow:"0 8px 24px -14px rgba(15,20,25,.12)" }}>
        <div style={{ display:"flex", gap: 12 }}>
          {/* timeline rail */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop: 4 }}>
            <div style={{ width: 11, height: 11, borderRadius:"50%", border:`3px solid ${BC.money.ink}` }} />
            <div style={{ width: 2, flex: 1, minHeight: 26, background:"#E5DDC8", margin:"4px 0" }} />
            <svg width="14" height="16" viewBox="0 0 24 24" fill={BC.food.ink}><path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12Z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ paddingBottom: 12, borderBottom:"1px dashed #E5DDC8" }}>
              <div style={{ fontFamily:"var(--mono)", fontSize: 9.5, letterSpacing:".14em", textTransform:"uppercase", color:"#94A3B8", fontWeight: 600 }}>From</div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color:"#0F1419", marginTop: 2 }}>Praça do Comércio</div>
            </div>
            <div style={{ paddingTop: 12 }}>
              <div style={{ fontFamily:"var(--mono)", fontSize: 9.5, letterSpacing:".14em", textTransform:"uppercase", color:"#94A3B8", fontWeight: 600 }}>To</div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color:"#0F1419", marginTop: 2 }}>Castelo de São Jorge</div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", justifyContent:"center" }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: BC.transit.bg, color: BC.transit.ink, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <I name="navs" size={17} color={BC.transit.ink} w={2} />
            </div>
          </div>
        </div>
        {/* meta row */}
        <div style={{ marginTop: 14, display:"flex", alignItems:"center", gap: 10, flexWrap:"wrap" }}>
          <Pill bg="#F7F4EC" color="#374151" fontSize={11.5}>📍 2.4 km</Pill>
          <TrafficBadge level="moderate" />
          <Pill bg="#F7F4EC" color="#374151" fontSize={11.5}>🕐 Now · 14:08</Pill>
        </div>
      </div>

      {/* Quick destination shortcuts */}
      <div style={{ marginTop: 12, display:"flex", gap: 8 }}>
        {[
          { ico:"plane", t:"Airport", c: BC.atm },
          { ico:"home",  t:"Hotel",   c: BC.food },
          { ico:"saved", t:"Saved",   c: BC.todo },
        ].map((q, i) => (
          <div key={i} style={{ flex: 1, padding:"12px 8px", borderRadius: 14, background: q.c.bg, color: q.c.ink, display:"flex", flexDirection:"column", alignItems:"center", gap: 6 }}>
            <I name={q.ico} size={18} color={q.c.ink} w={2} />
            <span style={{ fontWeight: 700, fontSize: 12 }}>{q.t}</span>
          </div>
        ))}
      </div>

      {/* Transit options */}
      <div style={{ marginTop: 18, marginBottom: 10 }}>
        <Kicker color="#6B7280">Ways to get there · sorted by traveler-pick</Kicker>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap: 10 }}>
        {TRANSIT_OPTIONS.map((t, i) => (
          <div key={i} style={{
            padding:"14px 16px", borderRadius: 16,
            background: t.best ? t.color.ink : "#fff",
            color: t.best ? "#fff" : "#0F1419",
            border: t.best ? "0" : "1px solid #F0E9DC",
            boxShadow: t.best ? `0 12px 26px -12px ${t.color.ink}80` : "0 1px 0 rgba(15,20,25,.03)",
            display:"flex", alignItems:"center", gap: 14,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: t.best ? "rgba(255,255,255,.2)" : t.color.bg, color: t.best ? "#fff" : t.color.ink, display:"flex", alignItems:"center", justifyContent:"center", flex:"none" }}>
              <I name={t.icon} size={20} color={t.best ? "#fff" : t.color.ink} w={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{t.mode}</span>
                {t.best && <span style={{ fontSize: 10, fontFamily:"var(--mono)", letterSpacing:".12em", textTransform:"uppercase", opacity:.85 }}>· best</span>}
              </div>
              <div style={{ marginTop: 2, fontSize: 12.5, opacity: t.best ? .85 : 1, color: t.best ? "rgba(255,255,255,.85)" : "#6B7280" }}>{t.tag}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 22, lineHeight: 1 }}>{t.time}</div>
              <div style={{ marginTop: 3, fontSize: 12, fontWeight: 700, opacity: t.best ? .9 : 1, color: t.best ? "rgba(255,255,255,.9)" : BC.money.ink }}>{t.fare}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Rideshare apps available here */}
      <div style={{ marginTop: 18, marginBottom: 10 }}>
        <Kicker color="#6B7280">Book a ride · available in Portugal</Kicker>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap: 10 }}>
        {RIDE_PROVIDERS.map((p, i) => (
          <div key={i} style={{
            padding:"12px 16px", borderRadius: 16, background:"#fff", border:"1px solid #F0E9DC",
            display:"flex", alignItems:"center", gap: 14,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: p.bg, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flex:"none", fontSize: 22 }}>{p.glyph}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color:"#0F1419" }}>{p.name}</div>
              <div style={{ fontSize: 12, color:"#6B7280", marginTop: 2 }}>{p.note}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap: 10 }}>
              <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 18, color:"#0F1419" }}>{p.est}</span>
              <div style={{ padding:"8px 14px", borderRadius: 10, background: p.bg, color:"#fff", fontWeight: 700, fontSize: 12.5 }}>Open</div>
            </div>
          </div>
        ))}
      </div>

      {/* Taxi call card */}
      <div style={{ marginTop: 10, padding:"14px 16px", borderRadius: 16, background: BC.weather.bg, display:"flex", alignItems:"center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius:"50%", background: BC.weather.ink, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <I name="phone" size={18} color="#fff" w={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: BC.weather.ink }}>Call a Lisbon taxi</div>
          <div style={{ fontSize: 12, color:"#8A6010", marginTop: 2 }}>Rádio Táxis · +351 21 811 9000</div>
        </div>
        <I name="chev" size={18} color={BC.weather.ink} w={2.2} />
      </div>

      {/* Honest tip */}
      <div style={{ marginTop: 12, padding:"14px 16px", borderRadius: 14, background: BC.transit.bg, color: BC.transit.ink, display:"flex", gap: 10, alignItems:"flex-start" }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>💡</span>
        <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>
          Tram 28 is the scenic pick but gets packed by 10am. A Bolt is only <b>€9</b> and skips the queue.
        </div>
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="search" />
  </Screen>
);

Object.assign(window, { BoldMap, BoldTextScanner, BoldTransportationV2 });

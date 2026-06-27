// redesign-more-screens.jsx — Transportation, Coffee, Restroom, Onboarding

// Tiny helpers from bold system reused
const _Photo = (p) => Photo(p);
const _Pill = (p) => Pill(p);

// ============================================================================
// TRANSPORTATION
// ============================================================================
const TRANSIT_MODES = [
  { mode:"Walk",     time:"42 min", price:"Free",     dist:"3.4 km", icon:"compass", color: BC.convenience.ink, tag:"Healthiest" },
  { mode:"Tram 28",  time:"28 min", price:"€3.10",    dist:"2 stops", icon:"bus", color: BC.transit.ink, tag:"Scenic · best", best:true },
  { mode:"Metro · Blue",  time:"16 min", price:"€1.65", dist:"4 stops", icon:"bus", color: BC.atm.ink, tag:"Fastest" },
  { mode:"Taxi",     time:"12 min", price:"€8.40",    dist:"direct",  icon:"bus", color: BC.weather.ink, tag:"Convenience" },
  { mode:"Tuk-tuk",  time:"12 min", price:"€18",      dist:"direct",  icon:"bus", color: BC.food.ink, tag:"Negotiable" },
  { mode:"Rideshare", time:"14 min", price:"€11.20",  dist:"direct",  icon:"bus", color: BC.shopping.ink, tag:"Bolt · Uber" },
];

const BoldTransportation = ({ onBack, onPick }) => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    {/* Header with back */}
    <div style={{ padding:"14px 18px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div onClick={onBack} style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
        <I name="chev" size={18} style={{ transform:"rotate(180deg)" }} />
      </div>
      <Pill bg={BC.transit.bg} color={BC.transit.ink} icon="bus">Transportation</Pill>
      <div style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <I name="filter" size={16} />
      </div>
    </div>

    <div style={{ padding:"18px 18px 0" }}>
      {/* Route card */}
      <div style={{ padding:"16px 18px", borderRadius: 20,
        background:`linear-gradient(135deg, ${BC.transit.ink} 0%, #4F46E5 60%, #818CF8 100%)`,
        color:"#fff", position:"relative", overflow:"hidden",
        boxShadow:`0 14px 32px -14px ${BC.transit.ink}80`,
      }}>
        <div style={{ position:"absolute", top:-20, right:-20, width: 110, height: 110, borderRadius:"50%", background:"rgba(255,255,255,.1)" }} />
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing:".14em", textTransform:"uppercase", opacity:.85, position:"relative" }}>Get me to</div>
        <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, letterSpacing:"-.018em", lineHeight: 1.05, fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400 }}>Castelo de São Jorge</div>
        <div style={{ marginTop: 10, display:"flex", alignItems:"center", gap: 14, fontSize: 13, fontWeight: 600, position:"relative" }}>
          <span style={{ display:"flex", alignItems:"center", gap: 5 }}><I name="pin" size={14} color="#fff" w={2.2} /> 2.4 km</span>
          <span style={{ width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,.6)" }} />
          <span>Uphill</span>
          <span style={{ width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,.6)" }} />
          <span>Now · 14:08</span>
        </div>
      </div>

      <div style={{ marginTop: 18, marginBottom: 10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Kicker color="#6B7280">6 ways to get there · sorted by traveler-pick</Kicker>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap: 10 }}>
        {TRANSIT_MODES.map((t, i) => (
          <div key={i} onClick={() => onPick?.(t)} style={{
            padding:"14px 16px", borderRadius: 16,
            background: t.best ? t.color : "#FFFFFF",
            color: t.best ? "#fff" : "#0F1419",
            border: t.best ? "0" : "1px solid #F0E9DC",
            boxShadow: t.best ? `0 12px 26px -12px ${t.color}80` : "0 1px 0 rgba(15,20,25,.03)",
            display:"flex", alignItems:"center", gap: 14, cursor:"pointer",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: t.best ? "rgba(255,255,255,.2)" : t.color,
              color:"#fff",
              display:"flex", alignItems:"center", justifyContent:"center", flex:"none",
            }}>
              <I name={t.icon} size={20} color="#fff" w={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{t.mode}</span>
                {t.best && <span style={{ fontSize: 10, fontFamily:"var(--mono)", letterSpacing:".12em", textTransform:"uppercase", opacity:.85 }}>· best</span>}
              </div>
              <div style={{ marginTop: 2, fontSize: 12.5, opacity: t.best ? .85 : 1, color: t.best ? "rgba(255,255,255,.85)" : "#6B7280" }}>
                {t.tag} · {t.dist}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 22, letterSpacing:"-.01em", lineHeight: 1 }}>{t.time}</div>
              <div style={{ marginTop: 3, fontSize: 12, fontWeight: 700, opacity: t.best ? .85 : 1, color: t.best ? "rgba(255,255,255,.9)" : BC.money.ink }}>{t.price}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Local tip */}
      <div style={{ marginTop: 16, padding:"14px 16px", borderRadius: 14, background: BC.weather.bg, color: BC.weather.ink, display:"flex", gap: 10, alignItems:"flex-start" }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>💡</span>
        <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>
          Buy a <b>Lisboa Card</b> at the metro station — covers Tram 28 + skip-the-cash fumble at boarding.
        </div>
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="search" />
  </Screen>
);

// ============================================================================
// COFFEE FINDER
// ============================================================================
const COFFEE_SHOPS = [
  { name:"Fábrica Coffee Roasters",   vibe:"Pour-over · third-wave", dist:"0.3 km", walk:"4 min", rating:"4.8", count:"1,240", price:"€€", open:"Until 19:00", tag:"Roastery", best:true },
  { name:"Hello, Kristof",            vibe:"Quiet · work-friendly",  dist:"0.5 km", walk:"7 min", rating:"4.7", count:"612",   price:"€€", open:"Until 18:00", tag:"Magazine vibe" },
  { name:"Copenhagen Coffee Lab",     vibe:"Brunch · pastries",       dist:"0.6 km", walk:"8 min", rating:"4.6", count:"890",   price:"€€", open:"Until 17:00", tag:"Cardamom buns" },
  { name:"Comoba",                    vibe:"Lazy · weekend",          dist:"0.8 km", walk:"11 min",rating:"4.5", count:"540",   price:"€€", open:"Until 16:00", tag:"Brunch staple" },
  { name:"Wish · Slow Coffee House",  vibe:"Cosy · espresso",        dist:"1.1 km", walk:"14 min",rating:"4.4", count:"310",   price:"€",  open:"Until 19:00", tag:"Locals only" },
];

const BoldCoffee = ({ onBack, onPick }) => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    <div style={{ padding:"14px 18px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div onClick={onBack} style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
        <I name="chev" size={18} style={{ transform:"rotate(180deg)" }} />
      </div>
      <Pill bg={BC.coffee.bg} color={BC.coffee.ink} icon="cup">Coffee Finder</Pill>
      <div style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <I name="map" size={16} />
      </div>
    </div>

    <div style={{ padding:"18px 18px 0" }}>
      {/* Hero card */}
      <div style={{ padding:"18px 20px", borderRadius: 20,
        background:`linear-gradient(135deg, ${BC.coffee.ink} 0%, #C97E3D 50%, #E0A66B 100%)`,
        color:"#fff", display:"flex", alignItems:"center", gap: 16,
        boxShadow:`0 14px 30px -14px ${BC.coffee.ink}80`, position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:-22, right:-22, width: 110, height: 110, borderRadius:"50%", background:"rgba(255,255,255,.12)" }} />
        <div style={{ position:"absolute", bottom:-30, right: 20, fontSize: 80, opacity:.18 }}>☕</div>
        <div style={{ position:"relative" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing:".14em", textTransform:"uppercase", opacity:.85 }}>Around you · Alfama</div>
          <div style={{ marginTop: 8, fontSize: 30, fontFamily:"var(--serif)", fontStyle:"italic", letterSpacing:"-.018em", lineHeight: 1 }}>Best coffee</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity:.9 }}>8 specialty roasters within 1 km</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display:"flex", gap: 8, overflowX:"auto" }}>
        {["All", "Pour-over", "Espresso", "Cold brew", "Work-friendly", "Late night"].map((c, i) => (
          <div key={i} style={{
            flex:"none", padding:"8px 14px", borderRadius: 999,
            background: i === 0 ? BC.coffee.ink : "#fff",
            color: i === 0 ? "#fff" : BC.coffee.ink,
            border: `1px solid ${i === 0 ? BC.coffee.ink : "#E5DDC8"}`,
            fontWeight: 700, fontSize: 13, whiteSpace:"nowrap",
          }}>{c}</div>
        ))}
      </div>

      <div style={{ marginTop: 14, display:"flex", flexDirection:"column", gap: 10 }}>
        {COFFEE_SHOPS.map((s, i) => (
          <div key={i} onClick={() => onPick?.(s)} style={{
            padding: 12, borderRadius: 16, background:"#FFFFFF", border:"1px solid #F0E9DC",
            display:"grid", gridTemplateColumns:"68px 1fr auto", gap: 12, alignItems:"center", cursor:"pointer",
            boxShadow: s.best ? `0 12px 26px -14px ${BC.coffee.ink}40` : "0 1px 0 rgba(15,20,25,.03)",
          }}>
            <Photo w={68} h={68} label={s.tag.toLowerCase()} tint={BC.coffee.ink} r={12} />
            <div>
              {s.best && <Pill bg={BC.coffee.bg} color={BC.coffee.ink} fontSize={10}>⭐ Locals' #1</Pill>}
              <div style={{ marginTop: s.best ? 6 : 0, fontWeight: 700, fontSize: 15, color:"#0F1419", letterSpacing:"-.005em" }}>{s.name}</div>
              <div style={{ marginTop: 3, fontSize: 12, color:"#6B7280" }}>{s.vibe}</div>
              <div style={{ marginTop: 6, display:"flex", alignItems:"center", gap: 8, fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ color: BC.convenience.ink, display:"flex", alignItems:"center", gap: 3 }}>● {s.open}</span>
                <span style={{ color:"#94A3B8" }}>·</span>
                <span style={{ color:"#6B7280" }}>{s.walk}</span>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color:"#0F1419" }}>★ {s.rating}</div>
              <div style={{ marginTop: 2, fontSize: 10.5, color:"#94A3B8", fontWeight: 600 }}>{s.count}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="search" />
  </Screen>
);

// ============================================================================
// RESTROOM FINDER
// ============================================================================
const RESTROOMS = [
  { name:"Café A Brasileira",    type:"Café · purchase req.", dist:"0.2 km", walk:"3 min", clean:5, free:false, access:true,  notes:"Buy a coffee · gorgeous tile" },
  { name:"El Corte Inglés",      type:"Department store",     dist:"0.4 km", walk:"5 min", clean:5, free:true,  access:true,  notes:"3rd floor · always clean", best:true },
  { name:"Praça do Município",   type:"Public restroom",      dist:"0.3 km", walk:"4 min", clean:3, free:true,  access:true,  notes:"€0.50 · attendant present" },
  { name:"Time Out Market",      type:"Food hall",            dist:"0.7 km", walk:"9 min", clean:4, free:true,  access:true,  notes:"Inside · marked clearly" },
  { name:"McDonald's Baixa",     type:"Fast food",            dist:"0.5 km", walk:"7 min", clean:3, free:false, access:true,  notes:"Receipt required" },
];

const BoldRestroom = ({ onBack, onPick }) => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    <div style={{ padding:"14px 18px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div onClick={onBack} style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
        <I name="chev" size={18} style={{ transform:"rotate(180deg)" }} />
      </div>
      <Pill bg={BC.restroom.bg} color={BC.restroom.ink} icon="rest">Restroom Finder</Pill>
      <div style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <I name="map" size={16} />
      </div>
    </div>

    <div style={{ padding:"18px 18px 0" }}>
      {/* Hero */}
      <div style={{ padding:"18px 20px", borderRadius: 20,
        background:`linear-gradient(135deg, ${BC.restroom.ink} 0%, #14B5A6 60%, #2DD4BF 100%)`,
        color:"#fff", boxShadow:`0 14px 30px -14px ${BC.restroom.ink}80`, position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:-20, right:-20, width: 100, height: 100, borderRadius:"50%", background:"rgba(255,255,255,.12)" }} />
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing:".14em", textTransform:"uppercase", opacity:.85 }}>Honest restroom intel</div>
        <div style={{ marginTop: 8, fontSize: 28, fontFamily:"var(--serif)", fontStyle:"italic", letterSpacing:"-.014em", lineHeight: 1 }}>5 clean spots within 1 km</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity:.9 }}>Rated by people who actually checked</div>
      </div>

      {/* Filter pills */}
      <div style={{ marginTop: 14, display:"flex", gap: 8, flexWrap:"wrap" }}>
        <Pill bg={BC.restroom.ink} color="#fff" fontSize={12.5}>✓ Free only</Pill>
        <Pill bg="#fff" color="#374151" fontSize={12.5} icon="rest">♿ Accessible</Pill>
        <Pill bg="#fff" color="#374151" fontSize={12.5}>👶 Baby change</Pill>
        <Pill bg="#fff" color="#374151" fontSize={12.5}>⭐ Clean 4+</Pill>
      </div>

      <div style={{ marginTop: 14, display:"flex", flexDirection:"column", gap: 10 }}>
        {RESTROOMS.map((r, i) => (
          <div key={i} onClick={() => onPick?.(r)} style={{
            padding:"14px 16px", borderRadius: 16,
            background: r.best ? `linear-gradient(135deg, ${BC.restroom.ink} 0%, #14B5A6 100%)` : "#FFFFFF",
            color: r.best ? "#fff" : "#0F1419",
            border: r.best ? "0" : "1px solid #F0E9DC",
            boxShadow: r.best ? `0 12px 26px -14px ${BC.restroom.ink}80` : "0 1px 0 rgba(15,20,25,.03)",
            cursor:"pointer",
          }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: r.best ? "rgba(255,255,255,.2)" : BC.restroom.bg,
                color: r.best ? "#fff" : BC.restroom.ink,
                display:"flex", alignItems:"center", justifyContent:"center", flex:"none",
              }}>
                <I name="rest" size={20} color={r.best ? "#fff" : BC.restroom.ink} w={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, letterSpacing:"-.005em" }}>{r.name}</span>
                  {r.best && <span style={{ fontSize: 10, fontFamily:"var(--mono)", letterSpacing:".12em", textTransform:"uppercase", opacity:.85 }}>· top pick</span>}
                </div>
                <div style={{ marginTop: 3, fontSize: 12.5, opacity: r.best ? .85 : 1, color: r.best ? "rgba(255,255,255,.85)" : "#6B7280" }}>{r.type}</div>
                <div style={{ marginTop: 8, display:"flex", alignItems:"center", gap: 8, flexWrap:"wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding:"3px 8px", borderRadius: 6,
                    background: r.best ? "rgba(255,255,255,.18)" : (r.free ? BC.convenience.bg : BC.weather.bg),
                    color: r.best ? "#fff" : (r.free ? BC.convenience.ink : BC.weather.ink) }}>
                    {r.free ? "Free" : "Purchase req."}
                  </span>
                  {r.access && <span style={{ fontSize: 11, fontWeight: 700, padding:"3px 8px", borderRadius: 6,
                    background: r.best ? "rgba(255,255,255,.18)" : BC.atm.bg, color: r.best ? "#fff" : BC.atm.ink }}>♿ Accessible</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: r.best ? .85 : 1 }}>
                    {"●".repeat(r.clean)}<span style={{ opacity: .3 }}>{"●".repeat(5 - r.clean)}</span>
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, fontStyle:"italic", opacity: r.best ? .9 : .8, color: r.best ? "rgba(255,255,255,.9)" : "#475569" }}>
                  {r.notes}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 18, lineHeight: 1 }}>{r.walk}</div>
                <div style={{ marginTop: 2, fontSize: 11, opacity: r.best ? .85 : 1, color: r.best ? "rgba(255,255,255,.9)" : "#94A3B8", fontWeight: 600 }}>{r.dist}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="search" />
  </Screen>
);

// ============================================================================
// ONBOARDING (3 screens)
// ============================================================================
const BoldOnboarding1 = ({ onNext }) => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />

    <div style={{ padding:"40px 28px 0" }}>
      <Kicker color="#6B7280">Step 1 of 3</Kicker>
      <div style={{ marginTop: 8, display:"flex", gap: 4 }}>
        <span style={{ flex: 1, height: 5, borderRadius: 999, background: BC.transit.ink }} />
        <span style={{ flex: 1, height: 5, borderRadius: 999, background:"#E5DDC8" }} />
        <span style={{ flex: 1, height: 5, borderRadius: 999, background:"#E5DDC8" }} />
      </div>

      <div style={{ marginTop: 36, fontSize: 44, fontWeight: 800, color:"#0F1419", letterSpacing:"-.022em", lineHeight: 1 }}>
        Travel like<br /><span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400, color: BC.transit.ink }}>you've been</span><br />there before.
      </div>
      <div style={{ marginTop: 16, fontSize: 16, color:"#475569", lineHeight: 1.55, maxWidth: 300 }}>
        Globeskimmers shows you food, money exchange rates, ATMs, restrooms, and ride options — instantly, wherever you land.
      </div>

      {/* Visual */}
      <div style={{ marginTop: 32, padding: 20, borderRadius: 22, background:`linear-gradient(135deg, ${BC.transit.ink} 0%, #6366F1 60%, #818CF8 100%)`, color:"#fff", boxShadow:`0 18px 36px -16px ${BC.transit.ink}80`, position:"relative", overflow:"hidden", minHeight: 220 }}>
        <div style={{ position:"absolute", top:-30, right:-30, width: 140, height: 140, borderRadius:"50%", background:"rgba(255,255,255,.12)" }} />
        <div style={{ position:"absolute", bottom:-30, left:-30, width: 100, height: 100, borderRadius:"50%", background:"rgba(255,255,255,.08)" }} />
        <div style={{ position:"absolute", top: 20, right: 24, fontSize: 30, opacity:.4 }}>✦</div>
        <div style={{ position:"absolute", bottom: 24, right: 36, fontSize: 22, opacity:.5 }}>✧</div>
        <div style={{ position:"relative", height:"100%", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", textAlign:"center", minHeight: 180 }}>
          <div style={{ fontSize: 84, lineHeight: 1 }}>🌍</div>
          <div style={{ marginTop: 12, fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 22, opacity:.95 }}>194 countries · 63 cities</div>
        </div>
      </div>
    </div>

    <div style={{ position:"absolute", bottom: 32, left: 28, right: 28, display:"flex", gap: 10 }}>
      <div onClick={onNext} style={{ flex: 1, height: 56, borderRadius: 16, background:"#0F1419", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap: 8, fontSize: 16, fontWeight: 700, boxShadow:"0 12px 28px -14px rgba(15,20,25,.4)", cursor:"pointer" }}>
        Get started <I name="arrow" size={18} color="#fff" w={2.4} />
      </div>
    </div>
  </Screen>
);

const BoldOnboarding2 = ({ onNext, onBack }) => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />

    <div style={{ padding:"14px 18px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div onClick={onBack} style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
        <I name="chev" size={18} style={{ transform:"rotate(180deg)" }} />
      </div>
      <div style={{ display:"flex", gap: 4, flex: 1, marginLeft: 16, marginRight: 16 }}>
        <span style={{ flex: 1, height: 5, borderRadius: 999, background: BC.transit.ink }} />
        <span style={{ flex: 1, height: 5, borderRadius: 999, background: BC.transit.ink }} />
        <span style={{ flex: 1, height: 5, borderRadius: 999, background:"#E5DDC8" }} />
      </div>
      <Kicker color="#6B7280">2 / 3</Kicker>
    </div>

    <div style={{ padding:"28px 28px 0" }}>
      <Kicker color={BC.food.ink}>Your home country</Kicker>
      <div style={{ marginTop: 6, fontSize: 34, fontWeight: 800, color:"#0F1419", letterSpacing:"-.018em", lineHeight: 1.05 }}>
        Where are <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400, color: BC.food.ink }}>you from?</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 14.5, color:"#475569", lineHeight: 1.55 }}>
        We'll show your home flag on the Home screen as a quiet token of home — and tune currency / phrases to your home language. <span style={{ fontSize: 11.5, color:"#94A3B8" }}>(may change this in settings)</span>
      </div>
    </div>

    <div style={{ padding:"24px 18px 0" }}>
      {/* Search bar */}
      <div style={{ display:"flex", alignItems:"center", gap: 10, height: 50, padding:"0 16px", borderRadius: 14, background:"#FFFFFF", border:"1px solid #F0E9DC", color:"#6B7280" }}>
        <I name="search" size={18} />
        <span style={{ flex: 1, fontSize: 14.5 }}>Search 194 countries…</span>
      </div>

      {/* Country grid — featured picks */}
      <div style={{ marginTop: 16, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 10 }}>
        {[
          { cc:"US", name:"USA",  accent:"#002868" },
          { cc:"GB", name:"UK",   accent:"#012169" },
          { cc:"CA", name:"Canada", accent:"#FF0000" },
          { cc:"MX", name:"Mexico", accent:"#006341" },
          { cc:"BR", name:"Brazil", accent:"#009B3A" },
          { cc:"IN", name:"India",  accent:"#FF9933" },
          { cc:"JP", name:"Japan",  accent:"#BC002D" },
          { cc:"KR", name:"Korea",  accent:"#003478" },
          { cc:"AU", name:"Aussie", accent:"#00008B" },
        ].map((c, i) => (
          <div key={c.cc} onClick={onNext} style={{
            aspectRatio:"1 / 1", borderRadius: 14, overflow:"hidden", position:"relative",
            border: i === 0 ? `3px solid ${BC.food.ink}` : "1px solid #F0E9DC",
            boxShadow: i === 0 ? `0 10px 24px -12px ${BC.food.ink}40` : "0 1px 0 rgba(15,20,25,.03)",
            cursor:"pointer",
          }}>
            <img src={`https://flagcdn.com/w320/${c.cc.toLowerCase()}.png`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, transparent 50%, rgba(0,0,0,.65) 100%)" }} />
            <div style={{ position:"absolute", left: 8, right: 8, bottom: 8, color:"#fff", fontWeight: 700, fontSize: 12.5 }}>{c.name}</div>
            {i === 0 && (
              <div style={{ position:"absolute", top: 8, right: 8, width: 18, height: 18, borderRadius:"50%", background: BC.food.ink, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 11, fontWeight: 800 }}>✓</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, textAlign:"center" }}>
        <span style={{ fontSize: 13, color: BC.transit.ink, fontWeight: 700, textDecoration:"underline" }}>See all 194 countries</span>
      </div>
    </div>

    <div style={{ position:"absolute", bottom: 32, left: 28, right: 28, display:"flex", gap: 10 }}>
      <div onClick={onNext} style={{ flex: 1, height: 56, borderRadius: 16, background:"#0F1419", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap: 8, fontSize: 16, fontWeight: 700, boxShadow:"0 12px 28px -14px rgba(15,20,25,.4)", cursor:"pointer" }}>
        Continue with USA <I name="arrow" size={18} color="#fff" w={2.4} />
      </div>
    </div>
  </Screen>
);

const BoldOnboarding3 = ({ onFinish, onBack }) => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />

    <div style={{ padding:"14px 18px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div onClick={onBack} style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
        <I name="chev" size={18} style={{ transform:"rotate(180deg)" }} />
      </div>
      <div style={{ display:"flex", gap: 4, flex: 1, marginLeft: 16, marginRight: 16 }}>
        <span style={{ flex: 1, height: 5, borderRadius: 999, background: BC.transit.ink }} />
        <span style={{ flex: 1, height: 5, borderRadius: 999, background: BC.transit.ink }} />
        <span style={{ flex: 1, height: 5, borderRadius: 999, background: BC.transit.ink }} />
      </div>
      <Kicker color="#6B7280">3 / 3</Kicker>
    </div>

    <div style={{ padding:"28px 28px 0" }}>
      <Kicker color={BC.convenience.ink}>One last thing</Kicker>
      <div style={{ marginTop: 6, fontSize: 34, fontWeight: 800, color:"#0F1419", letterSpacing:"-.018em", lineHeight: 1.05 }}>
        Find <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400, color: BC.convenience.ink }}>nearby</span> things.
      </div>
      <div style={{ marginTop: 10, fontSize: 14.5, color:"#475569", lineHeight: 1.55 }}>
        Globeskimmers needs your location to show what's open right now within walking distance. We never share it — it doesn't leave your phone.
      </div>
    </div>

    <div style={{ padding:"32px 28px 0" }}>
      <div style={{ padding: 28, borderRadius: 22, background:`linear-gradient(135deg, ${BC.convenience.ink} 0%, #16A34A 60%, #34D399 100%)`, color:"#fff", textAlign:"center", boxShadow:`0 18px 36px -16px ${BC.convenience.ink}80`, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-20, left:-20, width: 100, height: 100, borderRadius:"50%", background:"rgba(255,255,255,.12)" }} />
        <div style={{ position:"absolute", bottom:-30, right:-30, width: 130, height: 130, borderRadius:"50%", background:"rgba(255,255,255,.08)" }} />
        <div style={{ position:"relative", fontSize: 64, lineHeight: 1 }}>📍</div>
        <div style={{ marginTop: 14, position:"relative", fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 22, lineHeight: 1.2 }}>One tap. Six tiles. Anywhere.</div>
      </div>

      <div style={{ marginTop: 20, display:"flex", flexDirection:"column", gap: 8 }}>
        {[
          { ico:"pin",   t:"Locally relevant", s:"Restaurants, ATMs, restrooms — within walking distance." },
          { ico:"clock", t:"Open right now",    s:"Live status. No ghost restaurants." },
          { ico:"globe", t:"Updated weekly",    s:"On-the-ground reviewers in 23 cities." },
        ].map((row, i) => (
          <div key={i} style={{ padding:"10px 14px", borderRadius: 12, background:"#FFFFFF", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: BC.convenience.bg, color: BC.convenience.ink, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <I name={row.ico} size={16} color={BC.convenience.ink} w={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color:"#0F1419" }}>{row.t}</div>
              <div style={{ fontSize: 11.5, color:"#6B7280", marginTop: 1 }}>{row.s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div style={{ position:"absolute", bottom: 32, left: 28, right: 28, display:"flex", flexDirection:"column", gap: 8 }}>
      <div onClick={onFinish} style={{ height: 56, borderRadius: 16, background: BC.convenience.ink, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap: 8, fontSize: 16, fontWeight: 700, boxShadow:`0 14px 32px -14px ${BC.convenience.ink}80`, cursor:"pointer" }}>
        Allow location & finish <I name="arrow" size={18} color="#fff" w={2.4} />
      </div>
      <div style={{ textAlign:"center", fontSize: 13, color:"#6B7280", padding: 6 }}>Maybe later</div>
    </div>
  </Screen>
);

Object.assign(window, {
  BoldTransportation, BoldCoffee, BoldRestroom,
  BoldOnboarding1, BoldOnboarding2, BoldOnboarding3,
});

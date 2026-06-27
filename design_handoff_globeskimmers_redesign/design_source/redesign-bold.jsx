// redesign-bold.jsx — Bold · Eye-catching direction (matches user's actual app structure, elevated)

// ─── Bold category palette (saturated, high-contrast) ─────────────────────
const BC = {
  food:        { ink:"#E63946", bg:"#FFE4E0", soft:"#FFCFC5", name:"Places to eat",     icon:"fork" },
  money:       { ink:"#0F9A6B", bg:"#D8F4E5", soft:"#A8E5C4", name:"Money Exchange",    icon:"cash" },
  coffee:      { ink:"#A85A2E", bg:"#F2DDC4", soft:"#E6BC96", name:"Coffee Finder",     icon:"cup" },
  transit:     { ink:"#3F49D4", bg:"#DFE2FA", soft:"#BBC2F4", name:"Transportation",    icon:"bus" },
  restroom:    { ink:"#0F8A82", bg:"#D2EFEC", soft:"#A7DDD7", name:"Restroom Finder",   icon:"rest" },
  atm:         { ink:"#1F5BD6", bg:"#DCE6FB", soft:"#B3C7F4", name:"ATM Finder",        icon:"atm" },
  weather:     { ink:"#D4861A", bg:"#FCEAC9", soft:"#F4D597", name:"Weather",           icon:"sun" },
  todo:        { ink:"#C5197A", bg:"#FBDEEB", soft:"#F2B0D0", name:"Things to do",      icon:"star" },
  shopping:    { ink:"#7C3AED", bg:"#EAE0FA", soft:"#D0B6F4", name:"Shopping",          icon:"bag" },
  culture:     { ink:"#8B5A1A", bg:"#F3E2C7", soft:"#E5CA98", name:"Culture",           icon:"compass" },
  phrases:     { ink:"#A37013", bg:"#F8ECC4", soft:"#EED890", name:"Basic Phrases",     icon:"lang" },
  convenience: { ink:"#15803D", bg:"#D4F0DA", soft:"#A4DCB0", name:"Convenience Store", icon:"store" },
};

// Brand teal gradient (matches the existing banner)
const TEAL_GRAD = "linear-gradient(135deg, #0E8077 0%, #14B5A6 60%, #2DD4BF 100%)";
const TEAL_DEEP = "#0E7C73";

// ─── Reusable atoms ─────────────────────────────────────────────────────────

// Teal banner (Globeskimmers wordmark at top — matches their current banner)
const BrandBanner = () => (
  <div style={{
    background: TEAL_GRAD, height: 50, display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 700, fontSize: 15.5, letterSpacing: ".02em",
    boxShadow: "0 2px 14px rgba(14,124,115,.25)",
  }}>Globeskimmers</div>
);

// Chunky CTA pill button
const ChunkyBtn = ({ children, color = "#0F1419", textColor = "#fff", icon, size = "md", style = {} }) => (
  <div style={{
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap: 8,
    height: size === "lg" ? 54 : 44, padding: size === "lg" ? "0 22px" : "0 18px",
    borderRadius: 14, background: color, color: textColor,
    fontWeight: 600, fontSize: size === "lg" ? 15.5 : 14, letterSpacing: ".005em",
    boxShadow: "0 6px 18px -6px rgba(0,0,0,.25), 0 1px 0 rgba(255,255,255,.18) inset",
    ...style,
  }}>
    {icon && <I name={icon} size={16} color={textColor} w={2} />} {children}
  </div>
);

// Pill chip (badge style)
const Pill = ({ children, color = "#0F1419", bg = "#F3F4F6", icon, fontSize = 12.5 }) => (
  <div style={{
    display:"inline-flex", alignItems:"center", gap:6,
    padding:"6px 12px", borderRadius: 999, background: bg, color, fontWeight: 600, fontSize,
  }}>
    {icon && <I name={icon} size={13} color={color} w={2} />} {children}
  </div>
);

// Photo block with gradient-stripe placeholder
const Photo = ({ w, h, label, r = 16, tint = "#0E7C73", overlay }) => (
  <div style={{
    width: w, height: h, borderRadius: r, position:"relative", overflow:"hidden", flex:"none",
    background: `linear-gradient(135deg, ${tint} 0%, ${tint}dd 50%, ${tint}aa 100%),
      repeating-linear-gradient(45deg, rgba(255,255,255,.08) 0 10px, transparent 10px 22px)`,
    backgroundBlendMode: "overlay",
    color: "#fff",
  }}>
    <div style={{ position:"absolute", inset:0, padding: 12, display:"flex", flexDirection:"column", justifyContent:"flex-end", color:"rgba(255,255,255,.85)", fontFamily:"var(--mono)", fontSize: 9.5, letterSpacing:".14em", textTransform:"uppercase" }}>
      {label}
    </div>
    {overlay}
  </div>
);

// ============================================================================
// BOLD · HOME
// ============================================================================
const BoldHome = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    <div style={{ padding: "16px 18px 0" }}>
      {/* Greeting card */}
      <div style={{
        background:"#FFFFFF", borderRadius: 22, padding: "18px 18px 16px",
        boxShadow: "0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)",
        border:"1px solid #F0E9DC",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, color:"#6B7280", fontSize:14 }}>
              Hello <span style={{ fontSize: 18 }}>👋</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color:"#0F1419", letterSpacing:"-.018em", lineHeight: 1, marginTop: 2 }}>
              Oliver, in <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", color: TEAL_DEEP, fontWeight: 400 }}>Lisbon</span>
            </div>
          </div>
        </div>

        {/* Location card */}
        <div style={{ marginTop: 14, padding:"12px 14px", borderRadius: 14, background:"#F7F4EC", display:"flex", alignItems:"center", gap: 10 }}>
          <I name="pin" size={18} color={TEAL_DEEP} w={2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color:"#0F1419" }}>Praça do Comércio</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: TEAL_DEEP, textDecoration:"underline" }}>Change location</div>
          </div>
        </div>

        {/* Date / time / weather row */}
        <div style={{ marginTop: 12, padding:"12px 14px", borderRadius: 14, background:"#F7F4EC", display:"flex", justifyContent:"space-between", alignItems:"center", fontSize: 13.5, fontWeight: 600, color:"#0F1419" }}>
          <span>Wed, May 27</span>
          <span>10:57 AM</span>
          <span style={{ display:"flex", alignItems:"center", gap: 6 }}><I name="cloud" size={16} color={TEAL_DEEP} w={2} /> 61°F</span>
        </div>
      </div>

      {/* Featured Money Exchange card */}
      <div style={{
        marginTop: 14, padding:"18px 20px", borderRadius: 22,
        background: `linear-gradient(135deg, ${BC.money.ink} 0%, #0BB572 60%, #16E27A 100%)`,
        color:"#fff", display:"flex", alignItems:"center", gap: 16,
        boxShadow: "0 14px 30px -14px rgba(15,154,107,.5)",
      }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background:"rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center", flex:"none", fontSize: 22, fontWeight: 700, fontFamily:"var(--serif)", letterSpacing: "-.01em" }}>
          $€¥
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing:"-.012em", lineHeight: 1.1 }}>Money Exchange</div>
          <div style={{ marginTop: 4, fontSize: 13, opacity:.9 }}>Compare rates near you · 4 booths live</div>
        </div>
        <I name="chev" size={20} color="#fff" w={2.4} />
      </div>

      {/* Category grid */}
      <div style={{ marginTop: 14, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 10 }}>
        {[BC.transit, BC.food, BC.coffee].map((c, i) => (
          <div key={i} style={{
            aspectRatio: "1 / 1", borderRadius: 18, background: c.ink, color:"#fff",
            display:"flex", flexDirection:"column", justifyContent:"space-between", padding: 14,
            position:"relative", overflow:"hidden",
            boxShadow:`0 10px 24px -12px ${c.ink}80`,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background:"rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <I name={c.icon} size={20} color="#fff" w={2} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.2, letterSpacing:"-.005em" }}>{c.name}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap: 10 }}>
        {[BC.atm, BC.restroom, BC.convenience, BC.weather].map((c, i) => (
          <div key={i} style={{
            aspectRatio: "1 / 1", borderRadius: 16, background: c.ink, color:"#fff",
            display:"flex", flexDirection:"column", justifyContent:"space-between", padding: 11,
            boxShadow:`0 10px 22px -12px ${c.ink}80`,
          }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background:"rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <I name={c.icon} size={16} color="#fff" w={2} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 11.5, lineHeight: 1.2, letterSpacing:"-.003em" }}>{c.name}</div>
          </div>
        ))}
      </div>

      {/* More tools */}
      <div style={{ marginTop: 18, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <Kicker color="#6B7280">More tools</Kicker>
        <span style={{ fontSize: 12, color: TEAL_DEEP, fontWeight: 600 }}>See all →</span>
      </div>
      <div style={{ marginTop: 10, display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap: 10 }}>
        {[BC.todo, BC.shopping, BC.culture, BC.phrases].map((c, i) => (
          <div key={i} style={{ background: c.bg, borderRadius: 14, padding: 10, display:"flex", flexDirection:"column", alignItems:"flex-start", gap: 6, aspectRatio:"1 / 1" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: c.ink, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <I name={c.icon} size={14} color="#fff" w={2} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 10.5, color: c.ink, lineHeight: 1.1, marginTop:"auto" }}>{c.name}</div>
          </div>
        ))}
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="home" />
  </Screen>
);

// ============================================================================
// BOLD · PLACE DETAIL (Domino's-style)
// ============================================================================
const BoldPlaceDetail = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    <div style={{ padding: "14px 16px 0" }}>
      {/* Photo carousel */}
      <div style={{ borderRadius: 22, overflow:"hidden", position:"relative", border:"1px solid #F0E9DC", boxShadow:"0 12px 30px -16px rgba(15,20,25,.18)" }}>
        <Photo w="100%" h={300} label="pizza · slice 5 of 10" tint={BC.food.ink} r={0} overlay={
          <>
            <div style={{ position:"absolute", top: 14, left: 14, width: 44, height: 44, borderRadius:"50%", background:"#FFC93C", border:"3px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 800, fontSize: 18, color:"#7A4B00", boxShadow:"0 4px 10px rgba(0,0,0,.25)" }}>
              1
            </div>
            <div style={{ position:"absolute", top: 16, right: 16, padding:"8px 12px", borderRadius: 999, background:"#fff", color:"#0F9A6B", fontWeight: 700, fontSize: 13, display:"flex", alignItems:"center", gap: 6, boxShadow:"0 4px 12px rgba(0,0,0,.18)" }}>
              ✓ Namesake
            </div>
            <div style={{ position:"absolute", bottom: 14, left:"50%", transform:"translateX(-50%)", display:"flex", gap: 6 }}>
              {[0,1,2,3,4,5,6,7,8,9].map(i => (
                <div key={i} style={{ width: i === 4 ? 18 : 6, height: 6, borderRadius: 999, background: i === 4 ? "#fff" : "rgba(255,255,255,.55)" }} />
              ))}
            </div>
            <div style={{ position:"absolute", bottom: 14, right: 14, padding:"5px 10px", borderRadius: 999, background:"rgba(0,0,0,.55)", color:"#fff", fontSize: 12, fontWeight: 600, display:"flex", alignItems:"center", gap: 6 }}>
              📷 5/10
            </div>
          </>
        } />
      </div>

      {/* Title block */}
      <div style={{ marginTop: 18 }}>
        <div style={{ color: BC.atm.ink, fontWeight: 700, fontSize: 13, letterSpacing:".005em" }}>Pizza Delivery</div>
        <div style={{ marginTop: 4, fontSize: 30, fontWeight: 800, color:"#0F1419", letterSpacing:"-.022em", lineHeight: 1.05 }}>
          Domino's <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400, color: BC.food.ink }}>Pizza</span>
        </div>
        <div style={{ marginTop: 6, color:"#6B7280", fontSize: 14 }}>6805 Sepulveda Blvd, Van Nuys</div>

        {/* Stat row */}
        <div style={{ marginTop: 14, display:"flex", alignItems:"center", gap: 14, fontSize: 14, fontWeight: 600 }}>
          <span style={{ display:"flex", alignItems:"center", gap: 4 }}>
            <span style={{ color:"#F59E0B" }}>★</span> <b>3.9</b> <span style={{ color:"#9CA3AF", fontWeight: 500 }}>(535)</span>
          </span>
          <span style={{ width:3, height:3, borderRadius:"50%", background:"#D1D5DB" }} />
          <span style={{ color: BC.atm.ink, display:"flex", alignItems:"center", gap: 4 }}>
            <I name="pin" size={14} color={BC.atm.ink} w={2.2} /> 0.1 mi
          </span>
          <span style={{ width:3, height:3, borderRadius:"50%", background:"#D1D5DB" }} />
          <span style={{ color:"#6B7280", fontWeight: 700 }}>$</span>
        </div>

        {/* Service pills */}
        <div style={{ marginTop: 14, display:"flex", gap: 8 }}>
          <Pill bg={BC.coffee.bg} color={BC.coffee.ink} icon="bag">Takeout</Pill>
          <Pill bg={BC.food.bg} color={BC.food.ink} icon="bus">Delivery</Pill>
          <Pill bg={BC.convenience.bg} color={BC.convenience.ink}>Dine-in</Pill>
        </div>

        {/* Open hours banner */}
        <div style={{
          marginTop: 14, padding:"14px 16px", borderRadius: 14,
          background: BC.convenience.bg, color: BC.convenience.ink,
          display:"flex", alignItems:"center", gap: 10, fontWeight: 700, fontSize: 14.5,
        }}>
          <span style={{ width:9, height:9, borderRadius:"50%", background: BC.convenience.ink }} />
          Open <span style={{ opacity:.6, fontWeight: 600 }}>·</span> 10:00 AM – 1:00 AM
        </div>

        {/* Parking card */}
        <div style={{ marginTop: 12, padding:"14px 16px", borderRadius: 14, background:"#FFFFFF", border:"1px solid #F0E9DC" }}>
          <div style={{ display:"flex", alignItems:"center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: BC.atm.ink, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 800, fontSize: 14 }}>P</div>
            <div style={{ fontWeight: 700, fontSize: 15, color:"#0F1419" }}>Parking</div>
            <Pill bg={BC.convenience.bg} color={BC.convenience.ink} fontSize={11}>✓ Confirmed</Pill>
          </div>
          <div style={{ marginTop: 10, display:"flex", gap: 8 }}>
            <Pill bg="#F7F4EC" color="#374151" fontSize={12}>🅿️ Free lot</Pill>
            <Pill bg="#F7F4EC" color="#374151" fontSize={12}>🛣 Free street</Pill>
          </div>
        </div>

        {/* Phone card */}
        <div style={{ marginTop: 12, padding:"14px 16px", borderRadius: 14, background: BC.atm.bg, display:"flex", alignItems:"center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius:"50%", background: BC.atm.ink, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <I name="phone" size={18} color="#fff" w={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: BC.atm.ink, letterSpacing:".005em" }}>(818) 909-0088</div>
            <div style={{ fontSize: 12.5, color:"#6B7280", marginTop: 2 }}>Tap to call</div>
          </div>
          <I name="chev" size={18} color={BC.atm.ink} w={2.2} />
        </div>

        {/* Action row */}
        <div style={{ marginTop: 14, display:"flex", gap: 8 }}>
          <div style={{ flex: 1 }}><ChunkyBtn color={BC.weather.ink} size="lg" icon="navs" style={{ width:"100%" }}>Directions</ChunkyBtn></div>
          <ChunkyBtn color={BC.shopping.bg} textColor={BC.shopping.ink} size="lg" icon="map" style={{ paddingInline: 16 }}>Map</ChunkyBtn>
        </div>
      </div>
    </div>

    <div style={{ height: 100 }} />
    <FloatingNav active="search" />
  </Screen>
);

// ============================================================================
// BOLD · THINGS TO DO LIST
// ============================================================================
const SectionHeader = ({ icon, label, count, color }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 18px", margin:"22px 0 12px" }}>
    <div style={{ display:"flex", alignItems:"center", gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 9, background: color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 15 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color:"#0F1419", letterSpacing:"-.012em" }}>{label}</div>
      <div style={{ color:"#9CA3AF", fontWeight: 600, fontSize: 14 }}>({count})</div>
    </div>
    <I name="chev" size={18} color="#9CA3AF" w={2} />
  </div>
);

const ActivityCard = ({ photoTint, title, badge, badgeBg, badgeColor, rating, count, type, typeColor, location }) => (
  <div style={{
    width: 260, flex:"none", background:"#FFFFFF", borderRadius: 20, overflow:"hidden",
    border:"1px solid #F0E9DC", boxShadow:"0 12px 28px -16px rgba(15,20,25,.18)",
  }}>
    <Photo w="100%" h={170} label="photo · 1 of 12" tint={photoTint} r={0} />
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color:"#0F1419", letterSpacing:"-.012em" }}>{title}</div>
      {badge && (
        <div style={{ marginTop: 10, padding:"8px 12px", borderRadius: 12, background: badgeBg, color: badgeColor, fontWeight: 700, fontSize: 12, display:"inline-flex", alignItems:"center", gap: 6 }}>
          ✈️ {badge}
        </div>
      )}
      <div style={{ marginTop: 10, display:"flex", alignItems:"center", gap: 6, fontSize: 13.5 }}>
        <span style={{ color:"#F59E0B" }}>★</span><b style={{ color:"#0F1419" }}>{rating}</b><span style={{ color:"#9CA3AF" }}>({count})</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: typeColor }}>{type}</div>
      <div style={{ marginTop: 4, fontSize: 12.5, color:"#6B7280", display:"flex", alignItems:"center", gap: 4 }}>📍 {location}</div>
      <div style={{ marginTop: 12, display:"flex", gap: 8 }}>
        <ChunkyBtn color={BC.weather.ink} icon="navs" style={{ flex: 1 }}>Directions</ChunkyBtn>
        <div style={{ padding:"0 12px", height: 44, borderRadius: 14, background:"#FFFFFF", border:"1.5px solid #E5DDC8", color:"#374151", fontWeight: 600, fontSize: 13, display:"flex", alignItems:"center", gap: 6 }}>
          <I name="globe" size={14} w={2} /> Site
        </div>
      </div>
    </div>
  </div>
);

const BoldThingsToDo = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    <div style={{ padding: "16px 18px" }}>
      <Kicker color="#6B7280">Around you · Lisbon</Kicker>
      <div style={{ marginTop: 4, fontSize: 28, fontWeight: 800, color:"#0F1419", letterSpacing:"-.018em", lineHeight: 1 }}>
        Things <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400, color: BC.todo.ink }}>to do</span>
      </div>
      <div style={{ marginTop: 8, color:"#6B7280", fontSize: 13.5 }}>120 ideas, sorted for travelers who hate touristy.</div>

      <div style={{ marginTop: 14, display:"flex", gap: 8, overflowX:"auto", paddingBottom: 4 }}>
        {[
          { l:"All", c: BC.todo.ink, active:true },
          { l:"🎨 Culture", c: BC.shopping.ink },
          { l:"🌳 Outdoors", c: BC.convenience.ink },
          { l:"🌃 Nightlife", c: BC.transit.ink },
          { l:"👨‍👩‍👧 Family", c: BC.weather.ink },
          { l:"🆓 Free", c: BC.money.ink },
        ].map((f, i) => (
          <div key={i} style={{
            flex:"none", padding:"8px 14px", borderRadius: 999,
            background: f.active ? f.c : "#fff", color: f.active ? "#fff" : f.c,
            border: f.active ? `1px solid ${f.c}` : "1px solid #E5DDC8",
            fontWeight: 700, fontSize: 13, whiteSpace:"nowrap",
          }}>{f.l}</div>
        ))}
      </div>
    </div>

    <SectionHeader icon="⭐" label="National Icons · USA" count={40} color={BC.weather.ink} />
    <div style={{ display:"flex", gap: 14, overflowX:"auto", padding: "0 18px 4px" }}>
      <ActivityCard photoTint={BC.transit.ink} title="Empire State Building" badge="Flight / Ferry · 2454.0 mi" badgeBg={BC.food.bg} badgeColor={BC.food.ink} rating="4.7" count="127,286" type="Museum / Gallery" typeColor={BC.shopping.ink} location="New York, NY 10001" />
      <ActivityCard photoTint={BC.atm.ink} title="Statue of Liberty" badge="Flight / Ferry · 2451.2 mi" badgeBg={BC.food.bg} badgeColor={BC.food.ink} rating="4.7" count="112,134" type="Historic Site" typeColor={BC.culture.ink} location="New York, NY 10004" />
    </div>

    <SectionHeader icon="💎" label="Regional Must-See · CA" count={20} color={BC.shopping.ink} />
    <div style={{ display:"flex", gap: 14, overflowX:"auto", padding: "0 18px 4px" }}>
      <ActivityCard photoTint={BC.todo.ink} title="Universal Studios" badge="Drive · 23 mi" badgeBg={BC.atm.bg} badgeColor={BC.atm.ink} rating="4.6" count="98,210" type="Theme Park" typeColor={BC.todo.ink} location="Universal City, CA" />
      <ActivityCard photoTint={BC.food.ink} title="Axe Throwing · BRLA" badge="Drive · 14 mi" badgeBg={BC.atm.bg} badgeColor={BC.atm.ink} rating="4.8" count="3,210" type="Activity" typeColor={BC.food.ink} location="Los Angeles, CA" />
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="search" />
  </Screen>
);

// ============================================================================
// BOLD · ACTIVITY DETAIL (Statue of Liberty)
// ============================================================================
const BoldActivityDetail = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />

    {/* Photo hero with overlays */}
    <div style={{ position:"relative", height: 380 }}>
      <Photo w="100%" h={380} label="" tint={BC.atm.ink} r={0} />
      {/* Top controls */}
      <div style={{ position:"absolute", top: 14, left: 16, right: 16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ width: 40, height: 40, borderRadius:"50%", background:"#FFC93C", color:"#7A4B00", display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 800, fontSize: 17, border:"3px solid #fff", boxShadow:"0 4px 10px rgba(0,0,0,.25)" }}>1</div>
        <div style={{ display:"flex", gap: 8, alignItems:"center" }}>
          <Pill bg="#fff" color={BC.culture.ink} fontSize={12}>🏛 Historic Site</Pill>
          <div style={{ width: 36, height: 36, borderRadius:"50%", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <I name="x" size={16} color="#0F1419" w={2.2} />
          </div>
        </div>
      </div>
      {/* Bottom pills */}
      <div style={{ position:"absolute", bottom: 16, left: 16, right: 16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <Pill bg="#fff" color={BC.convenience.ink} fontSize={13}>
          <span style={{ width:9, height:9, borderRadius:"50%", background: BC.convenience.ink, marginRight: 6 }} />
          Open Now
        </Pill>
        <Pill bg="rgba(0,0,0,.65)" color="#fff" fontSize={13}>📍 2451.2 mi</Pill>
      </div>
    </div>

    {/* Sheet */}
    <div style={{ background:"#FFFCF7", borderRadius:"24px 24px 0 0", marginTop: -22, padding: "22px 20px 0", position:"relative" }}>
      <div style={{ fontSize: 30, fontWeight: 800, color:"#0F1419", letterSpacing:"-.022em", lineHeight: 1 }}>
        Statue of <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400, color: BC.atm.ink }}>Liberty</span>
      </div>

      {/* Rating */}
      <div style={{ marginTop: 12, display:"flex", alignItems:"center", gap: 8, fontSize: 15, fontWeight: 700 }}>
        <span style={{ color:"#F59E0B", fontSize: 18 }}>★★★★★</span>
        <b style={{ color:"#0F1419" }}>4.7</b>
        <span style={{ color:"#9CA3AF", fontWeight: 500 }}>(112,134)</span>
      </div>

      {/* Score bar */}
      <div style={{ marginTop: 14, padding:"12px 14px", borderRadius: 14, background:"#FFFFFF", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color:"#6B7280" }}>Score</span>
        <div style={{ flex: 1, height: 8, borderRadius: 999, background:"#F0E9DC", overflow:"hidden" }}>
          <div style={{ width:"82%", height:"100%", borderRadius: 999, background:`linear-gradient(90deg, ${BC.convenience.ink} 0%, #18C24A 100%)` }} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 14, color: BC.convenience.ink }}>Great</span>
      </div>

      {/* Tags */}
      <div style={{ marginTop: 12, display:"flex", gap: 8, flexWrap:"wrap" }}>
        <Pill bg={BC.weather.bg} color={BC.weather.ink} fontSize={12.5}>👨‍👩‍👧 Family Friendly</Pill>
        <Pill bg={BC.todo.bg} color={BC.todo.ink} fontSize={12.5}>📸 Photo Op</Pill>
        <Pill bg={BC.transit.bg} color={BC.transit.ink} fontSize={12.5}>🆓 Free outside</Pill>
      </div>

      {/* Location card */}
      <div style={{ marginTop: 14, padding:"14px 16px", borderRadius: 14, background:"#FFFFFF", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>📍</span>
        <div style={{ fontWeight: 600, fontSize: 14.5, color:"#0F1419", flex: 1 }}>New York, NY 10004, USA</div>
      </div>

      {/* Open hours */}
      <div style={{ marginTop: 10, padding:"14px 16px", borderRadius: 14, background: BC.convenience.bg, color: BC.convenience.ink, display:"flex", alignItems:"center", gap: 10, fontWeight: 700, fontSize: 14.5 }}>
        <span style={{ width:9, height:9, borderRadius:"50%", background: BC.convenience.ink }} />
        Open Now <span style={{ opacity:.6, fontWeight: 600 }}>·</span> 9:00 AM – 4:30 PM
      </div>

      {/* Phone / Website cards */}
      <div style={{ marginTop: 10, padding:"14px 16px", borderRadius: 14, background: BC.atm.bg, display:"flex", alignItems:"center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius:"50%", background: BC.atm.ink, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <I name="phone" size={18} color="#fff" w={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: BC.atm.ink }}>(212) 363-3200</div>
          <div style={{ fontSize: 12.5, color:"#6B7280", marginTop: 2 }}>Tap to call / book</div>
        </div>
        <I name="chev" size={18} color={BC.atm.ink} w={2.2} />
      </div>

      <div style={{ marginTop: 10, padding:"14px 16px", borderRadius: 14, background: BC.weather.bg, display:"flex", alignItems:"center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius:"50%", background: BC.weather.ink, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <I name="globe" size={18} color="#fff" w={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: BC.weather.ink }}>Visit Website / Book</div>
        </div>
        <I name="chev" size={18} color={BC.weather.ink} w={2.2} />
      </div>

      {/* Action buttons */}
      <div style={{ marginTop: 16, display:"flex", gap: 8 }}>
        <ChunkyBtn color={BC.weather.ink} size="lg" icon="navs" style={{ flex: 1 }}>Directions</ChunkyBtn>
        <ChunkyBtn color={BC.shopping.bg} textColor={BC.shopping.ink} size="lg" icon="map">Map</ChunkyBtn>
        <ChunkyBtn color="#F3F4F6" textColor="#374151" size="lg" icon="clock">Hrs</ChunkyBtn>
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="search" />
  </Screen>
);

// ============================================================================
// BOLD · MONEY EXCHANGE
// ============================================================================
const BoldMoneyExchange = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    {/* Hero rate panel */}
    <div style={{ margin: "16px 16px 0", padding: "20px 22px", borderRadius: 22,
      background: `linear-gradient(135deg, ${BC.money.ink} 0%, #10B981 60%, #34D399 100%)`,
      color:"#fff", boxShadow:"0 14px 32px -14px rgba(15,154,107,.5)", position:"relative", overflow:"hidden",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing:".14em", textTransform:"uppercase", opacity:.85, fontWeight: 600 }}>Mid-market rate</div>
          <div style={{ marginTop: 6, fontSize: 44, letterSpacing:"-.022em", lineHeight: 1, fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400 }}>
            €1.00 = $1.08
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity:.8, fontFamily:"var(--mono)", letterSpacing:".1em" }}>Updated 2 min ago · live</div>
        </div>
        <div style={{ padding:"6px 12px", borderRadius: 999, background:"rgba(255,255,255,.18)", fontWeight: 700, fontSize: 12, display:"flex", alignItems:"center", gap: 6 }}>
          EUR → USD <I name="chev" size={12} color="#fff" />
        </div>
      </div>
    </div>

    <div style={{ padding: "16px 18px 0" }}>
      <Kicker color="#6B7280">Booths near you</Kicker>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color:"#0F1419", letterSpacing:"-.014em" }}>
        4 booths within <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400, color: BC.money.ink }}>1 km</span>
      </div>

      <div style={{ marginTop: 16, display:"flex", flexDirection:"column", gap: 10 }}>
        {[
          { name:"Câmbios Praça Rossio", rate:"1.072", fee:"No fee", best:true, dist:"0.3 km" },
          { name:"Unicâmbio · Baixa",    rate:"1.064", fee:"1.5% fee", dist:"0.6 km" },
          { name:"Nova Câmbio",          rate:"1.058", fee:"2% fee", dist:"0.9 km" },
          { name:"Airport branch",       rate:"1.021", fee:"Skip it", dist:"6.4 km", warn:true },
        ].map((b, i) => (
          <div key={i} style={{
            padding:"16px 18px", borderRadius: 16,
            background: b.best ? `linear-gradient(135deg, ${BC.money.ink}, #10B981)` : "#FFFFFF",
            color: b.best ? "#fff" : "#0F1419",
            border: b.best ? "0" : "1px solid #F0E9DC",
            boxShadow: b.best ? "0 14px 28px -14px rgba(15,154,107,.5)" : "0 1px 0 rgba(15,20,25,.04)",
            display:"flex", alignItems:"center", gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: b.best ? "rgba(255,255,255,.18)" : BC.money.bg, color: b.best ? "#fff" : BC.money.ink,
              display:"flex", alignItems:"center", justifyContent:"center", flex:"none", fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 18, fontWeight: 400,
            }}>{i+1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{b.name}</div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: b.best ? .9 : 1, color: b.best ? "rgba(255,255,255,.85)" : (b.warn ? BC.food.ink : "#6B7280"), fontWeight: 600 }}>
                {b.fee} · {b.dist}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 26, letterSpacing:"-.012em", fontWeight: 400 }}>{b.rate}</div>
              {b.best && <div style={{ fontSize: 10, fontFamily:"var(--mono)", letterSpacing:".14em", textTransform:"uppercase", opacity:.85, marginTop: 2 }}>Best rate</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Honest tip */}
      <div style={{ marginTop: 16, padding:"14px 16px", borderRadius: 14, background: BC.weather.bg, color: BC.weather.ink, display:"flex", gap: 10, alignItems:"flex-start" }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>💡</span>
        <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>
          Skip airport exchanges — you'd lose <b>~€4.80</b> on a $100 swap vs. Câmbios Praça Rossio.
        </div>
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="search" />
  </Screen>
);

Object.assign(window, {
  BoldHome, BoldPlaceDetail, BoldThingsToDo, BoldActivityDetail, BoldMoneyExchange,
});

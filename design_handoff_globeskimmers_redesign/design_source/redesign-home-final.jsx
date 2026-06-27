// redesign-home-final.jsx — Final Home direction
// 1) BoldHomeV2: same as BoldHome but with a vibrant Things-to-do row
// 2) Flag-activated greeting card: landscape form, complete flag as bg, 3 contrast treatments

// ─── shared atoms ───────────────────────────────────────────────────────────
const FlagCardImg = ({ cc, opacity = 1, noFade = false, dim = 0 }) => (
  <>
    <div style={{ position:"absolute", inset:0, overflow:"hidden", borderRadius: "inherit" }}>
      <img
        src={`https://flagcdn.com/w640/${cc.toLowerCase()}.png`}
        alt=""
        draggable={false}
        style={{
          width:"100%", height:"100%", objectFit:"cover",
          objectPosition: noFade ? "center" : "left center",
          opacity,
        }}
      />
    </div>
    {dim > 0 && (
      <div style={{ position:"absolute", inset:0, background:`linear-gradient(180deg, rgba(0,0,0,${dim * 0.4}) 0%, rgba(0,0,0,${dim}) 100%)`, borderRadius:"inherit" }} />
    )}
  </>
);

// Landscape-proportioned greeting card with flag background
const FlagGreetingCard = ({ cc, level = "bold", city = "Lisbon", area = "Praça do Comércio", date = "Wed, May 27", time = "10:57 AM", temp = "61°F" }) => {
  // 3 contrast treatments
  const cfg = ({
    // SUBTLE: flag at low opacity behind white-tinted card, dark text. Editorial.
    subtle: {
      flagOpacity: 0.35, dim: 0,
      surface: "rgba(255,253,247,.55)",
      surfaceBlur: "blur(8px) saturate(140%)",
      text: "#0F1419", subtext: "#475569", accent: "#0E7C73",
      pillBg: "rgba(15,20,25,.08)", pillText: "#0F1419",
      cardBg: "rgba(255,255,255,.62)", cardText: "#0F1419",
    },
    // MEDIUM: flag at ~70% with bottom scrim, light text. Balanced.
    medium: {
      flagOpacity: 0.7, dim: 0.55,
      surface: "transparent",
      surfaceBlur: "none",
      text: "#FFFFFF", subtext: "rgba(255,255,255,.85)", accent: "#FFE7A3",
      pillBg: "rgba(255,255,255,.22)", pillText: "#FFFFFF",
      cardBg: "rgba(0,0,0,.32)", cardText: "#FFFFFF",
    },
    // BOLD: flag at 100% with strong scrim, big white type. Maximum patriotism.
    bold: {
      flagOpacity: 1, dim: 0.7,
      surface: "transparent",
      surfaceBlur: "none",
      text: "#FFFFFF", subtext: "rgba(255,255,255,.9)", accent: "#FFE7A3",
      pillBg: "rgba(255,255,255,.24)", pillText: "#FFFFFF",
      cardBg: "rgba(0,0,0,.38)", cardText: "#FFFFFF",
    },
  })[level];

  const cc_data = FLAGS[cc] || {};
  const noFade = cc_data.noFade;

  return (
    <div style={{
      position:"relative", borderRadius: 22, overflow:"hidden",
      aspectRatio: "3 / 2",        // landscape, ~ flag proportion
      boxShadow: "0 14px 30px -14px rgba(15,20,25,.18), 0 0 0 1px rgba(15,20,25,.04)",
    }}>
      <FlagCardImg cc={cc} opacity={cfg.flagOpacity} noFade={noFade} dim={cfg.dim} />

      <div style={{
        position:"relative", zIndex: 2, height:"100%",
        display:"flex", flexDirection:"column", justifyContent:"space-between",
        padding: "16px 18px",
        background: cfg.surface, backdropFilter: cfg.surfaceBlur, WebkitBackdropFilter: cfg.surfaceBlur,
      }}>
        {/* TOP: greeting + country pill */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize: 13.5, color: cfg.subtext, fontWeight: 500 }}>Hello 👋</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: cfg.text, letterSpacing:"-.018em", lineHeight: 1, marginTop: 2, textShadow: level !== "subtle" ? "0 2px 12px rgba(0,0,0,.25)" : "none" }}>
              Oliver, in <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", color: cfg.accent, fontWeight: 400 }}>{city}</span>
            </div>
          </div>
          <div style={{
            padding:"5px 11px", borderRadius: 999, background: cfg.pillBg, color: cfg.pillText,
            fontSize: 11.5, fontWeight: 700, display:"flex", alignItems:"center", gap: 6,
            backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
          }}>
            <span style={{ width: 14, height: 10, borderRadius: 2, background: cc_data.accent || "#000", display:"inline-block" }} />
            {cc} · home
          </div>
        </div>

        {/* BOTTOM: location + meta row */}
        <div style={{ display:"flex", gap: 8 }}>
          <div style={{ flex: 1, padding:"10px 12px", borderRadius: 12, background: cfg.cardBg, color: cfg.cardText,
            backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
            border: level === "subtle" ? "1px solid rgba(15,20,25,.08)" : "1px solid rgba(255,255,255,.16)",
            display:"flex", alignItems:"center", gap: 10 }}>
            <I name="pin" size={16} color={cfg.accent} w={2} />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{area}</div>
          </div>
          <div style={{ padding:"10px 12px", borderRadius: 12, background: cfg.cardBg, color: cfg.cardText,
            backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
            border: level === "subtle" ? "1px solid rgba(15,20,25,.08)" : "1px solid rgba(255,255,255,.16)",
            display:"flex", alignItems:"center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
            <I name="cloud" size={14} color={cfg.accent} w={2} /> {temp}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Plain (non-flag) greeting card from BoldHome — keeping it intact ─────
const PlainGreetingCard = () => (
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
        <div style={{ fontSize: 30, fontWeight: 800, color:"#0F1419", letterSpacing:"-.018em", lineHeight: 1, marginTop: 2 }}>
          Oliver, in <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", color: "#0E7C73", fontWeight: 400 }}>Lisbon</span>
        </div>
      </div>
    </div>
    <div style={{ marginTop: 14, padding:"12px 14px", borderRadius: 14, background:"#F7F4EC", display:"flex", alignItems:"center", gap: 10 }}>
      <I name="pin" size={18} color="#0E7C73" w={2} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, color:"#0F1419" }}>Praça do Comércio</div>
        <div style={{ marginTop: 2, fontSize: 12.5, color: "#0E7C73", textDecoration:"underline" }}>Change location</div>
      </div>
    </div>
    <div style={{ marginTop: 12, padding:"12px 14px", borderRadius: 14, background:"#F7F4EC", display:"flex", justifyContent:"space-between", alignItems:"center", fontSize: 13.5, fontWeight: 600, color:"#0F1419" }}>
      <span>Wed, May 27</span>
      <span>10:57 AM</span>
      <span style={{ display:"flex", alignItems:"center", gap: 6 }}><I name="cloud" size={16} color="#0E7C73" w={2} /> 61°F</span>
    </div>
  </div>
);

// ─── The body of BoldHome below the greeting card (shared by all variants) ─
const BoldHomeBody = () => (
  <>
    {/* Featured Money Exchange */}
    <div style={{ marginTop: 14, padding:"18px 20px", borderRadius: 22,
      background: `linear-gradient(135deg, ${BC.money.ink} 0%, #0BB572 60%, #16E27A 100%)`,
      color:"#fff", display:"flex", alignItems:"center", gap: 16,
      boxShadow: "0 14px 30px -14px rgba(15,154,107,.5)",
    }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background:"rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center", flex:"none", fontSize: 22, fontFamily:"var(--serif)", fontStyle:"italic", letterSpacing: "-.01em" }}>
        $€¥
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing:"-.012em", lineHeight: 1.1 }}>Money Exchange</div>
        <div style={{ marginTop: 4, fontSize: 13, opacity:.9 }}>Compare rates near you · 4 booths live</div>
      </div>
      <I name="chev" size={20} color="#fff" w={2.4} />
    </div>

    {/* 3-col main grid */}
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

    {/* 4-col secondary grid */}
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

    {/* ⭐ NEW: Things to do as a vibrant FEATURE row — gradient backgrounds,
        decorative shapes, real visual presence */}
    <div style={{ marginTop: 18, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <Kicker color="#6B7280">Explore more</Kicker>
      <span style={{ fontSize: 12, color: "#0E7C73", fontWeight: 600 }}>See all →</span>
    </div>
    <div style={{ marginTop: 10, display:"grid", gridTemplateColumns:"1fr 1fr", gap: 10 }}>
      {/* Things to do — magenta gradient with sparkle deco */}
      <div style={{
        aspectRatio: "1.3 / 1", borderRadius: 18, color:"#fff", padding: 14,
        background: `linear-gradient(135deg, ${BC.todo.ink} 0%, #E84393 60%, #FF7DB1 100%)`,
        position:"relative", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"space-between",
        boxShadow:`0 12px 26px -12px ${BC.todo.ink}80`,
      }}>
        <div style={{ position:"absolute", top:-10, right:-10, width: 70, height: 70, borderRadius:"50%", background:"rgba(255,255,255,.14)" }} />
        <div style={{ position:"absolute", top: 22, right: 28, fontSize: 22, opacity:.7 }}>✦</div>
        <div style={{ position:"absolute", bottom: 18, right: 16, fontSize: 14, opacity:.5 }}>✧</div>
        <div style={{ width: 36, height: 36, borderRadius: 11, background:"rgba(255,255,255,.22)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
          <I name="star" size={18} color="#fff" w={2} />
        </div>
        <div style={{ position:"relative" }}>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing:"-.005em" }}>Things to do</div>
          <div style={{ fontSize: 11.5, opacity:.9, marginTop: 2 }}>120 picks · Lisbon</div>
        </div>
      </div>

      {/* Shopping — violet gradient with bag deco */}
      <div style={{
        aspectRatio: "1.3 / 1", borderRadius: 18, color:"#fff", padding: 14,
        background: `linear-gradient(135deg, ${BC.shopping.ink} 0%, #A855F7 60%, #C084FC 100%)`,
        position:"relative", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"space-between",
        boxShadow:`0 12px 26px -12px ${BC.shopping.ink}80`,
      }}>
        <div style={{ position:"absolute", top:-14, right:-14, width: 80, height: 80, borderRadius: 16, transform:"rotate(20deg)", background:"rgba(255,255,255,.12)" }} />
        <div style={{ width: 36, height: 36, borderRadius: 11, background:"rgba(255,255,255,.22)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
          <I name="bag" size={18} color="#fff" w={2} />
        </div>
        <div style={{ position:"relative" }}>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing:"-.005em" }}>Shopping</div>
          <div style={{ fontSize: 11.5, opacity:.9, marginTop: 2 }}>Markets · malls</div>
        </div>
      </div>

      {/* Culture — sienna gradient with compass deco */}
      <div style={{
        aspectRatio: "1.3 / 1", borderRadius: 18, color:"#fff", padding: 14,
        background: `linear-gradient(135deg, ${BC.culture.ink} 0%, #D97706 60%, #FBBF24 100%)`,
        position:"relative", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"space-between",
        boxShadow:`0 12px 26px -12px ${BC.culture.ink}80`,
      }}>
        <div style={{ position:"absolute", top:-10, right:-10, width: 60, height: 60, borderRadius:"50%", border:"3px solid rgba(255,255,255,.18)" }} />
        <div style={{ width: 36, height: 36, borderRadius: 11, background:"rgba(255,255,255,.22)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
          <I name="compass" size={18} color="#fff" w={2} />
        </div>
        <div style={{ position:"relative" }}>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing:"-.005em" }}>Culture</div>
          <div style={{ fontSize: 11.5, opacity:.9, marginTop: 2 }}>Museums · sights</div>
        </div>
      </div>

      {/* Phrases — gold gradient with あ deco */}
      <div style={{
        aspectRatio: "1.3 / 1", borderRadius: 18, color:"#fff", padding: 14,
        background: `linear-gradient(135deg, ${BC.phrases.ink} 0%, #CA8A04 60%, #EAB308 100%)`,
        position:"relative", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"space-between",
        boxShadow:`0 12px 26px -12px ${BC.phrases.ink}80`,
      }}>
        <div style={{ position:"absolute", top: 12, right: 14, fontSize: 30, fontFamily:"var(--serif)", opacity:.28, fontStyle:"italic", color:"#fff", letterSpacing:"-.02em" }}>あ</div>
        <div style={{ width: 36, height: 36, borderRadius: 11, background:"rgba(255,255,255,.22)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
          <I name="lang" size={18} color="#fff" w={2} />
        </div>
        <div style={{ position:"relative" }}>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing:"-.005em" }}>Phrases</div>
          <div style={{ fontSize: 11.5, opacity:.9, marginTop: 2 }}>50 essentials</div>
        </div>
      </div>
    </div>
  </>
);

// ============================================================================
// BOLD HOME V2 — featured + vibrant Things-to-do row (no flag)
// ============================================================================
const BoldHomeV2 = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />
    <div style={{ padding: "16px 18px 0" }}>
      <PlainGreetingCard />
      <BoldHomeBody />
    </div>
    <div style={{ height: 110 }} />
    <FloatingNav active="home" />
  </Screen>
);

// ============================================================================
// FLAG VARIANTS — same body, swap the greeting card for flag-backed version
// ============================================================================
const makeFlagHome = (cc, level) => () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />
    <div style={{ padding: "16px 18px 0" }}>
      <FlagGreetingCard cc={cc} level={level} />
      <BoldHomeBody />
    </div>
    <div style={{ height: 110 }} />
    <FloatingNav active="home" />
  </Screen>
);

const FlagHomeUS_Subtle = makeFlagHome("US", "subtle");
const FlagHomeUS_Medium = makeFlagHome("US", "medium");
const FlagHomeUS_Bold   = makeFlagHome("US", "bold");

const FlagHomeJP_Bold   = makeFlagHome("JP", "bold");
const FlagHomeMX_Medium = makeFlagHome("MX", "medium");
const FlagHomeIN_Bold   = makeFlagHome("IN", "bold");

Object.assign(window, {
  BoldHomeV2,
  FlagHomeUS_Subtle, FlagHomeUS_Medium, FlagHomeUS_Bold,
  FlagHomeJP_Bold, FlagHomeMX_Medium, FlagHomeIN_Bold,
});

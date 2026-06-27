// redesign-home-variations.jsx — Equal-weight Home variations with flag overlay

// ─── 12 features, equal weight, in a sensible order ────────────────────────
const FEATURES = [
  { key:"food",        label:"Eat",          icon:"fork",   color: BC.food },
  { key:"money",       label:"Money",        icon:"cash",   color: BC.money },
  { key:"coffee",      label:"Coffee",       icon:"cup",    color: BC.coffee },
  { key:"atm",         label:"ATM",          icon:"atm",    color: BC.atm },
  { key:"restroom",    label:"Restroom",     icon:"rest",   color: BC.restroom },
  { key:"transit",     label:"Transit",      icon:"bus",    color: BC.transit },
  { key:"weather",     label:"Weather",      icon:"sun",    color: BC.weather },
  { key:"todo",        label:"Things to do", icon:"star",   color: BC.todo },
  { key:"shopping",    label:"Shopping",     icon:"bag",    color: BC.shopping },
  { key:"culture",     label:"Culture",      icon:"compass",color: BC.culture },
  { key:"phrases",     label:"Phrases",      icon:"lang",   color: BC.phrases },
  { key:"convenience", label:"24h store",    icon:"store",  color: BC.convenience },
];

// ─── Flag config (subset — extend as needed) ───────────────────────────────
const FLAGS = {
  US: { accent: "#002868", light: false, name: "United States" },
  JP: { accent: "#BC002D", light: true,  name: "Japan", noFade: true },
  MX: { accent: "#006341", light: false, name: "Mexico" },
  IN: { accent: "#FF9933", light: false, name: "India" },
  BR: { accent: "#009B3A", light: false, name: "Brazil" },
  GB: { accent: "#012169", light: false, name: "United Kingdom" },
  FR: { accent: "#002395", light: false, name: "France" },
  PT: { accent: "#006600", light: false, name: "Portugal" },
};

const flagUrl = (cc) => `https://flagcdn.com/w640/${cc.toLowerCase()}.png`;

// ─── Equal-weight tile ─────────────────────────────────────────────────────
// Two visual modes: "solid" (saturated bg) or "outline" (white bg, color icon).
// Both treat every feature with the same footprint.
const EqTile = ({ feature, mode = "solid", tone = "light" }) => {
  const c = feature.color;
  if (mode === "outline") {
    return (
      <div style={{
        aspectRatio: "1 / 1", borderRadius: 18,
        background: tone === "dark" ? "rgba(255,255,255,.08)" : "#FFFFFF",
        border: tone === "dark" ? "1px solid rgba(255,255,255,.18)" : "1px solid #F0E9DC",
        boxShadow: tone === "dark" ? "none" : "0 1px 0 rgba(15,20,25,.04), 0 6px 16px -10px rgba(15,20,25,.08)",
        padding: 12, display:"flex", flexDirection:"column", justifyContent:"space-between",
        color: tone === "dark" ? "#fff" : "#0F1419",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, background: c.bg, color: c.ink,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <I name={feature.icon} size={20} color={c.ink} w={2} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 13.5, letterSpacing:"-.005em" }}>{feature.label}</div>
      </div>
    );
  }
  // solid (saturated)
  return (
    <div style={{
      aspectRatio: "1 / 1", borderRadius: 18,
      background: c.ink, color:"#fff",
      padding: 12, display:"flex", flexDirection:"column", justifyContent:"space-between",
      position:"relative", overflow:"hidden",
      boxShadow:`0 8px 22px -12px ${c.ink}80`,
    }}>
      <div style={{
        position:"absolute", top:-12, right:-12, width: 70, height: 70, borderRadius:"50%",
        background: "rgba(255,255,255,.12)",
      }} />
      <div style={{
        width: 38, height: 38, borderRadius: 11, background:"rgba(255,255,255,.2)",
        display:"flex", alignItems:"center", justifyContent:"center", position:"relative",
      }}>
        <I name={feature.icon} size={20} color="#fff" w={2} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 13.5, letterSpacing:"-.005em", position:"relative" }}>{feature.label}</div>
    </div>
  );
};

// ─── Flag overlay backdrop (replicates HomeFlagOverlay.jsx behavior) ──────
const FlagBackdrop = ({ cc }) => {
  if (!cc) return null;
  const cfg = FLAGS[cc];
  const noFade = cfg?.noFade;
  const mask = noFade ? "none" :
    "linear-gradient(to right, black 0%, black 65%, rgba(0,0,0,0.3) 85%, transparent 98%)";
  return (
    <div style={{
      position:"absolute", inset: 0, zIndex: 0, overflow:"hidden",
      pointerEvents:"none",
    }}>
      <img
        src={flagUrl(cc)}
        alt=""
        style={{
          width:"100%", height:"100%", objectFit:"cover",
          opacity: noFade ? 0.85 : 1,
          maskImage: mask !== "none" ? mask : undefined,
          WebkitMaskImage: mask !== "none" ? mask : undefined,
        }}
      />
    </div>
  );
};

// ─── Greeting block — adapts to flag light/dark ────────────────────────────
const FlagGreeting = ({ city = "Lisbon", area = "Alfama", cc, fontDark = false }) => {
  const onBg = fontDark; // text dark when flag is light
  const fg = onBg ? "#0F1419" : "#FFFFFF";
  const muted = onBg ? "#475569" : "rgba(255,255,255,.85)";
  const cardBg = onBg ? "rgba(255,255,255,.78)" : "rgba(0,0,0,.42)";
  const cardBorder = onBg ? "1px solid rgba(15,20,25,.08)" : "1px solid rgba(255,255,255,.18)";

  return (
    <div style={{
      position:"relative", zIndex: 2,
      borderRadius: 22, padding: "16px 18px 14px",
      background: cardBg, border: cardBorder,
      backdropFilter:"blur(18px) saturate(140%)", WebkitBackdropFilter:"blur(18px) saturate(140%)",
      color: fg,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize: 13.5, color: muted }}>Hello 👋</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing:"-.018em", lineHeight: 1.05, marginTop: 2 }}>
            Oliver, in <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", color: onBg ? "#0E7C73" : "#FFE7A3", fontWeight: 400 }}>{city}</span>
          </div>
        </div>
        {cc && (
          <div style={{
            padding:"5px 11px", borderRadius: 999,
            background: onBg ? "rgba(15,20,25,.08)" : "rgba(255,255,255,.18)",
            fontSize: 12, fontWeight: 700, display:"flex", alignItems:"center", gap: 6,
          }}>
            <span style={{ width: 14, height: 10, borderRadius: 2, background: FLAGS[cc].accent, display:"inline-block" }} />
            {cc} · home
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, padding:"10px 12px", borderRadius: 12,
        background: onBg ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.14)",
        display:"flex", alignItems:"center", gap: 10, fontSize: 13.5, fontWeight: 600 }}>
        <I name="pin" size={16} color={onBg ? "#0E7C73" : "#FFE7A3"} w={2} />
        <span style={{ flex: 1 }}>{area}</span>
        <span style={{ opacity:.7 }}>14:08 · 22°</span>
      </div>
    </div>
  );
};

// ============================================================================
// HOME V·EQ1 — Equal 3×4 grid, no flag, solid saturated tiles
// ============================================================================
const HomeEqual = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    <div style={{ padding: "16px 18px 0" }}>
      <FlagGreeting fontDark />

      <div style={{ marginTop: 14, marginBottom: 8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Kicker color="#6B7280">All tools · equal weight</Kicker>
        <span style={{ fontSize: 12, color:"#6B7280", fontWeight: 600 }}>Customize →</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 10 }}>
        {FEATURES.map((f) => <EqTile key={f.key} feature={f} mode="solid" />)}
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="home" />
  </Screen>
);

// ============================================================================
// HOME V·EQ2 — Equal 3×4 grid, outline (white) tiles
// ============================================================================
const HomeEqualOutline = () => (
  <Screen bg="#F7F4EC">
    <StatusSpacer h={54} />
    <BrandBanner />

    <div style={{ padding: "16px 18px 0" }}>
      <FlagGreeting fontDark />

      <div style={{ marginTop: 14, marginBottom: 8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Kicker color="#6B7280">All tools · equal weight</Kicker>
        <span style={{ fontSize: 12, color:"#6B7280", fontWeight: 600 }}>Customize →</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 10 }}>
        {FEATURES.map((f) => <EqTile key={f.key} feature={f} mode="outline" />)}
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="home" />
  </Screen>
);

// ============================================================================
// HOME V·FLAG-US — Equal grid with USA flag overlay (75/25 fade)
// ============================================================================
const HomeFlagUS = () => (
  <Screen bg="#0F1419">
    <StatusSpacer h={54} />
    <FlagBackdrop cc="US" />
    {/* dim layer on right for readability of tiles area */}
    <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right, rgba(0,32,104,.05) 0%, rgba(255,253,247,.0) 55%, rgba(255,253,247,.85) 80%, #FFFCF7 100%)", zIndex: 1 }} />

    <div style={{ position:"relative", zIndex: 2 }}>
      <BrandBanner />
      <div style={{ padding: "16px 18px 0" }}>
        <FlagGreeting cc="US" />

        <div style={{ marginTop: 14, marginBottom: 8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <Kicker color="rgba(255,255,255,.9)">All tools · equal weight</Kicker>
          <span style={{ fontSize: 12, color:"rgba(255,255,255,.9)", fontWeight: 600 }}>Customize →</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 10 }}>
          {FEATURES.map((f) => <EqTile key={f.key} feature={f} mode="solid" />)}
        </div>
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="home" dark />
  </Screen>
);

// ============================================================================
// HOME V·FLAG-JP — Equal grid with Japan flag (NO FADE, respect)
// Flag bleeds full-bleed with reduced opacity. Tiles sit on top.
// ============================================================================
const HomeFlagJP = () => (
  <Screen bg="#FFFFFF">
    <StatusSpacer h={54} />
    <FlagBackdrop cc="JP" />
    {/* No fade — Japan gets the full circle. We use white-glass cards over it. */}

    <div style={{ position:"relative", zIndex: 2 }}>
      <BrandBanner />
      <div style={{ padding: "16px 18px 0" }}>
        <FlagGreeting cc="JP" fontDark />

        <div style={{ marginTop: 14, marginBottom: 8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <Kicker color="#0F1419">All tools · equal weight</Kicker>
          <span style={{ fontSize: 12, color:"#0F1419", fontWeight: 600 }}>Customize →</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 10 }}>
          {FEATURES.map((f) => <EqTile key={f.key} feature={f} mode="outline" />)}
        </div>
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="home" />
  </Screen>
);

// ============================================================================
// HOME V·FLAG-MX — Equal grid with Mexico flag (75/25 fade · solid tiles)
// ============================================================================
const HomeFlagMX = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <FlagBackdrop cc="MX" />
    <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right, rgba(0,99,65,.05) 0%, rgba(255,253,247,0) 55%, rgba(255,253,247,.9) 82%, #FFFCF7 100%)", zIndex: 1 }} />

    <div style={{ position:"relative", zIndex: 2 }}>
      <BrandBanner />
      <div style={{ padding: "16px 18px 0" }}>
        <FlagGreeting cc="MX" />

        <div style={{ marginTop: 14, marginBottom: 8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <Kicker color="rgba(255,255,255,.9)">All tools · equal weight</Kicker>
          <span style={{ fontSize: 12, color:"rgba(255,255,255,.9)", fontWeight: 600 }}>Customize →</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 10 }}>
          {FEATURES.map((f) => <EqTile key={f.key} feature={f} mode="solid" />)}
        </div>
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="home" />
  </Screen>
);

// ============================================================================
// HOME V·LIST — Equal-weight vertical list (alt layout for accessibility / long names)
// ============================================================================
const HomeEqualList = () => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />

    <div style={{ padding: "16px 18px 0" }}>
      <FlagGreeting fontDark />

      <div style={{ marginTop: 14, marginBottom: 8 }}>
        <Kicker color="#6B7280">All tools · equal weight</Kicker>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap: 8 }}>
        {FEATURES.map((f) => {
          const c = f.color;
          return (
            <div key={f.key} style={{
              display:"flex", alignItems:"center", gap: 14, padding: 12,
              borderRadius: 14, background:"#FFFFFF", border:"1px solid #F0E9DC",
              boxShadow:"0 1px 0 rgba(15,20,25,.03)",
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: c.ink, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <I name={f.icon} size={20} color="#fff" w={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color:"#0F1419", letterSpacing:"-.005em" }}>{f.label}</div>
                <div style={{ fontSize: 12, color:"#6B7280", marginTop: 2 }}>Find {f.label.toLowerCase()} nearby</div>
              </div>
              <I name="chev" size={18} color="#94A3B8" w={2.2} />
            </div>
          );
        })}
      </div>
    </div>

    <div style={{ height: 110 }} />
    <FloatingNav active="home" />
  </Screen>
);

Object.assign(window, {
  HomeEqual, HomeEqualOutline, HomeFlagUS, HomeFlagJP, HomeFlagMX, HomeEqualList,
});

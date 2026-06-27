// redesign-proto.jsx — Clickable prototype router

const { useState, useEffect, useCallback } = React;

// Each "category tile" on Home maps to a screen route.
// We override the Home's tiles + bottom nav to actually navigate.

const ROUTES = {
  home:         { label: "Home" },
  onboarding:   { label: "Onboarding" },
  eat:          { label: "Places to Eat" },
  "eat-detail": { label: "Place Detail" },
  coffee:       { label: "Coffee Finder" },
  money:        { label: "Money Exchange" },
  transit:      { label: "Transportation" },
  restroom:     { label: "Restroom Finder" },
  todo:         { label: "Things to Do" },
  "todo-detail":{ label: "Activity Detail" },
};

// ─── Wrapper: clickable Home that maps tile taps to routes ─────────────────
const ClickableHome = ({ go }) => {
  const tileMap = {
    "Places to eat": "eat",
    "Coffee Finder": "coffee",
    "Coffee": "coffee",
    "Money Exchange": "money",
    "Money": "money",
    "Transportation": "transit",
    "Transit": "transit",
    "Restroom Finder": "restroom",
    "Restroom": "restroom",
    "Things to do": "todo",
    "ATM Finder": null, // not built yet
    "ATM": null,
    "Weather": null,
    "Shopping": null,
    "Convenience Store": null,
    "24h store": null,
    "Culture": null,
    "Phrases": null,
    "Basic Phrases": null,
    "Eat": "eat",
  };

  // Use the BoldHomeV2 base then intercept clicks via event delegation
  useEffect(() => {
    const root = document.getElementById("proto-home");
    if (!root) return;
    const onClick = (e) => {
      // Walk up the DOM looking for a tile-like element
      let el = e.target;
      while (el && el !== root) {
        const txt = el.textContent?.trim();
        if (txt && tileMap[txt] !== undefined) {
          const dest = tileMap[txt];
          if (dest) {
            e.preventDefault();
            e.stopPropagation();
            go(dest);
            return;
          }
        }
        el = el.parentElement;
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [go]);

  return (
    <div id="proto-home">
      <BoldHomeV2 />
    </div>
  );
};

// ─── Stub for screens we haven't built ─────────────────────────────────────
const StubScreen = ({ label, onBack }) => (
  <Screen bg="#FFFCF7">
    <StatusSpacer h={54} />
    <BrandBanner />
    <div style={{ padding:"14px 18px 0" }}>
      <div onClick={onBack} style={{ width: 40, height: 40, borderRadius:"50%", background:"#fff", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
        <I name="chev" size={18} style={{ transform:"rotate(180deg)" }} />
      </div>
    </div>
    <div style={{ padding:"60px 28px", textAlign:"center" }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🛠</div>
      <div style={{ fontSize: 30, fontWeight: 800, color:"#0F1419", letterSpacing:"-.018em", lineHeight: 1.1 }}>
        <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400, color:"#0E7C73" }}>{label}</span><br />
        coming soon
      </div>
      <div style={{ marginTop: 14, color:"#475569", fontSize: 14.5, lineHeight: 1.5 }}>
        This screen isn't in the prototype yet. Tap back to return Home.
      </div>
    </div>
    <FloatingNav active="home" />
  </Screen>
);

// ─── Things to do detail launches Statue of Liberty ────────────────────────
const ClickableTodo = ({ go, back }) => {
  // Re-render BoldThingsToDo but capture clicks on cards → go to detail
  useEffect(() => {
    const root = document.getElementById("proto-todo");
    if (!root) return;
    const onClick = (e) => {
      let el = e.target;
      while (el && el !== root) {
        // crude: any "Directions" or activity card row leads to detail
        if (el.textContent?.includes("Statue of Liberty") || el.textContent?.includes("Empire State")) {
          e.preventDefault(); e.stopPropagation(); go("todo-detail"); return;
        }
        el = el.parentElement;
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [go]);
  return <div id="proto-todo"><BoldThingsToDo /></div>;
};

// ─── Eat list intercepts → eat detail ──────────────────────────────────────
// We don't have a bold eat list yet, so use the bold place detail directly.

// ─── Main App ──────────────────────────────────────────────────────────────
const ProtoApp = () => {
  const [stack, setStack] = useState(["onboarding-1"]);
  const current = stack[stack.length - 1];

  const go = useCallback((route) => {
    setStack(s => [...s, route]);
  }, []);
  const back = useCallback(() => {
    setStack(s => s.length > 1 ? s.slice(0, -1) : s);
  }, []);
  const reset = useCallback((route) => {
    setStack([route]);
  }, []);

  let screen;
  switch (current) {
    case "onboarding-1":
      screen = <BoldOnboarding1 onNext={() => go("onboarding-2")} />;
      break;
    case "onboarding-2":
      screen = <BoldOnboarding2 onNext={() => go("onboarding-3")} onBack={back} />;
      break;
    case "onboarding-3":
      screen = <BoldOnboarding3 onFinish={() => reset("home")} onBack={back} />;
      break;
    case "home":
      screen = <ClickableHome go={go} />;
      break;
    case "eat":
      // No bold eat list yet — go straight to detail
      screen = <BoldPlaceDetail />;
      break;
    case "eat-detail":
      screen = <BoldPlaceDetail />;
      break;
    case "coffee":
      screen = <BoldCoffee onBack={back} />;
      break;
    case "money":
      screen = <BoldMoneyExchange />;
      break;
    case "transit":
      screen = <BoldTransportation onBack={back} />;
      break;
    case "restroom":
      screen = <BoldRestroom onBack={back} />;
      break;
    case "todo":
      screen = <ClickableTodo go={go} back={back} />;
      break;
    case "todo-detail":
      screen = <BoldActivityDetail />;
      break;
    default:
      screen = <StubScreen label={current} onBack={back} />;
  }

  // Catch FloatingNav home taps to navigate
  useEffect(() => {
    const onClick = (e) => {
      // Look for a FloatingNav home icon click. The floating nav is a fixed pill
      // near the bottom. Any tap inside it that isn't already routed → go home.
      const target = e.target;
      const navPill = target.closest('[role="floatingnav"]');
      if (navPill && current !== "home") {
        reset("home");
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [current, reset]);

  const routeLabel = ROUTES[current]?.label || "Onboarding";

  return (
    <div className="stage">
      <div className="stage-title">Globeskimmers · clickable prototype</div>
      <div className="stage-hint">
        {current === "onboarding-1" || current === "onboarding-2" || current === "onboarding-3"
          ? `Onboarding step ${current.split("-")[1]} of 3`
          : `${routeLabel} · tap any tile on Home to navigate`}
      </div>

      <div style={{ position: "relative" }}>
        <IOSDevice width={402} height={874}>
          {screen}
        </IOSDevice>

        {/* Floating reset button outside the phone */}
        {current !== "onboarding-1" && (
          <button
            onClick={() => reset("onboarding-1")}
            style={{
              position:"absolute", top: 0, right: -90, width: 80,
              padding:"8px 0", borderRadius: 999, background:"rgba(255,255,255,.08)",
              border:"1px solid rgba(255,255,255,.18)", color:"#EDE6D8",
              fontFamily:"var(--mono)", fontSize: 10, letterSpacing:".14em", textTransform:"uppercase",
            }}
          >
            ↻ restart
          </button>
        )}

        {/* Back button outside the phone (handy on every screen except home) */}
        {current !== "home" && current !== "onboarding-1" && (
          <button
            onClick={back}
            style={{
              position:"absolute", top: 50, right: -90, width: 80,
              padding:"8px 0", borderRadius: 999, background:"rgba(255,255,255,.08)",
              border:"1px solid rgba(255,255,255,.18)", color:"#EDE6D8",
              fontFamily:"var(--mono)", fontSize: 10, letterSpacing:".14em", textTransform:"uppercase",
            }}
          >
            ← back
          </button>
        )}

        {/* Home shortcut */}
        {current !== "home" && current !== "onboarding-1" && current !== "onboarding-2" && current !== "onboarding-3" && (
          <button
            onClick={() => reset("home")}
            style={{
              position:"absolute", top: 100, right: -90, width: 80,
              padding:"8px 0", borderRadius: 999, background:"rgba(255,255,255,.08)",
              border:"1px solid rgba(255,255,255,.18)", color:"#EDE6D8",
              fontFamily:"var(--mono)", fontSize: 10, letterSpacing:".14em", textTransform:"uppercase",
            }}
          >
            ⌂ home
          </button>
        )}
      </div>

      {/* Bottom: route map for orientation */}
      <div style={{ marginTop: 18, display:"flex", flexWrap:"wrap", gap: 6, justifyContent:"center", maxWidth: 540 }}>
        {[
          ["onboarding-1","Onboarding"],
          ["home","Home"],
          ["transit","Transit"],
          ["coffee","Coffee"],
          ["money","Money"],
          ["restroom","Restroom"],
          ["eat","Place"],
          ["todo","Things to do"],
          ["todo-detail","Activity"],
        ].map(([id, name]) => (
          <button
            key={id}
            onClick={() => reset(id)}
            style={{
              padding:"6px 12px", borderRadius: 999,
              background: current === id ? "rgba(94,230,196,.18)" : "rgba(255,255,255,.05)",
              border:`1px solid ${current === id ? "rgba(94,230,196,.4)" : "rgba(255,255,255,.1)"}`,
              color: current === id ? "#5EE6C4" : "rgba(237,230,216,.55)",
              fontFamily:"var(--mono)", fontSize: 10, letterSpacing:".12em", textTransform:"uppercase", cursor:"pointer",
            }}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<ProtoApp />);

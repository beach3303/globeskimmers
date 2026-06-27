// landing.jsx — Bold vibrant landing page, matching app design

const { useState } = React;

const ARROW = <LIcon name="arrow" size={14} color="currentColor" w={2.4} />;

// ─── NAV ───────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <header className="nav">
      <div className="shell nav-row">
        <a className="brand" href="#top">
          <span className="brand-mark"></span>
          <span>Globeskimmers</span>
        </a>
        <nav className="nav-links">
          <a className="nav-link" href="#essentials">Essentials</a>
          <a className="nav-link" href="#how">How it works</a>
          <a className="nav-link" href="#scenarios">Stories</a>
          <a className="nav-link" href="#faq">FAQ</a>
          <a className="btn btn-primary" href="#final">Download {ARROW}</a>
        </nav>
      </div>
    </header>
  );
}

// ─── EMAIL FIELD ───────────────────────────────────────────────────────────
function EmailField({ cta = "Start exploring free", placeholder = "you@somewhere.new", variant = "primary" }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const btnClass = variant === "primary" ? "btn btn-primary" : "btn btn-teal";
  return (
    <form className="email-field" onSubmit={(e) => { e.preventDefault(); if (email.includes("@")) setSent(true); }}>
      <input type="email" placeholder={placeholder} value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" />
      <button className={btnClass} type="submit">
        {sent ? "✓ On the list" : cta}
        {!sent && ARROW}
      </button>
    </form>
  );
}

// ─── STORE BUTTONS ─────────────────────────────────────────────────────────
function StoreButtons() {
  return (
    <div className="store-row">
      <a className="store-btn" href="#download" aria-label="Download on the App Store">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" style={{ flex:"none" }}>
          <path d="M17.05 12.04c-.03-2.96 2.42-4.39 2.53-4.45-1.38-2.01-3.52-2.29-4.28-2.32-1.82-.18-3.55 1.07-4.47 1.07-.93 0-2.36-1.05-3.88-1.02-1.99.03-3.83 1.16-4.86 2.94-2.07 3.58-.53 8.88 1.49 11.79.99 1.42 2.16 3.02 3.69 2.96 1.48-.06 2.04-.96 3.83-.96 1.79 0 2.29.96 3.86.93 1.59-.03 2.6-1.45 3.57-2.88 1.12-1.65 1.59-3.25 1.61-3.34-.04-.02-3.07-1.18-3.11-4.72zM14.36 3.43c.8-.99 1.35-2.34 1.2-3.69-1.16.05-2.59.79-3.42 1.77-.74.86-1.4 2.26-1.22 3.58 1.3.1 2.62-.66 3.44-1.66z"/>
        </svg>
        <span className="store-lines">
          <span className="store-tiny">Download on the</span>
          <span className="store-big">App Store</span>
        </span>
      </a>
      <a className="store-btn" href="#download" aria-label="Get it on Google Play">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ flex:"none" }}>
          <path d="M3.5 2.5v19l8-9.5-8-9.5Z" fill="#34D399"/>
          <path d="m11.5 12 8 4.5L3.5 21.5l8-9.5Z" fill="#FBBF24"/>
          <path d="m11.5 12 8-4.5L3.5 2.5l8 9.5Z" fill="#F472B6"/>
          <path d="m11.5 12 8 4.5-8 5 0-9.5Z" fill="#60A5FA"/>
        </svg>
        <span className="store-lines">
          <span className="store-tiny">Get it on</span>
          <span className="store-big">Google Play</span>
        </span>
      </a>
    </div>
  );
}

// ─── SEND TO PHONE ─────────────────────────────────────────────────────────
function SendToPhone() {
  const [mode, setMode] = useState("sms");
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const onSubmit = (e) => {
    e.preventDefault();
    const ok = mode === "sms" ? /\d{7,}/.test(value.replace(/\D/g,"")) : value.includes("@");
    if (!ok) return;
    setSent(true);
  };
  return (
    <div>
      <form className="send-row" onSubmit={onSubmit}>
        <div className="seg">
          <button type="button" className={mode === "sms" ? "active" : ""} onClick={() => { setMode("sms"); setSent(false); }}>
            <LIcon name="phone" size={14} /> Text
          </button>
          <button type="button" className={mode === "email" ? "active" : ""} onClick={() => { setMode("email"); setSent(false); }}>
            <LIcon name="mail" size={14} /> Email
          </button>
        </div>
        <input
          type={mode === "email" ? "email" : "tel"}
          placeholder={mode === "sms" ? "+1 555 123 4567" : "you@somewhere.new"}
          value={value} onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="send-btn">
          {sent ? "✓ Sent" : "Send me the link"}
          {!sent && ARROW}
        </button>
      </form>
      {sent && (
        <div className="send-success">
          ✓ Link sent to your {mode === "sms" ? "phone" : "inbox"} — open it on your phone to install the app.
        </div>
      )}
    </div>
  );
}

// ─── HERO ──────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="top" className="hero">
      <div className="shell hero-grid">
        <div className="hero-text-col">
          <span className="hero-tag rise"><span className="dot"></span> Now in 63 cities · beta open</span>
          <h1 className="hero-h1 rise d1">
            Travel like<br />
            you've <em>been there</em><br />
            before.
          </h1>
          <p className="hero-sub rise d2">
            Globeskimmers is the travel app that helps international travelers find authentic local food, ATMs, clean restrooms, and currency exchange anywhere in the world — so you move through a new city like a local, not a tourist.
          </p>
          <div className="hero-cta rise d3">
            <StoreButtons />
          </div>
          <div className="rise d3" style={{ marginTop: 18, maxWidth: 520 }}>
            <div className="mono" style={{ marginBottom: 8 }}>Or grab the link on your phone</div>
            <SendToPhone />
          </div>
          <div className="hero-meta rise d4">
            <span className="hero-meta-chip"><b>Free</b> to use</span>
            <span className="hero-meta-chip"><b>Beta</b> open now</span>
            <span className="hero-meta-chip"><b>Launching</b> Q3 2026</span>
          </div>
        </div>
        <div className="hero-phone-col rise d2">
          <div className="float-pill" style={{ top: 60, left: -20 }}>
            <span className="swatch" style={{ background:"#E63946" }}></span> Eat local
          </div>
          <div className="float-pill" style={{ top: 180, right: -10 }}>
            <span className="swatch" style={{ background:"#0F9A6B" }}></span> €1.00 = $1.08
          </div>
          <div className="float-pill" style={{ bottom: 90, left: 0 }}>
            <span className="swatch" style={{ background:"#3F49D4" }}></span> Tram 28 · 4 min
          </div>
          <div className="phone">
            <div className="phone-screen">
              <LandingHomeScreen />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── ESSENTIALS ────────────────────────────────────────────────────────────
const ESSENTIALS = [
  { n:"01", ico:"fork",  color:"var(--food)",     glow:"230,57,70",     title:"Eat where the locals eat",  sub:"Real spots, scored by people who actually live there." },
  { n:"02", ico:"cash",  color:"var(--money)",    glow:"15,154,107",    title:"Change money, not lose it",  sub:"Mid-market rates beside every exchange near you." },
  { n:"03", ico:"atm",   color:"var(--atm)",      glow:"31,91,214",     title:"ATMs that work on your card",sub:"Filtered by network, fee, and not-broken status." },
  { n:"04", ico:"rest",  color:"var(--restroom)", glow:"15,138,130",    title:"Restrooms, rated honestly",  sub:"Clean, free, accessible — or not. Your call." },
  { n:"05", ico:"bus",   color:"var(--transit)",  glow:"63,73,212",     title:"From the gate to the bed",    sub:"Tram, train, taxi, tuk-tuk — real times, real fares." },
  { n:"06", ico:"sun",   color:"var(--weather)",  glow:"212,134,26",    title:"Weather that knows you",     sub:"Just landed? Forecast plus the practical 'wear this'." },
];

function Essentials() {
  return (
    <section id="essentials" className="essentials">
      <div className="shell">
        <div className="section-head">
          <div>
            <div className="section-eyebrow">What's in your pocket</div>
            <h2 className="section-title">Six things <em>every traveler</em> opens an app for.</h2>
          </div>
          <p className="section-lede">
            One screen. No tabs to thumb through, no twelve apps to install before you land. We picked the six things you actually need in the first hour of a new city — and made them feel obvious.
          </p>
        </div>
        <div className="ess-grid">
          {ESSENTIALS.map(c => (
            <div className="ess-cell" key={c.n} style={{ background: c.color, boxShadow:`0 16px 32px -16px rgba(${c.glow},.5)` }}>
              <div className="ess-ico"><LIcon name={c.ico} size={22} color="#fff" w={2} /></div>
              <div>
                <div className="ess-title">{c.title}</div>
                <div className="ess-sub">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ──────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { cls:"s1", num:"01", t:"Land.",  p:"Open Globeskimmers the moment your wheels touch down. It already knows where you are." },
    { cls:"s2", num:"02", t:"Skim.",  p:"Six tiles, three taps. Food, money, transit, the lot — without choosing between twelve mediocre apps." },
    { cls:"s3", num:"03", t:"Go.",    p:"Save the spots worth a second look. Walk out into a city that already feels half-familiar." },
  ];
  return (
    <section id="how">
      <div className="shell">
        <div className="section-head">
          <div>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Three steps. <em>That's the whole app.</em></h2>
          </div>
          <p className="section-lede">
            We won't make you onboard for ten minutes before you can find a coffee. Open it. Tap the thing you need. Go.
          </p>
        </div>
        <div className="how-steps">
          {steps.map(s => (
            <div className={"step-card " + s.cls} key={s.num}>
              <div className="step-num">{s.num}</div>
              <div>
                <div className="step-h">{s.t}</div>
                <div className="step-p">{s.p}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SCENARIOS ─────────────────────────────────────────────────────────────
function Scenarios() {
  const cards = [
    {
      loc:"Tokyo · 05:00", tag:"Just landed",
      tint:"linear-gradient(135deg, #1F5BD6 0%, #4F6BCC 50%, #818CF8 100%)",
      title:[ "Off a 14-hour flight in ", { italic:"Tokyo" }, "." ],
      text:"It's 5am, trains aren't running, you need yen and a real meal — in that order. Globeskimmers opens to exactly that list, ranked for the hour you're in.",
    },
    {
      loc:"Mexico City · 19:30", tag:"Wandering",
      tint:"linear-gradient(135deg, #E63946 0%, #F87171 50%, #FCA5A5 100%)",
      title:[ "Eat like a ", { italic:"Chilango" }, "." ],
      text:"Skip the top-10 lists written by people on a press trip. We surface the taquería with a line of locals — not the one with English-translated wall art.",
    },
    {
      loc:"Marrakech · 16:48", tag:"Out of cash",
      tint:"linear-gradient(135deg, #A85A2E 0%, #D97706 50%, #FBBF24 100%)",
      title:[ "ATM ate your card in ", { italic:"Marrakech" }, "." ],
      text:"We mark which machines work with your network, the bureau de change two streets over with the honest rate, and a quiet tea spot to sort it all out.",
    },
  ];
  return (
    <section id="scenarios">
      <div className="shell">
        <div className="section-head">
          <div>
            <div className="section-eyebrow">Built for the in-between</div>
            <h2 className="section-title">Not a guidebook. <em>A pocket.</em></h2>
          </div>
          <p className="section-lede">
            Travel apps either explain the city or sell you a tour. Globeskimmers is for the awkward middle hour — just-landed, mid-walk, second-thoughts.
          </p>
        </div>
        <div className="scen-grid">
          {cards.map((c, i) => (
            <article key={i} className="scen-card" style={{ background: c.tint }}>
              <div className="scen-photo"></div>
              <div className="scen-loc">
                <LIcon name="pin" size={11} color="#fff" w={2.4} /> {c.loc}
              </div>
              <div className="scen-body">
                <span className="scen-tag">{c.tag}</span>
                <h3 className="scen-title">
                  {c.title.map((part, j) =>
                    typeof part === "string" ? <React.Fragment key={j}>{part}</React.Fragment>
                    : <em key={j}>{part.italic}</em>
                  )}
                </h3>
                <p className="scen-text">{c.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── GALLERY · app preview ─────────────────────────────────────────────────
// Mini mock screens used in the gallery cards
const GalScreen_Eat = () => (
  <>
    <div style={{ height: 24 }} />
    <div style={{ padding: "0 14px", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius:"50%", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <LIcon name="chev" size={13} color="#0F1419" w={2.2} style={{ transform:"rotate(180deg)" }} />
      </div>
      <div style={{ padding:"4px 10px", borderRadius:999, background:"#FFE4E0", color:"#E63946", fontSize: 10, fontWeight: 700 }}>Places to Eat</div>
      <div style={{ width: 28, height: 28, borderRadius:"50%", border:"1px solid #F0E9DC", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 11 }}>🔍</div>
    </div>
    <div style={{ padding:"0 14px" }}>
      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1, color:"#0F1419", letterSpacing:"-.012em" }}>
        The <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", color:"#E63946", fontWeight:400 }}>locals'</span> list
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color:"#6B7280" }}>Alfama · 12 within 1 km</div>
    </div>
    <div style={{ padding:"10px 14px", display:"flex", flexDirection:"column", gap: 8 }}>
      {[
        { name:"Taberna da Rua das Flores", meta:"Portuguese · €€", rating:"4.8", best:true },
        { name:"Cervejaria Ramiro", meta:"Seafood · €€€", rating:"4.7" },
        { name:"A Cevicheria", meta:"Peruvian · €€", rating:"4.6" },
        { name:"Time Out Market", meta:"Food hall · €€", rating:"4.5" },
      ].map((r,i) => (
        <div key={i} style={{
          padding:"10px 12px", borderRadius: 12, background:"#fff", border:"1px solid #F0E9DC",
          display:"grid", gridTemplateColumns:"1fr auto", gap: 8,
        }}>
          <div>
            {r.best && <div style={{ display:"inline-block", padding:"2px 7px", borderRadius: 999, background:"#FFE4E0", color:"#E63946", fontSize: 8, fontWeight: 800, letterSpacing:".05em", marginBottom: 3 }}>⭐ LOCALS' #1</div>}
            <div style={{ fontWeight: 700, fontSize: 12, color:"#0F1419", letterSpacing:"-.005em" }}>{r.name}</div>
            <div style={{ marginTop: 2, fontSize: 10, color:"#6B7280" }}>{r.meta}</div>
          </div>
          <div style={{ alignSelf:"center", fontWeight: 800, fontSize: 12, color:"#0F1419" }}>★ {r.rating}</div>
        </div>
      ))}
    </div>
  </>
);

const GalScreen_Money = () => (
  <>
    <div style={{ height: 24 }} />
    <div style={{ background:"linear-gradient(135deg, #0F9A6B 0%, #10B981 60%, #34D399 100%)", margin: "0 14px", padding: 14, borderRadius: 14, color:"#fff", boxShadow:"0 10px 22px -10px rgba(15,154,107,.5)" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing:".14em", textTransform:"uppercase", opacity:.85 }}>Mid-market rate</div>
      <div style={{ marginTop: 6, fontSize: 28, fontFamily:"var(--serif)", fontStyle:"italic", lineHeight: 1, letterSpacing:"-.02em" }}>€1.00 = $1.08</div>
      <div style={{ marginTop: 6, fontSize: 9, opacity:.85, fontFamily:"var(--mono)", letterSpacing:".1em" }}>Updated 2 min · live</div>
    </div>
    <div style={{ padding: "10px 14px", display:"flex", flexDirection:"column", gap: 6 }}>
      {[
        { n:"Câmbios Praça Rossio", rate:"1.072", fee:"No fee", best:true },
        { n:"Unicâmbio · Baixa",    rate:"1.064", fee:"1.5% fee" },
        { n:"Nova Câmbio",          rate:"1.058", fee:"2% fee" },
        { n:"Airport branch",       rate:"1.021", fee:"Skip it" },
      ].map((b, i) => (
        <div key={i} style={{
          padding:"9px 12px", borderRadius: 12,
          background: b.best ? "linear-gradient(135deg, #0F9A6B, #10B981)" : "#fff",
          color: b.best ? "#fff" : "#0F1419",
          border: b.best ? "0" : "1px solid #F0E9DC",
          display:"flex", alignItems:"center", gap: 8,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius:"50%",
            background: b.best ? "rgba(255,255,255,.2)" : "#D8F4E5", color: b.best ? "#fff" : "#0F9A6B",
            display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 10, fontWeight: 400,
          }}>{i+1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 11 }}>{b.n}</div>
            <div style={{ fontSize: 9, opacity:.85 }}>{b.fee}</div>
          </div>
          <div style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 15 }}>{b.rate}</div>
        </div>
      ))}
    </div>
  </>
);

const GalScreen_Transit = () => (
  <>
    <div style={{ height: 24 }} />
    <div style={{ background:"linear-gradient(135deg, #3F49D4 0%, #6366F1 60%, #818CF8 100%)", margin:"0 14px", padding: 14, borderRadius: 14, color:"#fff", boxShadow:"0 10px 22px -10px rgba(63,73,212,.5)" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing:".14em", textTransform:"uppercase", opacity:.85 }}>Get me to</div>
      <div style={{ marginTop: 4, fontSize: 18, fontFamily:"var(--serif)", fontStyle:"italic", lineHeight: 1.05 }}>Castelo de São Jorge</div>
    </div>
    <div style={{ padding:"10px 14px", display:"flex", flexDirection:"column", gap: 6 }}>
      {[
        { m:"Tram 28", t:"28 min", p:"€3.10", tag:"Scenic · best", best:true },
        { m:"Metro · Blue", t:"16 min", p:"€1.65", tag:"Fastest" },
        { m:"Walk", t:"42 min", p:"Free", tag:"Healthiest" },
        { m:"Taxi", t:"12 min", p:"€8.40", tag:"Convenience" },
      ].map((r,i) => (
        <div key={i} style={{
          padding:"9px 12px", borderRadius: 12,
          background: r.best ? "#3F49D4" : "#fff", color: r.best ? "#fff" : "#0F1419",
          border: r.best ? "0" : "1px solid #F0E9DC",
          display:"flex", alignItems:"center", gap: 8,
        }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: r.best ? "rgba(255,255,255,.2)" : "#DFE2FA", color: r.best ? "#fff" : "#3F49D4", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <LIcon name="bus" size={13} color={r.best ? "#fff" : "#3F49D4"} w={2.2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 11 }}>{r.m}</div>
            <div style={{ fontSize: 9, opacity:.85 }}>{r.tag}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 14 }}>{r.t}</div>
            <div style={{ fontSize: 9, fontWeight: 700, opacity:.9 }}>{r.p}</div>
          </div>
        </div>
      ))}
    </div>
  </>
);

const GalScreen_Activity = () => (
  <>
    <div style={{ height: 0, position:"relative" }}>
      <div style={{ height: 150, background:"linear-gradient(135deg, #1F5BD6 0%, #6366F1 100%)", position:"relative", overflow:"hidden", marginTop: 24 }}>
        <div style={{ position:"absolute", inset: 0, background:"repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0 8px, transparent 8px 18px)" }} />
        <div style={{ position:"absolute", top: 8, left: 10, width: 26, height: 26, borderRadius:"50%", background:"#FFC93C", border:"2px solid #fff", color:"#7A4B00", display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 800, fontSize: 12 }}>1</div>
        <div style={{ position:"absolute", top: 10, right: 10, padding:"3px 8px", borderRadius: 999, background:"#fff", color:"#15803D", fontSize: 9, fontWeight: 700 }}>● Open Now</div>
      </div>
    </div>
    <div style={{ marginTop: -16, background:"#FFFCF7", borderRadius:"18px 18px 0 0", padding:"16px 14px 0", position:"relative" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color:"#0F1419", letterSpacing:"-.018em", lineHeight: 1 }}>
        Statue of <span style={{ fontFamily:"var(--serif)", fontStyle:"italic", color:"#1F5BD6", fontWeight: 400 }}>Liberty</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color:"#6B7280" }}>★ 4.7 · 112k reviews · Historic Site</div>
      <div style={{ marginTop: 10, padding:"7px 9px", borderRadius: 9, background:"#D4F0DA", color:"#15803D", fontSize: 10, fontWeight: 700 }}>● Open · 9:00 AM – 4:30 PM</div>
      <div style={{ marginTop: 8, padding:"8px 10px", borderRadius: 9, background:"#DCE6FB", color:"#1F5BD6", display:"flex", alignItems:"center", gap: 7 }}>
        <div style={{ width: 26, height: 26, borderRadius:"50%", background:"#1F5BD6", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 11, fontWeight: 800 }}>📞</div>
        <div style={{ flex:1, fontWeight: 700, fontSize: 10.5 }}>(212) 363-3200</div>
      </div>
      <div style={{ marginTop: 10, display:"flex", gap: 6 }}>
        <div style={{ flex: 1, height: 36, borderRadius: 10, background:"#D4861A", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap: 5, fontSize: 11, fontWeight: 700 }}>📍 Directions</div>
      </div>
    </div>
  </>
);

function Gallery() {
  const cards = [
    { k:"01 · Home",      t:"Six tiles, one pocket.",                screen:<LandingHomeScreen /> },
    { k:"02 · Eat",       t:"The locals' list, not the tourist trap.", screen:<GalScreen_Eat /> },
    { k:"03 · Money",     t:"Mid-market rates beside every booth.",   screen:<GalScreen_Money /> },
    { k:"04 · Transit",   t:"The way they actually go.",              screen:<GalScreen_Transit /> },
    { k:"05 · Things to do", t:"Worth your second look.",            screen:<GalScreen_Activity /> },
  ];
  return (
    <section id="gallery" className="gallery">
      <div className="shell">
        <div className="section-head">
          <div>
            <div className="section-eyebrow">Inside the app</div>
            <h2 className="section-title">Designed for the <em>in-between</em> hour.</h2>
          </div>
          <p className="section-lede">
            We left out everything you'd ignore. What's left is the part of the app you'd actually open in the back of a taxi.
          </p>
        </div>
        <div className="gal-track">
          {cards.map((c, i) => (
            <div className="gal-card" key={i}>
              <div className="gal-screen">{c.screen}</div>
              <div className="gal-cap">
                <span className="k">{c.k}</span>
                <span className="t">{c.t}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ───────────────────────────────────────────────────────────────────
const FAQS = [
  { q:"Is Globeskimmers free?", a:"Yes — every essential feature is free. We may add a paid tier later for offline city packs and saved itineraries, but the six core tiles will always be free." },
  { q:"How is this different from Google Maps?", a:"Maps is a map. Globeskimmers is a pocket. We start from \"what does a traveler need in the next 30 minutes\" — not \"what's nearby on a 2D plane\" — and we rank for traveler intent (clean restroom, fair ATM, real local food), not commercial popularity." },
  { q:"Where does the local data come from?", a:"A mix: open data, partnerships with regional travel boards, and on-the-ground reviewers we pay in 23 cities and counting. Every recommendation has a date and a source." },
  { q:"Does it work offline?", a:"Yes. Download a city pack on airport wifi (or before you fly), and the six essentials work without signal. Money exchange rates cache for 24 hours." },
  { q:"Which cities are supported at launch?", a:"63 cities across Europe, Latin America, East Asia, and the US at Q3 2026 launch. Beta users get to vote on the next 30." },
  { q:"How do I join the beta?", a:"Drop your email anywhere on this page. We're letting in a few hundred new beta users every week, prioritizing people about to travel internationally." },
];

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq">
      <div className="shell">
        <div className="section-head">
          <div>
            <div className="section-eyebrow">Questions</div>
            <h2 className="section-title">Honest answers, <em>no marketing voice.</em></h2>
          </div>
          <p className="section-lede">
            If something isn't here, write us at <span style={{ color:"var(--teal)", fontWeight: 600 }}>hello@globeskimmers.com</span>. A real person reads everything.
          </p>
        </div>
        <div className="faq-list">
          {FAQS.map((f, i) => (
            <div className={"faq-item " + (open === i ? "open" : "")} key={i}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                <span className="faq-num">{String(i+1).padStart(2,"0")}</span>
                <h3>{f.q}</h3>
                <span className="plus">
                  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </span>
              </button>
              <div className="faq-a">
                <div className="faq-a-inner"><div>{f.a}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FINAL CTA ─────────────────────────────────────────────────────────────
function Final() {
  return (
    <section id="final" className="final">
      <div className="final-inner">
        <h2>Move through a new city <em>like a local.</em></h2>
        <p>Tap a store button to install on this device — or send the link to your phone and pick it up there.</p>
        <div style={{ display:"flex", justifyContent:"center", position:"relative" }}>
          <StoreButtons />
        </div>
        <div style={{ marginTop: 22, display:"flex", justifyContent:"center", position:"relative" }}>
          <SendToPhone />
        </div>
        <div className="final-meta">
          <span>Free forever</span><span>·</span><span>No spam</span><span>·</span><span>Q3 2026 public launch</span>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer>
      <div className="shell">
        <div className="foot-row">
          <div>
            <div className="brand"><span className="brand-mark"></span><span>Globeskimmers</span></div>
            <p style={{ marginTop: 14, color:"var(--ink-3)", fontSize: 13.5, maxWidth: 260, lineHeight: 1.55 }}>
              The travel app for the in-between hour. Built in 7 timezones, tested in 63 cities.
            </p>
          </div>
          <div><h4>Product</h4><ul><li><a href="#essentials">Essentials</a></li><li><a href="#how">How it works</a></li><li><a href="#gallery">Inside the app</a></li><li><a href="#faq">FAQ</a></li></ul></div>
          <div><h4>Company</h4><ul><li><a href="#">About</a></li><li><a href="#">Cities</a></li><li><a href="#">Local reviewers</a></li><li><a href="#">Press</a></li></ul></div>
          <div><h4>Hello</h4><ul><li><a href="#">hello@globeskimmers.com</a></li><li><a href="#">Beta access</a></li><li><a href="#">Twitter / X</a></li><li><a href="#">Instagram</a></li></ul></div>
        </div>
        <div className="foot-bottom">
          <div className="big">Globe<em>skimmers.</em></div>
          <div className="meta">
            <div>© 2026 Globeskimmers Co.</div>
            <div style={{ marginTop: 6 }}>Made for travelers, by travelers.</div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── APP ───────────────────────────────────────────────────────────────────
function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Essentials />
        <HowItWorks />
        <Scenarios />
        <Gallery />
        <FAQ />
        <Final />
      </main>
      <Footer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

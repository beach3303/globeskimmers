// redesign-canvas.jsx — Compose the design canvas

// One-shot: clear any stale off-screen viewport position from earlier sessions.
// The canvas restores its pan/zoom from localStorage — if that's stuck somewhere
// off-screen (which happened after some heavy initial loads), the canvas appears
// blank. We nuke it once on every load until the user explicitly pans.
try {
  const key = "dc-viewport:" + location.pathname;
  const cur = JSON.parse(localStorage.getItem(key) || "null");
  // Reset if pan is more than half a viewport off in either axis
  if (!cur || Math.abs(cur.x || 0) > 800 || Math.abs(cur.y || 0) > 600) {
    localStorage.setItem(key, JSON.stringify({ x: 40, y: 40, scale: 0.5 }));
  }
} catch (e) {}

const PHONE_W = 402;
const PHONE_H = 874;

const PhoneBoard = ({ children, dark = false }) => (
  <IOSDevice width={PHONE_W} height={PHONE_H} dark={dark}>
    {children}
  </IOSDevice>
);

function CanvasApp() {
  return (
    <DesignCanvas>
      <DCSection id="more2" title="New screens · Map · Scanner · Transportation" subtitle="Built from your real repo features. Transportation is the full route planner — origin→destination, per-country fares, traffic status, region-aware rideshare apps, taxi hotline.">
        <DCArtboard id="s2-transit" label="Transportation · route planner" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldTransportationV2 /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="s2-map" label="Map view" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldMap /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="s2-scanner" label="Smart Text Scanner" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldTextScanner /></PhoneBoard>
        </DCArtboard>
      </DCSection>

      <DCSection id="more" title="More screens · vibrant style" subtitle="Transportation, Coffee Finder, Restroom Finder, plus a 3-step onboarding. Same category color system, same chunky CTA grammar.">
        <DCArtboard id="more-transit" label="Transportation" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldTransportation /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="more-coffee" label="Coffee Finder" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldCoffee /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="more-rest" label="Restroom Finder" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldRestroom /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="onboard-1" label="Onboarding · 1/3 Welcome" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldOnboarding1 /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="onboard-2" label="Onboarding · 2/3 Home country" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldOnboarding2 /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="onboard-3" label="Onboarding · 3/3 Location" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldOnboarding3 /></PhoneBoard>
        </DCArtboard>
      </DCSection>

      <DCSection id="home-final" title="Home · final direction" subtitle="Base = your favorite earlier Home, with the Things-to-do row redesigned (vibrant gradient cards with deco). When flag is on, it fills the greeting card in landscape — three contrast versions to choose between.">
        <DCArtboard id="boldhome-v2" label="Base · no flag · with vibrant explore row" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldHomeV2 /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="flag-us-subtle" label="Flag ON · USA · Subtle (35% · dark text)" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><FlagHomeUS_Subtle /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="flag-us-medium" label="Flag ON · USA · Medium (70% · scrim · white text)" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><FlagHomeUS_Medium /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="flag-us-bold" label="Flag ON · USA · Bold (100% · strong scrim · white)" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><FlagHomeUS_Bold /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="flag-jp-bold" label="Flag ON · Japan · Bold (no fade · respect)" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><FlagHomeJP_Bold /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="flag-mx-medium" label="Flag ON · Mexico · Medium" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><FlagHomeMX_Medium /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="flag-in-bold" label="Flag ON · India · Bold" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><FlagHomeIN_Bold /></PhoneBoard>
        </DCArtboard>
      </DCSection>

      <DCSection id="home-eq" title="Home · equal-weight explorations" subtitle="From the previous round — equal 3×4 grid options.">
        <DCArtboard id="home-eq-solid" label="V1 · Solid grid (no flag)" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><HomeEqual /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="home-eq-outline" label="V2 · Outline grid (no flag)" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><HomeEqualOutline /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="home-flag-us" label="V3 · Flag overlay · USA (fade)" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><HomeFlagUS /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="home-flag-jp" label="V4 · Flag overlay · Japan (no fade · respect)" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><HomeFlagJP /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="home-flag-mx" label="V5 · Flag overlay · Mexico" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><HomeFlagMX /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="home-eq-list" label="V6 · Equal list layout" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><HomeEqualList /></PhoneBoard>
        </DCArtboard>
      </DCSection>

      <DCSection id="bold" title="Bold · earlier screens" subtitle="From the previous pass. Compare home grid styles, then we expand the rest.">
        <DCArtboard id="bold-home" label="Home · featured + grid" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldHome /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="bold-place" label="Place detail · Domino's" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldPlaceDetail /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="bold-todo" label="Things to do · list" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldThingsToDo /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="bold-activity" label="Activity detail · Statue of Liberty" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldActivityDetail /></PhoneBoard>
        </DCArtboard>
        <DCArtboard id="bold-money" label="Money exchange" width={PHONE_W} height={PHONE_H}>
          <PhoneBoard><BoldMoneyExchange /></PhoneBoard>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<CanvasApp />);

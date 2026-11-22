// PageErrorBoundary — when a page throws while it draws, that page shows this card and the rest
// of the app stays up (2026-11-22). Before it, one bad card blanked the whole screen: a postcard
// from a sender with a Seal reached a component that was never imported, and the Mail page went
// white for everyone who received one from 2026-11-13 on. React unmounts the tree on an uncaught
// render error; this catches it at the page, logs `page_error` (the message and the first lines of
// the component stack, on the page's row) so the next one shows in the event log the same hour,
// and offers Try again and the Passport. A route change resets it by itself.
//
//   <PageErrorBoundary page={currentPageName}>{children}</PageErrorBoundary>
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { logEvent } from "@/lib/analytics";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    try {
      const where = String(info?.componentStack || "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 4).join(" < ");
      logEvent("page_error", { message: String(error?.message || error).slice(0, 200), where: where.slice(0, 300) }, this.props.page || null);
    } catch { /* logging is best effort */ }
  }
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return this.props.fallback(() => this.setState({ error: null }));
  }
}

function Fallback({ page, retry }) {
  const navigate = useNavigate();
  const onPassport = page === "Passport";
  const button = { minHeight: 46, padding: "0 18px", borderRadius: 999, font: "inherit", fontSize: fs(14), fontWeight: 650, cursor: "pointer" };
  return (
    <div role="alert" style={{ margin: "28px 16px 0", padding: "20px 18px", background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, borderRadius: 18 }}>
      <p style={{ margin: 0, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".16em", textTransform: "uppercase", color: NEUTRAL.airmailBlue }}>Something went wrong</p>
      <h2 style={{ margin: "6px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: fs(24), lineHeight: 1.1, color: NEUTRAL.ink }}>This page couldn’t be drawn.</h2>
      <p style={{ margin: "8px 0 0", fontSize: fs(14), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
        Your passport, stamps and mail are safe. It has been noted so it can be fixed. Try again, or go back to your passport.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button type="button" onClick={retry} style={{ ...button, border: 0, background: NEUTRAL.airmailBlue, color: NEUTRAL.white }}>Try again</button>
        {!onPassport ? (
          <button type="button" onClick={() => navigate(createPageUrl("Passport"))} style={{ ...button, border: `1px solid ${NEUTRAL.airmailBlue}`, background: NEUTRAL.white, color: NEUTRAL.airmailBlue }}>Your Passport</button>
        ) : null}
      </div>
    </div>
  );
}

export default function PageErrorBoundary({ page = null, children }) {
  const location = useLocation();
  return (
    <Boundary page={page} resetKey={`${location.pathname}${location.search}`} fallback={(retry) => <Fallback page={page} retry={retry} />}>
      {children}
    </Boundary>
  );
}

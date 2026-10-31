// MailButton — the envelope at the banner's top-left (navigation redesign, 2026-10-31: Mail
// left the bottom bar). A 44px hit area around a 40px white disc with the Mail glyph, mirroring
// the glasses button on the right; a red dot on the disc while unread postcards or sealed
// telegrams wait. Opens the Mailbox.
//
// The unread count is the one the bar used to poll: read on navigation and when the app comes
// back to the foreground (at most once a minute), cleared the moment the Mailbox marks
// everything seen (gs:unread), read again when a telegram's seal breaks (gs:mail).
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import { createPageUrl } from "@/utils";
import { socialUnread } from "@/lib/passport";
import { NEUTRAL } from "@/components/redesign/constants";

const DOT = "#E0533C";

export default function MailButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mail, setMail] = useState(0);     // unread postcards + sealed telegrams
  const [unread, setUnread] = useState(0); // anything new in the Mailbox
  const lastCheck = useRef(0);

  useEffect(() => {
    let gone = false;
    const check = async (force = false) => {
      if (!force && Date.now() - lastCheck.current < 60000) return;
      lastCheck.current = Date.now();
      const { total, mail: m, error } = await socialUnread();
      if (!gone && !error) { setUnread(total); setMail(m); }
    };
    check();
    const onSeen = () => { setUnread(0); lastCheck.current = Date.now(); setTimeout(() => check(true), 1500); };
    const onMail = () => { setTimeout(() => check(true), 800); };
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("gs:unread", onSeen);
    window.addEventListener("gs:mail", onMail);
    document.addEventListener("visibilitychange", onVisible);
    return () => { gone = true; window.removeEventListener("gs:unread", onSeen); window.removeEventListener("gs:mail", onMail); document.removeEventListener("visibilitychange", onVisible); };
  }, [location.pathname]);

  const fresh = mail > 0 || unread > 0;
  return (
    <button
      type="button"
      onClick={() => navigate(createPageUrl("Mailbox"))}
      aria-label={fresh ? "Mail, new messages" : "Mail"}
      style={{ width: 44, height: 44, flex: "none", padding: 0, border: "none", borderRadius: 999, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, cursor: "pointer" }}
    >
      <span style={{ position: "relative", width: 40, height: 40, boxSizing: "border-box", borderRadius: 999, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.rule}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Mail size={19} strokeWidth={2} color={NEUTRAL.ink} aria-hidden="true" focusable="false" />
        {fresh ? (
          <span aria-hidden="true" style={{ position: "absolute", top: 1, right: 1, width: 10, height: 10, borderRadius: 999, background: DOT, boxShadow: `0 0 0 2px ${NEUTRAL.white}` }} />
        ) : null}
      </span>
    </button>
  );
}

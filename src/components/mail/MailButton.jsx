// MailButton — the envelope at the banner's top-left (navigation redesign, 2026-10-31: Mail
// left the bottom bar). A 44px hit area around a 40px white disc with the Mail glyph, mirroring
// the glasses button on the right; a red dot on the disc while unread postcards or sealed
// telegrams wait. Opens the Mailbox.
//
// The dot is mail only (unread postcards + sealed telegrams): follow requests and passport news
// light the bar's Profile dot instead. One shared read (src/lib/unreadStore.js) serves both: on
// navigation and when the app comes back to the foreground, at most once a minute; again right
// after something is marked seen (gs:unread) or a telegram's seal breaks (gs:mail).
import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { refreshUnread, resetUnread, useUnread, wireUnread } from "@/lib/unreadStore";
import { NEUTRAL } from "@/components/redesign/constants";

const DOT = "#E0533C";

export default function MailButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { mail } = useUnread();

  // A different account: start from nothing and read again.
  useEffect(() => { resetUnread(); if (user?.id) refreshUnread(true); }, [user?.id]);
  useEffect(() => { wireUnread(); if (user?.id) refreshUnread(); }, [location.pathname, user?.id]);

  const fresh = mail > 0;
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

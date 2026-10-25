// Postcards: the old postcard box (2026-10-14 → 2026-10-25). Its cards and telegrams now live in the
// Mailbox's Postcards and Telegrams tabs (founder, 2026-10-25: "Tabs: Postcards · Telegrams · Sent ·
// News"), so this page only forwards — a notification's /Postcards?pc=<id> (or ?tg=<id>) opens that
// message in its tab.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PostcardsPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useEffect(() => {
    const p = new URLSearchParams(search);
    const q = new URLSearchParams();
    if (p.get("tg")) { q.set("tab", "telegrams"); q.set("tg", p.get("tg")); }
    else { q.set("tab", "postcards"); if (p.get("pc")) q.set("pc", p.get("pc")); }
    navigate(`${createPageUrl("Mailbox")}?${q.toString()}`, { replace: true });
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

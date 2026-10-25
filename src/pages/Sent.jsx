// Sent: what you sent lives in the Mailbox's Sent tab (founder, 2026-10-25); this page forwards there.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SentPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate(`${createPageUrl("Mailbox")}?tab=sent`, { replace: true }); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

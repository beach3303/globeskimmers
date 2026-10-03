// /ActivityDetail?id=… — the old stamp page, kept only as a redirect so shared
// links keep working: they open the attraction's Things to Do card instead.
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { attractionUrl } from "@/lib/openAttraction";

export default function ActivityRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("id");
    navigate(id ? attractionUrl(id) : createPageUrl("ThingsToDo"), { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

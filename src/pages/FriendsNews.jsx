// FriendsNews — the Friends' news page (navigation redesign, 2026-10-31, step 6): opened from the
// Profile's YOUR CIRCLE ("See all ›"), from the old /Mailbox?tab=news links and from the news
// notifications. The owner's cloth cover with a back button to the Profile, then FriendsNewsBody:
// follow requests, what happened on the passport, where friends have been, what they added, new
// arrivals, + Add friends.
import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { useMyCloth } from "@/lib/cloth";
import { usePageGround } from "@/components/redesign/PageGround";
import CoverBand from "@/components/profile/CoverBand";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import FriendsNewsBody from "@/components/social/FriendsNewsBody";

const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";

export default function FriendsNewsPage() {
  const navigate = useNavigate();
  const { socialTier, socialTierReady } = useAuth();
  const mine = useMyCloth();
  usePageGround(mine.paper, { ink: mine.cloth });
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
    else navigate(createPageUrl("Profile"));
  };
  // Nothing social until the age tier is known; a 13-17 account meets the hold.
  if (!socialTierReady || socialTier === "blocked" || socialTier === "confirm") return null;
  return (
    <div>
      <div aria-hidden="true" style={{ height: 12 }} />
      <CoverBand height={112} cloth={mine.key} kicker="Your circle" title="Friends’ *news*" leading="back" onLeading={goBack} contentMaxWidth={672} />
      <div className={COLUMN} style={{ paddingTop: 16 }}>
        {socialTier === "teen" ? <TeenHoldNote /> : <FriendsNewsBody />}
      </div>
    </div>
  );
}

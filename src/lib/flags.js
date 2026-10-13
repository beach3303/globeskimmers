// Product switches the founder flips deliberately — not config, not env.
//
// TAGGING_ENABLED (founder, 2026-10-10): "let's remove tag a person function
// until we have thousands of users." The whole tag lane stays built — the
// worker's passport/tag with to_handle, the Mailbox "tagged you" card, the
// Allow/Decline inbox, old /t/<token> claim links — this flag only hides the
// ways to CREATE a tag in the app. Flip to true to bring it all back;
// nothing else needs changing.
export const TAGGING_ENABLED = false;

// HOME_ZONE_STYLE (founder, 2026-10-13): Home's zones print as boxed folders,
// option B in docs/design/new-look/Home-Boxes.dc.html, for everyone. Option A,
// full-width colour bands (Main.dc.html), is built behind the same switch only
// as a preview: an admin-only row in Settings stores a per-device override, and
// ?zones=bands selects it on the web for the screenshot rig (useHomeZoneStyle
// in components/redesign/Zone.jsx reads both). Nothing else may select it.
export const HOME_ZONE_STYLE = 'boxes'; // 'bands' = option A, admin-only preview

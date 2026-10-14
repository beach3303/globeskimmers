// Product switches the founder flips deliberately — not config, not env.
//
// TAGGING_ENABLED (founder, 2026-10-10): "let's remove tag a person function
// until we have thousands of users." The whole tag lane stays built — the
// worker's passport/tag with to_handle, the Mailbox "tagged you" card, the
// Allow/Decline inbox, old /t/<token> claim links — this flag only hides the
// ways to CREATE a tag in the app. Flip to true to bring it all back;
// nothing else needs changing.
export const TAGGING_ENABLED = false;

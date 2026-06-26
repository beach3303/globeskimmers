// Canonical admin email list + helper.
//
// Admins ALWAYS get the global refresh button (clear-app-cache) in the floating
// nav, and can grant that button to other users by email via
// Settings → Manage Refresh Access (the Supabase `refresh_access` table).
//
// Keep this the single source of truth — Settings, the Admin pages, the nav,
// and the refresh-access logic all import from here.
export const ADMIN_EMAILS = [
  'maizasimeon@gmail.com',
  'yreolsleow@gmail.com',
  'founder@globeskimmers.io',
  'simeonmaiza@gmail.com',
];

// True if the given email is one of the hardcoded admin accounts.
export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}

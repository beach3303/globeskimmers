# Setting up a second machine (laptop) — 2026-09-08

The backup was made on "Maiza's Mac mini" (macOS 26.6.2) and lives in **iCloud Drive** as two folders — signing the laptop into the same Apple ID (with iCloud Drive on) brings both down automatically; they appear in Finder → iCloud Drive within minutes, and big files download on first open:

- **`GlobeSkimmers-Backup-2026-09-08/`** — project secrets, `repo/*.bundle` git bundle, Claude's memory + transcripts, and `RESTORE_ON_LAPTOP.md` (the step-by-step this doc mirrors — follow it top to bottom on the laptop).
- **`Mac-Snapshot-2026-09-08/`** — the mini's Desktop, Documents, Downloads, shell/git config, and `MAC_INVENTORY.md` (every app, Homebrew package, and VS Code extension on the mini, so you reinstall only what you use).

Known exclusions: Movies and Music are **not** in the snapshot (too large), and SSH private keys were deliberately left out of iCloud — GitHub uses HTTPS through `gh auth login`, so the laptop just signs in fresh. Migration Assistant was skipped during first-boot setup on purpose; it also works after setup (both Macs on the same Wi-Fi → Applications → Utilities → Migration Assistant on both) if apps/settings/accounts are still wanted.

Everything that matters is in one of three places:

| What | Where | How it gets to the laptop |
|---|---|---|
| Code, native projects, docs, checklists, roadmap | GitHub `beach3303/globeskimmers` (also `repo/*.bundle` in the backup folder) | `git clone` |
| Worker secrets (Google, Anthropic, Nuitée, Stripe, Travelpayouts, Ticketmaster, Viator, Supabase service keys, DEAL_SWEEP_KEY) | Cloudflare (set with `npx wrangler secret put`) | Nothing to copy — they live on the worker |
| Local-only credentials | `GlobeSkimmers-Backup-2026-09-08/secrets/` in iCloud Drive | Same Apple ID sign-in — **never git, never chat** |
| Claude's memory + session transcripts (the reasoning behind every decision) | `GlobeSkimmers-Backup-2026-09-08/claude/` and `docs/claude-memory/` in the repo | Copy `claude/memory/` to the laptop's Claude project dir (below) |

## 1. Tools

- **Xcode** (App Store; the Mac was on Xcode 26.6). Sign in with the Apple ID under Xcode → Settings → Accounts.
  Signing is "Automatically manage signing" — Xcode regenerates the *Apple Development* certificate on a new machine; there is no distribution `.p12` to carry (the Mac only ever held a Development identity).
- **Node** — unpinned; the Mac runs v24.9.0 (`node -v`). Any current LTS works.
- **GitHub CLI**: `brew install gh && gh auth login` (account `beach3303`).
- **Android Studio** only if you touch the Android build (no keystore exists yet — the Play app has not been uploaded).

## 2. Clone and install

```bash
git clone https://github.com/beach3303/globeskimmers.git ~/Documents/globeskimmers
cd ~/Documents/globeskimmers
npm install
```

Keep the path `~/Documents/globeskimmers` — Claude's memory directory is keyed on it.

## 3. Local credentials (from the backup folder's `secrets/`)

`<backup>` below is the iCloud folder: `~/Library/Mobile Documents/com~apple~CloudDocs/GlobeSkimmers-Backup-2026-09-08`.

```bash
cp <backup>/secrets/env.local  ~/Documents/globeskimmers/.env.local   # Supabase URL + anon key, Base44 vars
cp <backup>/secrets/capgo-api-key.txt ~/.capgo                          # Capgo CLI (OTA uploads)
npx wrangler login                                                     # Cloudflare (D1 SQL); browser OAuth
```

`.env.local` is gitignored. Without the two Supabase vars the app white-screens at import time.

## 4. Verify the gates (same as the Mac)

```bash
node --check cloudflare-worker-v7.12.js
npm run lint
npm run build
npm run boot-check          # headless Chrome boot of dist/
```

## 5. Native + OTA

```bash
npm run cap:ios             # build + sync + open Xcode → run on a device once (also installs the Capgo 'onLaunch' setting)
# OTA for every later change:
V="1.0.$(date -u +%y%m%d%H%M)"; npm run build && npx cap sync && npx @capgo/cli bundle upload --channel production --bundle "$V"
```

Push to `main` touching the worker or `wrangler*.toml` deploys the worker automatically (GitHub Action, secret `CLOUDFLARE_API_TOKEN` is in the repo settings — nothing local).

## 6. Claude Code

Install Claude Code, open the repo, then restore memory so a fresh session knows the doctrine:

```bash
mkdir -p ~/.claude/projects/-Users-<user>-Documents-globeskimmers/memory
cp <backup>/claude/memory/* ~/.claude/projects/-Users-<user>-Documents-globeskimmers/memory/
```

(`<user>` = the laptop's macOS username; the directory name is the repo path with `/` → `-`.)
`docs/claude-memory/` in the repo is the same content, committed on 2026-09-08 as a durable snapshot.

## 7. Keep the MacBook Pro current

Work on one machine at a time and `git pull` before starting, `git push` when stopping. Both machines share GitHub as the source of truth; nothing else needs syncing except a changed `.env.local` (rare) and Claude memory (copy the folder whenever you switch).

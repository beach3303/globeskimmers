---
name: capgo-ota-setup-reminder
description: REMIND the founder about Capgo OTA setup at the START of the first chat on/after 2026-09-06 — they asked explicitly on 2026-09-05 night.
metadata: 
  node_type: memory
  type: project
  originSessionId: 39b99a63-daec-4b21-b146-3aa727a6f9ac
  modified: 2026-09-05T15:23:01.731Z
---

**Open the next session by reminding Maiza about Capgo** (they asked: "Remind me about capgo tomorrow morning when i first chat with you", 2026-09-05 ~11:55 PM). Delete this memory once the reminder is delivered and setup is done.

The ask: enable over-the-air bundle updates so frontend ships reach installed apps without Xcode. The app side is ALREADY wired (`@capgo/capacitor-updater` in package.json, `CapacitorUpdater` block in capacitor.config.ts with appId com.globeskimmers.app, `notifyAppReady()` in src/main.jsx). Missing: the cloud account.

Founder's 3 steps (~10 min):
1. Create account at console.capgo.app (free tier OK to start).
2. Add an app there with ID exactly `com.globeskimmers.app`.
3. Generate an API key and run `npx @capgo/cli login <key>` on the Mac (key pasted only at the prompt — never in chat).

Then my side: add an `npm run ota` script (`npm run build && npx @capgo/cli bundle upload`), fold the upload into the ship cycle after frontend pushes, and upload the current bundle as the first test. Xcode remains needed only for native changes (plugins like the future Stripe PaymentSheet wave, icons, permissions) — TestFlight is the no-cable lane for those, worth setting up later.

Related: [[nuitee-production-flip-pending]] (the separate daily payments reminder routine trig_01BcuAQLsqkpuPA7HJJKkLhH does NOT cover Capgo — founder chose an in-chat reminder instead).

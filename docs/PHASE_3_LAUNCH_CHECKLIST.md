# Phase 3 — App Store + Play Store launch checklist

The single source of truth for what's done and what's blocking submission. Update inline as items land.

## Code-side readiness

| ✅ | Item | Notes |
|---|---|---|
| ✅ | Bundle ID locked | `com.globeskimmers.app` for both platforms |
| ✅ | npm package version | 1.0.0 |
| ✅ | iOS marketing version | 1.0 (set in pbxproj) |
| ✅ | Android versionName | 1.0 (set in app/build.gradle) |
| ✅ | AdMob Phase 2 integrated | Banner on Home, test mode by default |
| ✅ | Permission usage strings | iOS Info.plist + AndroidManifest both have location/camera/photo strings |
| ✅ | console.log spam stripped | Vite esbuild drops console.log/debug/warn/info in production builds |
| ✅ | Splash screen configured | Ivory background, 2s show, fade out |
| ✅ | Status bar configured | Dark icons, transparent overlay |
| ✅ | Capacitor assets pipeline | `npm run assets` regenerates all icon + splash variants |
| ⏳ | App icon master | `resources/icon-only.png` — needs design |
| ⏳ | Splash screen master | `resources/splash.png` — needs design |
| ⏳ | Flip AdMob to production | `VITE_ADMOB_PRODUCTION=1` in .env.local (LAST step before submission) |
| ⚠️ | Replace alert()/confirm() with proper modals | 7 call sites — optional polish, see "Known polish items" below |

## Content-side readiness (needs your input)

### App icon

**Status:** Default Capacitor placeholder icon currently ships (purple Capacitor logo). Apple and Google both reject default placeholder icons in app review.

**What's needed:**
- `resources/icon-only.png` — **1024×1024 PNG**, opaque, no transparency
- `resources/icon-foreground.png` — **1024×1024 PNG**, centered with ~33% padding for Android adaptive
- `resources/icon-background.png` — **1024×1024 PNG**, solid color or soft gradient for Android adaptive

Once provided, run `npm run assets` then `npm run cap:sync` to push to native projects.

### Splash screen

**Status:** Default Capacitor placeholder splash.

**What's needed:**
- `resources/splash.png` — **2732×2732 PNG**, centerpiece in middle 30% only (edges get cropped)

### Privacy Policy URL

**Status:** ✅ Live at https://pacific-bandana-537.notion.site/Privacy-Policy-Globeskimmers-3776cbd3ba6b805c8775ffcdecafbd4f

Notion-hosted, publicly accessible (no login required), HTTP 200 verified. Owner: Globeskimmers. Contact: founder@globeskimmers.io. Effective + last-updated: June 6, 2026.

To edit later: open the page in Notion (signed in as owner), edit, saves are live immediately at the same URL. Bump the "Last updated" date when content changes substantively. **Don't change the page title or republish from scratch** — that breaks the URL the stores reference.

### App Store description copy

| Field | Limit | Status |
|---|---|---|
| App name | 30 chars | Globeskimmers (12 chars) ✅ |
| Subtitle (App Store) | 30 chars | ⏳ needed |
| Promotional text (App Store) | 170 chars | ⏳ needed |
| Description | 4000 chars | ⏳ needed |
| Keywords (App Store) | 100 chars, comma-separated | ⏳ needed |
| Short description (Play Store) | 80 chars | ⏳ needed |
| Full description (Play Store) | 4000 chars | ⏳ needed (can reuse App Store description) |

### Screenshots

App Store + Play Store both want 5-10 screenshots per device size. Easiest path: capture from the iOS Simulator (Cmd+S in simulator) and Android emulator at the required resolutions:

| Platform | Required device sizes |
|---|---|
| **iOS** | 6.7" (iPhone 15 Pro Max / iPhone 16 Pro Max) — 1290×2796. Plus 6.5" and 5.5" if supporting older devices. |
| **Android** | Phone — 1080×1920 minimum. 7" tablet + 10" tablet if you want tablet listings. |

Recommended screen order for screenshots:
1. Home screen with greeting + Money Exchange card
2. Smart Price Scanner intro ("Know what you're paying, anywhere")
3. Smart Text Scanner intro ("Translate anything, instantly")
4. PlacesToEat results showing intent-aware tiered results
5. Things to Do detail card
6. Money Exchange comparison
7. Settings screen (shows the polished detail level)
8. Onboarding language picker (shows the no-flags, native-script approach)

### Other store metadata

| Field | Status |
|---|---|
| Support email | ⏳ needed (probably maizasimeon@gmail.com or a dedicated alias) |
| Marketing URL | ⏳ optional but recommended (https://globeskimmers.com or similar) |
| App Store category | "Travel" (primary) — confirm |
| Play Store category | "Travel & Local" — confirm |
| Age rating | ⏳ Apple's 17-question form + Google's IARC questionnaire |
| Pricing | Free with ads — confirm |
| Available regions | Global vs starting with specific countries — confirm |

## Known polish items (optional before launch)

These aren't blockers, but cleaning them up makes the app feel more professional:

### 7 alert()/confirm() call sites to modernize

The system `alert()` / `confirm()` browser dialogs look unprofessional inside a native app. Recommended to replace with the existing Toast / Modal patterns:

| File | Line | Current | Suggested |
|---|---|---|---|
| `src/pages/SavedLocations.jsx` | 53 | `confirm("Delete?")` | Custom confirm modal (use existing AlertDialog from Radix) |
| `src/pages/SavedLocations.jsx` | 70 | `alert("Failed to delete...")` | Toast (already imported elsewhere) |
| `src/pages/SavedLocations.jsx` | 91 | `alert("Failed to save...")` | Toast |
| `src/pages/ActivityDetail.jsx` | 751 | `alert("Link copied!")` | Toast |
| `src/components/ContactUsModal.jsx` | 41 | `alert("Failed to send...")` | Inline error state in the modal |
| `src/components/onboarding/LocationStep.jsx` | 218, 221 | `alert("If settings didn't open...")` | Inline instruction card |

## Submission day order of operations

1. ✅ Make sure all checklist items above are green
2. ✅ Set `VITE_ADMOB_PRODUCTION=1` in `.env.local`
3. ✅ Run `npm run cap:sync` for the final build
4. ✅ In Xcode: archive + upload to App Store Connect
5. ✅ In Android Studio: build signed bundle (`.aab`) + upload to Play Console
6. ✅ Fill out App Store / Play Store listings using the copy + screenshots prepared above
7. ✅ Submit for review

**App Store review averages 24-48 hours. Play Store usually <24 hours for first submission, can take longer if flagged.**

After submission: **don't click your own real AdMob banners**. Account-ban-worthy.

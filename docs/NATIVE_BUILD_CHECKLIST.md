# The one native build — founder's Xcode/Play session checklist

Everything below ships TOGETHER in one native release. App code keeps flowing by OTA;
this session exists only for the four things an OTA cannot do.

## Before you start (5 min)
```
git pull
npm run cap:all        # builds web, syncs BOTH platforms, opens Xcode AND Android Studio
```

## 1 · iOS — Declared Age Range (the OS age signal)
Apple's DeclaredAgeRange framework tells us the user's age RANGE (13–15 / 16–17 / 18+)
and parental-consent state, from Family Sharing — no birthday needed. US states already
require honoring it. In Xcode:
1. Target **App** → Signing & Capabilities → **+ Capability** → "Declared Age Range".
2. Add file `ios/App/App/AgeRangePlugin.swift` — paste:
```swift
import Capacitor
import DeclaredAgeRange

@objc(AgeRangePlugin)
public class AgeRangePlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "AgeRangePlugin"
  public let jsName = "AgeRange"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)
  ]

  @objc func request(_ call: CAPPluginCall) {
    guard #available(iOS 26.0, *) else { call.resolve(["available": false]); return }
    Task { @MainActor in
      do {
        guard let vc = self.bridge?.viewController else {
          call.resolve(["available": false]); return
        }
        let service = AgeRangeService.shared
        let response = try await service.requestAgeRange(ageGates: 13, 16, 18, in: vc)
        switch response {
        case .sharing(let range):
          call.resolve([
            "available": true,
            "lower": range.lowerBound as Any,
            "upper": range.upperBound as Any,
            "parentControlled": range.activeParentalControls != nil
          ])
        case .declinedSharing:
          call.resolve(["available": true, "declined": true])
        @unknown default:
          call.resolve(["available": false])
        }
      } catch { call.resolve(["available": false]) }
    }
  }
}
```
3. The JS side already tolerates its absence (self-declared year remains the fallback).
   After the build, tell Claude — wiring `AgeRange.request()` into the gate is a 30-line
   OTA that prefers the OS signal when present.

## 2 · App Store Connect — the questionnaire flips (do WITH this submission)
Per docs/STORE_LISTING_COPY.md → "Social P1 questionnaire flips":
- App Information → **User Generated Content: YES** (report ✓ block ✓ filter ✓ contact ✓ —
  all live in the app today).
- Age rating questionnaire → re-answer; expect **13+** under the 2025 tiers.
- App Privacy → add: User Content (photos, user-shared), User ID (handle). Nothing is
  sold; nothing tracks across apps (no ATT prompt needed).
- Privacy policy URL unchanged (site policy already covers the social section? →
  UPDATE site/legal/privacy first if not — ask Claude for the diff before submitting).

## 3 · Google Play Console — same flips
- Policy → App content → **User-generated content: YES** (safety features listed).
- Target audience: **13+ only** — do NOT include children categories (keeps AdMob out of
  Families policy).
- Data safety → add Photos (user-shared, optional), User IDs. "Users can interact: YES".

## 4 · Build & submit (both platforms — the standing rule)
- Xcode: Product → Archive → Distribute → App Store Connect → submit with the
  questionnaire changes above.
- Android Studio: Build → Generate Signed Bundle → upload to Play with the content
  changes above.
- After approval on BOTH: `npm run ota` keeps working exactly as before on the new binary.

## What this build carries beyond config
Nothing mandatory — @capacitor/share + filesystem already rode the previous native build.
The AgeRange plugin above is the only new native code. Avatars, postcards, profiles,
mailbox, packets: all already live via OTA.

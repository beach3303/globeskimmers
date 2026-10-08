#!/bin/bash
# Pre-submission gate for the App Store: build the iOS app for the newest iOS
# simulator runtime, launch it on an iPad Air and an iPhone (App Review tests
# both), and fail if it dies at launch. Build 12 was rejected for a launch crash
# only iPadOS 27 showed (UIScene lifecycle required); this reproduces that kind
# of failure in a few minutes, no TestFlight needed.
#
#   scripts/ios-launch-check.sh
set -uo pipefail
cd "$(dirname "$0")/../ios/App" || exit 1
DD="${TMPDIR:-/tmp}/gs-launch-check"
BUNDLE=com.globeskimmers.app
RUNTIME=$(xcrun simctl list runtimes available | grep -o '^iOS [0-9.]*' | sort -V | tail -1)
echo "Runtime: $RUNTIME"
xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO build >"$DD.log" 2>&1 \
  || { echo "❌ build failed — see $DD.log"; exit 1; }
APP="$DD/Build/Products/Release-iphonesimulator/App.app"
devices() { xcrun simctl list devices available | awk -v rt="-- $RUNTIME --" '$0==rt{f=1;next} /^-- /{f=0} f'; }
FAIL=0
for PATTERN in "iPad Air 11-inch" "iPhone [0-9]+ Pro \\("; do
  LINE=$(devices | grep -E "$PATTERN" | head -1)
  ID=$(echo "$LINE" | grep -oE '[0-9A-F-]{36}')
  NAME=$(echo "$LINE" | sed -E 's/ \([0-9A-F-]{36}\).*//; s/^ *//')
  [ -z "$ID" ] && { echo "⚠️  no '$PATTERN' simulator on $RUNTIME"; continue; }
  xcrun simctl boot "$ID" 2>/dev/null; xcrun simctl bootstatus "$ID" -b >/dev/null 2>&1
  xcrun simctl uninstall "$ID" "$BUNDLE" 2>/dev/null
  xcrun simctl install "$ID" "$APP" && xcrun simctl launch "$ID" "$BUNDLE" >/dev/null
  sleep 20
  if xcrun simctl spawn "$ID" launchctl list | grep -q "$BUNDLE"; then echo "✅ $NAME: running after 20 s"
  else
    echo "❌ $NAME: the app is not running 20 s after launch"
    xcrun simctl spawn "$ID" log show --last 2m --style compact --predicate 'eventMessage CONTAINS[c] "failed to launch" OR eventMessage CONTAINS[c] "SIGTRAP" OR eventMessage CONTAINS[c] "SIGABRT"' 2>/dev/null | tail -3
    FAIL=1
  fi
  xcrun simctl shutdown "$ID" 2>/dev/null
done
exit $FAIL

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { SplashScreen } from '@capacitor/splash-screen'
import App from '@/App.jsx'
import '@/index.css'

// Capgo OTA: signal the live-update bundle booted OK, or Capgo auto-rolls-back.
// No-op on web; only meaningful in the native (iOS/Android) shell.
if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady().catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// The native splash no longer auto-hides (capacitor.config.ts): it stays up
// while a cold-start OTA install finishes. By the time this module runs that
// install is over, so hide it after the first paint whether or not the
// updater's own autoSplashscreen already did — a splash must never outlive
// the app it covers.
if (Capacitor.isNativePlatform()) {
  requestAnimationFrame(() => {
    setTimeout(() => { SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {}) }, 250)
  })
}

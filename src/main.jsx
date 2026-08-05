import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
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

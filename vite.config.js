import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  // Strip dev-debug console spam from production builds. The codebase
  // has ~30 console.log calls (cache hits, region detection, dialect
  // matching, store result dumps, etc.) that are valuable for our own
  // debugging but would clutter a real user's JS console on the device
  // and look unprofessional to App Store / Play Store reviewers. The
  // `pure` config tells esbuild these calls have no side effects, so
  // they're tree-shaken when their return value is unused (it always
  // is). console.error is INTENTIONALLY kept — those are genuine error
  // signals we want in production logs for crash reports / Sentry-like
  // capture if we add it later. console.warn is dropped because every
  // current call site is dev-debug noise; revisit if we add real
  // user-facing warning paths. Only applies to production builds; dev
  // server keeps all console output intact.
  esbuild: {
    pure: ['console.log', 'console.debug', 'console.info', 'console.warn'],
  },
  plugins: [
    react(),
  ],
  // `@/*` → `./src/*`. This alias was previously provided implicitly by the
  // Base44 Vite plugin; now that the project is standalone it's declared here
  // explicitly (mirrors the `paths` mapping in jsconfig.json).
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
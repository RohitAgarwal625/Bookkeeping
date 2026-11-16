---
paths:
  - "src/lib/pi*.ts"
  - "src/components/PayScreen.tsx"
  - "src/components/PremiumModal.tsx"
  - "src/components/QRScannerScreen.tsx"
  - "src/components/AutomaticTransactionScreen.tsx"
  - "backend/src/**/pi*.ts"
  - "backend/src/jobs/**"
  - "index.html"
  - "vercel.json"
  - "public/*.txt"
---

# Pi Network integration rules

- The Pi SDK is loaded by `<script src="https://sdk.minepi.com/pi-sdk.js">` in `index.html`. Always `await ensurePiInitialized()` (`src/lib/piAuth.ts`) before any `window.Pi.*` call.
- **Identity:** the browser's `Pi.authenticate` result is untrusted. Use only the `uid`/`username` returned by the App Studio login exchange (`signInWithPi`). Backend login uses that `uid`.
- **Payments flow:** `Pi.createPayment` → `onReadyForServerApproval(paymentId)` → backend `POST /api/pi/approve` → `onReadyForServerCompletion(paymentId, txid)` → backend `POST /api/pi/complete`. Approve/complete are server-only (they need `PI_NETWORK_API_KEY`). `onIncompletePaymentFound` must complete stranded payments through `/api/pi/incomplete-payment`.
- Pi amounts have 7 decimal places. Validate wallet addresses as Stellar public keys (`G` + 55 base32 chars) wherever strict validation is enabled.
- The app runs inside the Pi Browser and App Studio iframes. Don't add `X-Frame-Options`/`frame-ancestors` restrictions, and keep `frameguard: false` in helmet.
- `public/validation-key.txt` and `public/pi-app-validation.txt` are Pi domain-verification files. Never delete or rename them, and keep the `vercel.json` rewrite that excludes them from the SPA fallback.
- New Pi/third-party hosts must be added to the CSP `connect-src`/`script-src` in `vercel.json`.
- Sandbox vs mainnet is auto-detected by the SDK. Never hard-code mainnet-only behaviour without a sandbox path for testing.

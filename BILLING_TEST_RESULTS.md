# Local future-release test record

Date: 2026-10-17. Version: 0.2.0-beta.1. Branch: development/paid-release-local. No public release, live payment, repository push, deployment, account creation, or license replacement was performed.

## Implemented and exercised

- Backend: eight passing Node test cases using persistent PostgreSQL-compatible PGlite, real Stripe SDK signature helpers, and simulated Stripe provider responses. Covers concurrent/idempotent trial activation, a second installation and database restart, verified-account/one-use device exchange, cross-account rejection, explicit purchase consent, repeated Checkout attempts, failed requests, delayed confirmation, renewal, past-due grace, scheduled cancellation, webhook signature failure/tampering/duplicates/reordering/retry and reconciliation.
- Desktop access: three passing cases for Ed25519 verification, bounded cached access, expiry, serialized restart state, clock changes, tampering/wrong key/account and unchanged free-edition access. Expiry denies only prospective creation through the central guard; existing PTY operations contain no billing checks.
- Browser: actual shared AccountCard tested across eight states plus mobile 390px. Purchase requires consent, delayed payment shows confirmation, and Manage billing shows the local handoff explanation. No browser exceptions or horizontal overflow were observed. Screenshots are fixture previews, not real Stripe account evidence.
- Browser authentication: actual account page and Supabase JS SDK exercised with intercepted fictional OTP/session responses. No email was sent and no external account was created.
- Electron: actual Windows runtime with disposable profile/home. Verified free account status, accessible dependency notices, available OS-backed safeStorage, and a running terminal accepting input after sign-out. Existing platform app check passed real PTY roundtrip, mock-agent process detection, clipboard/settings and Ctrl+C behavior.
- Existing checks: TypeScript, platform, settings, alerts, submit and terminal-screen checks passed. Full unrelated application regression suite and native Mac build were not run.
- Packaging: Windows installer and portable builds produced locally. Verifier extracts both payloads without installing, checks app.asar and generated notice equality, package/PE version consistency, Chromium notices, obvious bundle-secret patterns and measured Authenticode status. Both are unsigned. Current hashes and commit provenance are generated into release/future-test-manifest.json after each verification; this document deliberately does not hardcode hashes from an earlier build.
- Release gate: expected failure until owner approvals, provider test evidence, commercial edition configuration and a separately approved production implementation exist. Live keys are rejected by the current code.

## Screenshots and local preview

Run `npm run billing:preview`, then open http://127.0.0.1:4318/.

- artifacts/billing-screenshots/trial.png
- artifacts/billing-screenshots/paid.png
- artifacts/billing-screenshots/expired.png
- artifacts/billing-screenshots/manage-billing.png (simulated browser handoff, not a counterfeit Stripe portal)
- artifacts/billing-screenshots/cancelling.png
- artifacts/billing-screenshots/past_due.png
- artifacts/billing-screenshots/confirming.png
- artifacts/billing-screenshots/unknown.png
- artifacts/billing-screenshots/free.png
- artifacts/billing-screenshots/mobile-trial.png
- artifacts/account-desktop-free.png (actual Electron Settings)

## Exact local checks

From the isolated worktree, with dependencies already installed:

```powershell
npm run typecheck
npm run test:billing
npm run test:account
npm run test:platform
npm run test:settings
npm run test:alerts
npm run test:submit
npm run test:screen
npm run build
cd billing
npm run build
node verify-preview.mjs
node verify-auth-page.mjs
cd ..
node scripts/verify-account-desktop.mjs
npm run test:platform-app
npm run dist
node scripts/verify-future-package.mjs
node scripts/check-commercial-release.mjs
```

Browser checks require the loopback preview server. Read BILLING_SETUP.md before dependency installation: this worktree's root node_modules is a development junction; use a fresh checkout for root npm ci.

## Not yet established

No real Supabase emailed OTP, real Stripe test purchase/decline/3DS/portal, deployed webhook delivery, live database role configuration, or hosted reconciliation schedule has been validated. The tests do not substitute for those steps. Future enforcement is disabled and has not been enabled against the owner's desktop profile. No test installs over an existing free copy.

Final ownership/license authority, the exact approved copyright-holder string, missing Terminal repository provenance, asset rights and external NSIS plugin obligations require review. Runtime notices cover actual renderer and external packages plus Chromium and NSIS core; unresolved plugin licenses are not guessed or claimed cleared.

Before launch: approve future license/terms, privacy/contact/retention, refunds/tax/disputes, proposed seven-day offline and three-day payment grace policies, private billing support route, signing/distribution policy and explicit opt-in installation identity. Supply approved test infrastructure, complete real provider tests, then separately authorize any production implementation/publication. Keep v0.1.18 artifacts, tags and notices intact.

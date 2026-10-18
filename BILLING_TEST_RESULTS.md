# Local future-release test record

Latest follow-up: [PAID_LAUNCH_HANDOFF.md](PAID_LAUNCH_HANDOFF.md). 26 backend tests and six desktop account tests passed, plus browser auth/admin/MFA/recovery checks, desktop typecheck/build, real Electron free-edition/sign-out checks and fresh Windows installer/portable inspection. Real Stripe sandbox API payments, actual hosted webhook delivery, renewal/cancellation and failed renewal are now evidenced. Full user-operated hosted Checkout/portal/MFA remains unverified. The older entries below are historical, not the latest status.

Date: 2026-10-17. Version: 0.2.0-beta.1. Prepared on development/paid-release-local for the owner-authorized main push. No public application release, live payment or license replacement was performed. The separate TEST backend is deployed; see the latest section below.

## Latest provider setup evidence

- Subscriber alerts: 18 backend tests pass, including new paid subscription versus renewal, duplicate/invalid/delayed webhooks, failed email delivery without access loss, persisted retries and concurrent dispatch, missing configuration, and stopping ambiguous retries before Resend's idempotency key expires. Email tests use an injected provider; no email was sent. Delivery still needs a separate domain-restricted Resend sending key and confirmed owner recipient. Deployed test backend `6ad42c2d74c1203dfd268b8f` is ready with the scheduled retry function; live payment support remains disabled.
- Merged existing GitHub main commit `1300912` (real agent-state reporting and beginner setup) into the development work rather than overwriting it. Future version remains 0.2.0-beta.1. Typecheck/build and browser OTP/owner-access tests pass. The multiwindow regression initially selected another pane's move control; the test now selects the detached terminal's ID and waits for its rendered state, and passes on rerun. Final desktop regression results are reported in the handoff.
- The owner requested a first real subscription as a test. Stripe's official testing documentation explicitly prohibits live-mode testing with real payment details (https://docs.stripe.com/testing). No live key, product, charge, or live subscription was created. A real paid launch still needs approved terms, production configuration and completed provider validation; source publication does not enable payment collection.
- Final merged-source checks: all existing npm test stages passed (the corrected multiwindow stage and remaining stages were resumed individually), plus four account-access tests and the real Electron Login welcome check. All 18 backend tests, browser authentication/owner tests, backend build and bundle-boundary checks passed. Hosted account/admin pages, API authorization, signature rejection, isolated device flow and 390/1440px browser smoke checks passed on the new deploy. Pre-push tracked-source and unpushed-history secret-pattern scans found no matches. No new installer or Mac binary was built in this follow-up.

- Follow-up Checkout failure diagnosed against the real Stripe TEST API: payment_method_types is no longer supported by the pinned API version. Removed that parameter and versioned Checkout idempotency keys to avoid replaying the rejected payload. Existing saved/open Checkout handling remains intact. Real TEST Checkout creation now succeeds (open session, no payment), and fix deploy 6ad3e54dabb3947c54049c8b is ready. The owner's successful email/device login persisted across the isolated app restart. Trial activation and a paid test subscription remain pending.
- Added a prominent Login welcome action for configured signed-out empty workspaces, with account/trial controls after login and no automatic project chooser over that welcome. Existing free-edition behavior remains unchanged. Typecheck, four access/development-origin tests, fourteen backend tests, build and real Electron Login action check passed. Screenshot: artifacts/billing-hosted/login-welcome.png. The test app was reopened with its existing isolated profile; saved login restored.

- Interactive sign-in follow-up: owner reached email verification, but device approval returned 409. Read-only database flags confirmed the requests were expired, unconsumed and unapproved. Deployed fix 6ad3e35e29dc5a4591bfcaea adds a state-bound availability check before requesting email, stage-specific expiry messaging, completed-form hiding, vertical spacing and duplicate-click suppression. All 14 backend tests, browser expiry/spacing tests and hosted smoke checks pass. A fresh request was opened in the existing isolated test app; successful end-to-end owner login/purchase remains pending.

- Two real email verification checks succeeded through Supabase/Resend in the local auth check page. Owner confirmed success. No trial or Stripe subscription starts from that check.
- Stripe API confirmed the existing active TEST price: USD 600 cents, every one month. Created a TEST customer portal configuration with cancellation at period end. No customer portal session or test purchase completed yet.
- Separate Netlify test project deployed after subsequent owner approval of standard encrypted environment storage: https://terminal-buddy-billing-test.netlify.app, ready deploy 6ad3e010071bbd4cb96fb0dd. No Git connection or marketing-site change. TEST webhook registered; no live keys used.
- Hosted Supabase database authentication passed with verified TLS and the dashboard CA. Billing schema applied in one transaction, then verified over a fresh connection. All four billing tables have RLS, anon/authenticated have no table grants, and public API requests returned HTTP 401 for all four. Dedicated restricted backend login and hosted CA configuration verified. The deployed function created/read an unapproved expiring device-flow record; no trial/account records or payment were created.
- All 14 backend tests pass, including migration/default-grant preservation tests and custom CA/hostname-validation configuration tests. Payment tests still use simulated Stripe responses and local PGlite; they do not establish hosted payment success.
- Hosted smoke tests: account/admin/notices 200 with noindex/no-store; config contains only origin and public Supabase settings; account APIs 401 without login, cross-origin 403, nonexistent route 404; owner API disabled (503). Webhook invalid signature rejected and locally signed no-op event accepted. This is not evidence of actual Stripe-originated delivery. Real browser JS loads without exceptions; 390/1440px account pages have no horizontal overflow. Screenshots: artifacts/billing-hosted/account-390.png and account-1440.png. Full logged-in app, trial, Checkout and portal flow remains untested on this deployment.
- Added local-only auth-check server/browser harness. Credentials and signing key are ignored local files; none is embedded in the public browser build. See STACK_SETUP.md for the precise external setup status and pending owner inputs.

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

Follow-up owner dashboard and stack preparation (2026-10-17): 11 backend/configuration cases pass, including owner ID authorization, non-owner/unverified/desktop-token rejection, read-only filter/pagination behavior and TEST credential checks. The compiled owner page passed browser checks at 390/768/1440px, intercepted Supabase OTP login, sign-out clearing, literal rendering of hostile email text, unavailable-service retry and non-owner denial. Screenshots: artifacts/owner-screenshots/owner-390.png, owner-768.png, owner-1440.png. Existing account/auth preview browser checks still pass. The function/browser bundle isolation and secret-pattern scan passes. No fixture imports appear in the deployable function. Setup check fails intentionally on the eight missing provider/origin/key settings; an empty owner allowlist separately denies admin data access. No new desktop artifacts were built for this backend-only follow-up; the prior local EXEs still identify their original 10fc18a source commit.

Real Supabase emailed OTP is now validated as noted above. Real Stripe test purchase/decline/3DS/customer portal, deployed webhook delivery, hosted database role configuration and a hosted reconciliation schedule remain unvalidated. The tests do not substitute for those steps. Future enforcement is disabled and has not been enabled against the owner's desktop profile. No test installs over an existing free copy.

Final ownership/license authority, the exact approved copyright-holder string, missing Terminal repository provenance, asset rights and external NSIS plugin obligations require review. Runtime notices cover actual renderer and external packages plus Chromium and NSIS core; unresolved plugin licenses are not guessed or claimed cleared.

Before launch: approve future license/terms, privacy/contact/retention, refunds/tax/disputes, proposed seven-day offline and three-day payment grace policies, private billing support route, signing/distribution policy and explicit opt-in installation identity. Supply approved test infrastructure, complete real provider tests, then separately authorize any production implementation/publication. Keep v0.1.18 artifacts, tags and notices intact.

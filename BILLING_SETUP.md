# Terminal Buddy future billing — local TEST implementation

## Status and boundaries
Version 0.2.0-beta.1, prepared on development/paid-release-local. The owner authorized pushing the completed source to main on 2026-10-17. The authorized TEST backend is deployed; see STACK_SETUP.md and BILLING_TEST_RESULTS.md for observed status. No live charge or paid application release was performed. Current free edition behavior and website remain unchanged. Main app LICENSE, MIT metadata, copyright field and old release files remain unchanged. Commercial release is blocked by release-approvals.json and scripts/check-commercial-release.mjs; permission to push source does not approve unspecified legal terms.

Backend packages are isolated in billing/package.json and lockfile: Stripe 23.0.0 (SDK stable API 2026-09-30.endive), pg 8.23.1, Supabase JS 2.118.0. PGlite 0.5.10 is local/test only. No Stripe/database/admin secret is used in Electron. Existing app dependencies were not upgraded.
The owner has selected Netlify, Supabase, Stripe and Resend. See STACK_SETUP.md for the ordered connection checklist, SMTP email template, read-only owner dashboard, setup checks and partial provider connection evidence.

## Run locally
From this worktree root:
```powershell
npm run typecheck
npm run build
npm run test:account
npm --prefix billing ci
npm --prefix billing test
npm --prefix billing run dev
```
Open http://127.0.0.1:4318/ for the actual AccountCard component with fictional states. It is labeled local and uses no Stripe account. State selectors cannot grant desktop access. Preview-only code is not imported by the production function or desktop bundle.
```powershell
cd billing
node verify-preview.mjs
node verify-auth-page.mjs
node verify-owner.mjs
node verify-deployment.mjs
cd ..
node scripts/verify-account-desktop.mjs
npm run test:platform-app
```
The Electron checks always use disposable profiles and fictional home directories. Screenshots are in artifacts/billing-screenshots/ and artifacts/account-desktop-free.png. Preview screenshots are component/state previews, not evidence of a real paid Stripe account.

For a fresh clone run npm ci at the root first. This isolated worktree currently uses a development-only node_modules junction to the original checkout; do not run root npm ci against that junction. Use a fresh clone/directory for a clean dependency install. No source/build script relies on an absolute sibling path.

Optional local desktop connection: start billing/dev.mjs, set BUDDY_BILLING_DEV_ORIGIN=http://127.0.0.1:4318 and BUDDY_BILLING_DEV_PUBLIC_KEY to billing/.local/public-key.pem contents, then start Electron with an explicit disposable --user-data-dir. Packaged apps ignore these variables. The local browser sign-in page is a labeled simulated verification flow. It never sends an email.

For the actual hosted test service, the unpackaged isolated-profile development override also allows exactly https://terminal-buddy-billing-test.netlify.app with billing/.local/entitlement-public.pem as the public verification key. No other remote origin, credentials, path or query is accepted. Use fictional HOME/USERPROFILE directories and a separate user-data-dir when testing; the real owner's profile is not a test fixture. Packaged apps still ignore overrides and enforcement remains disabled. Manual test sequence: sign in through the system browser, enter the email code yourself, approve the initiating device, start the no-card trial, explicitly subscribe using Stripe test card 4242 4242 4242 4242 with any future expiry and three-digit CVC, then refresh status in the app. Never use a real card in this test environment. Verify actual webhook events and backend paid-through dates before claiming payment success.

## Proposed hosting
Keep terminalbuddy.to static. Use a separate approved Netlify test billing project with base directory billing, config billing/netlify.toml, build npm ci && npm run check:setup && npm run build, output public, functions functions, Node 22. Supabase supplies verified email auth plus persistent Postgres. This adds one small API and one database, not a terminal backend.
A separate test project is deployed at https://terminal-buddy-billing-test.netlify.app with account page /account/ and no connected Git repository. Never silently connect production main or add DNS records. Account pages remain noindex. Function/auth/database usage can have plan limits and cost; Stripe processing fees apply only to eventual live payments. Owner must approve plans, quotas and spending separately.

## Environment and migrations
Copy billing/.env.example to an untracked .env and populate TEST credentials only:
- STRIPE_SECRET_KEY: sk_test_ key, server only; sk_live_ rejected.
- STRIPE_WEBHOOK_SECRET: test webhook signing secret, server only.
- STRIPE_MONTHLY_PRICE_ID: one active test USD 600-cent recurring monthly Price, interval_count 1. The server retrieves and checks it before Checkout; app-supplied price/customer IDs are refused.
- STRIPE_PORTAL_CONFIGURATION_ID: selected TEST portal configuration with cancellation at period end and plan switching disabled. Omission preserves the Stripe account default for existing local fixtures; use the explicit configured ID in staging.
- SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY: actual approved project; publishable key is intentionally public. No service-role key is sent to a client.
- DATABASE_URL: server-only TLS Postgres connection/pooler. Use Supabase's documented connection string and an appropriately privileged dedicated backend role. Do not disable certificate verification.
- DATABASE_CA_CERT: public root CA PEM from the Supabase dashboard. When supplied, billing/connection.mjs requires sslmode=verify-full and configures pg with CA/hostname verification. The hosted test backend uses the restricted terminal_buddy_backend role; migrations use the separate administrator connection locally.
- BILLING_ORIGIN: actual HTTPS origin, no path/query/credentials.
- ENTITLEMENT_PRIVATE_KEY: Ed25519 PKCS8 PEM, server only. Put corresponding SPKI public key into the future desktop build configuration. Local preview uses a generated ephemeral key; production needs managed secret storage, rotation and review.
- OFFLINE_DAYS and PAST_DUE_GRACE_DAYS: proposed 7 and 3, bounded 0–7 in code; owner approval required.
- OWNER_USER_IDS: verified Supabase user UUID allowlist, server-only. Empty disables all owner data access. Never grant owner status from an email address or browser flag.

Apply billing/migrations/001_accounts.sql to an approved TEST database:
```powershell
cd billing
node --env-file=.env migrate.mjs
```
Tables: accounts (explicit trial_started_at/trial_ends_at and minimal billing references), desktop_sessions (hashed opaque token, account ID and expiry), device_flows (challenge/state hash, expiry, one-use status), processed_events (event ID/type/time only). RLS is enabled without public policies; browsers cannot access billing tables. billing/db.mjs also revokes explicit privileges from anon/authenticated when these roles exist, including TRUNCATE, which RLS does not protect. Backend connects via its server role. Migrations do not copy app histories.
Schema currently targets a new test database. Production migration/backups and role permissions require review. Do not point the local fixture server at a real database.

## Authentication
Configure Supabase email OTP using the official Token template and verified email flow, proper SMTP and abuse limits. The browser uses signInWithOtp and verifyOtp with in-memory sessions. The backend calls auth.getUser; an unverified account cannot approve a device.
Electron opens the system browser to a five-minute request. Desktop creates a random verifier plus separate state; only the SHA-256 challenge is stored. Verified browser approval binds the account. The desktop exchanges verifier/state once, in a transaction. No durable account token is placed in any URL. This is application handoff glue around Supabase auth, not a claim of implementing a standard OAuth device-grant server.
Opaque desktop sessions expire in 30 days. Only hashes are stored server-side. Electron uses safeStorage (Windows DPAPI / supported OS keychain). If unavailable or Linux basic_text is selected, credentials remain memory-only. OS encryption is not protection against other code running as the same logged-in user. Sign-out clears local credentials even if offline; server revocation is attempted, otherwise the session expires. Supabase browser session is not persisted.

## Trial, Checkout, portal and reconciliation
Only explicit Start free trial starts the 14-day trial; row locking and the database invariant make it one-time/idempotent. Another installation uses the same account. The backend never creates a Stripe subscription for a trial. New email accounts can repeat trials; no device fingerprinting or invasive DRM is attempted.

Checkout requires authenticated explicit recurring-charge acceptance. One plan: USD $6/month, charged today and monthly until canceled. Buying during a trial starts billing immediately; unused trial days do not delay payment. The app displays this before enabling Subscribe. No card is requested for trial activation.
Customer IDs and Checkout attempts are server-controlled. Customer mapping commits before Checkout. Account locking, stable Stripe idempotency keys, reuse of open sessions and subscription reconciliation handle retries/double clicks. The Stripe portal manages payment methods, invoices and cancellation; configure its TEST portal for cancellation at period end, and disable plan switching/coupons or other unapproved plans. Tax/refund treatment is not implemented as a policy and must be approved before launch.

Raw webhook bytes go to Stripe SDK signature verification. Live events are rejected. Processed IDs and account updates commit atomically; failures roll back so Stripe retries. Out-of-order events cause a fresh Stripe read, not replay of stale event payload. Paid access is derived from paid invoice periods matching the approved Price and subscription, not a redirect, local flag, or active status alone. Initial incomplete payments show confirming after any remaining trial ends. Paid-through access survives scheduled cancellation.
Register TEST events listed in service.mjs: subscription changes, invoice paid/failed/action-required, Checkout completion/failure/expiry. A delayed webhook is repaired by account Refresh, checkout preflight, or:
```powershell
node --env-file=.env reconcile.mjs
```
Reconciliation is a manual authenticated server operator command; no public cron endpoint is exposed. Configure an approved scheduled invocation before launch. Stripe SDK auto-pagination reads subscription, paid-invoice and invoice-line history instead of silently truncating it. Refund/dispute/fraud handling policy remains a launch blocker; no automatic access rule is invented.

## Access policy and user work
Proposed offline allowance: at most seven days after successful verification, never beyond trial/paid/grace dates. Proposed failed-renewal grace: three days after the previously paid-through date, only when Stripe says past_due; a first unpaid invoice does not earn grace.
Ed25519-signed access records are verified in the main process against a pinned public key, subject, audience, issuer and timestamps. Cached records cannot extend themselves. Backward clock changes beyond tolerance or large wall/monotonic divergence require online verification. This is ordinary access management, not anti-tamper protection; restoring old machine backups or altering local code is outside its guarantees.
Timeouts retain bounded verified access and display uncertainty; they are not cancellation. Checks run on startup, explicit refresh, and new session creation; no per-keystroke network request.
Only pty:create receives the prospective access guard. Existing PTY input, output, resize, history viewing/export, files and provider accounts are untouched. No access code kills processes or deletes data. Account/help remain accessible.

src/shared/edition.ts remains kind free, enforcement false, commercialApproved false. Packaged apps have no environment override. Before a future approved edition, deliberately configure its origin/public key, separate opt-in installation/profile identity and upgrade disclosure; do not send it through old free updater feeds. Existing free installation must remain available. A seven-day cache can delay learning about remote cancellation; this tradeoff needs approval.

## Real provider validation still required
Real Supabase email verification succeeded twice. Stripe API verification confirmed the existing TEST $6/month price, and a TEST portal configuration was created. These are not evidence of completed Checkout or billing access. Automated payment tests still use simulated Stripe data and a local PostgreSQL-compatible engine. No real hosted purchase, deployed webhook, invoice, refund or customer portal session has been validated.
The hosted database migration, restricted backend role, CA configuration, webhook registration and deployment smoke checks are complete; details are in STACK_SETUP.md. Pending: real authenticated app handoff and trial, owner access, successful Stripe-hosted test purchase/portal, actual Stripe webhook delivery, 3DS/action-required, declines, duplicate clicks, webhook retry/reorder, renewal/test clocks, cancellation and reconciliation from a second installation. Add evidence to release-approvals.json only after tests pass.

## Release preparation
```powershell
npm run dist
node scripts/verify-future-package.mjs
node scripts/check-commercial-release.mjs
```
Fresh files live only in this worktree's release/. They are local free/test binaries with future version, not an approved paid release. The package verifier checks app version/license, renderer+external notices, Chromium notice presence and obvious secret patterns, then hashes only new files. Manifest includes source commit and dirty status; dirty or mismatched builds cannot pass commercial checks. Review and commit exact future source, rebuild, verify and tag only that new matching commit after authorization. Never move v0.1.18.
On Windows the package verifier requires PowerShell 7 (`pwsh.exe`) and the existing electron-winstaller 7-Zip tool. It extracts each installer/portable payload without installing it, compares embedded application and notices, and measures PE product version and Authenticode status. The local binaries are unsigned. See BILLING_TEST_RESULTS.md for the observed tests and remaining provider validation.
The commercial gate intentionally fails until legal/terms/copyright/support/privacy/refund-tax/offline-grace/signing/installer-notice/provider-test/production approvals exist and a deliberate production implementation replaces the test-only restriction. No live key can enable this scaffold by itself.

## Subscriber email alerts

The owner requested new-subscriber emails. `billing/subscriber-alerts.mjs` queues one alert per subscription after Stripe reconciliation finds a paid invoice for the configured plan. A trial, open Checkout, failed payment, or subsequent renewal does not create another alert. A returning customer buying a new subscription generates a new alert. Historical paid subscriptions first discovered by reconciliation also count; review pending records before enabling email for an existing customer database.

Set these three server-only variables on the separate billing Netlify project:
- `RESEND_API_KEY`: a new Sending-access API key restricted to the already verified `auth.terminalbuddy.to` domain. Keep the Supabase SMTP key separate.
- `SUBSCRIBER_ALERT_FROM`: an address on that verified domain, for example `notifications@auth.terminalbuddy.to`.
- `SUBSCRIBER_ALERT_TO`: the owner's confirmed email address, not a browser-supplied value.

The fields remain blank in `.env.example`. With no configuration, billing still works and alerts remain pending. Do not put the API key in chat, Git, the website or the Electron bundle. All messages currently say TEST; the backend still rejects live payments.

Webhook reconciliation commits paid access and the durable alert before attempting email. A database lease and stable Resend idempotency key suppress concurrent sends. The original message is retained for retries. Resend acceptance marks it sent; this does not prove inbox delivery. The scheduled Netlify function retries up to five accounts every five minutes; it needs the same server variables and runs only on the project's published deploy. An ambiguous attempt older than 23 hours becomes `review` to avoid retrying after Resend's 24-hour idempotency window. Inspect Resend delivery history before any manual resend. No new database table or browser grants are needed.

Verify with `npm --prefix billing test`, deploy the test backend, then complete a Stripe sandbox purchase and check actual delivery. Automated tests use a fake email provider and do not send mail. Real delivery remains unverified until a restricted sending key and recipient are configured.

References: https://resend.com/docs/api-reference/emails/send-email, https://resend.com/docs/dashboard/emails/idempotency-keys, https://docs.netlify.com/build/functions/scheduled-functions/

## Official references
- https://docs.stripe.com/payments/checkout/build-subscriptions
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/customer-management
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://www.electronjs.org/docs/latest/api/safe-storage
- https://www.electronjs.org/docs/latest/tutorial/security
- https://docs.netlify.com/build/functions/overview/

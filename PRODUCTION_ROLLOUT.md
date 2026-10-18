# Subscription rollout

## Current production rollout

The live account service is deployed at https://terminal-buddy-billing.netlify.app (deployment `6ad51fba444096cadf6b8399`). The live Stripe webhook is registered and its secret is configured. The owner reiterated that the complete rollout should proceed. This release preserves existing software licenses rather than applying the previously discussed proprietary-license change. See SUBSCRIPTION_RELEASE.md for current build/deployment facts. Older entries below are historical, including previous approval requests and statements that production was not deployed.

The opt-in Windows 0.2.0-beta.2 portable ZIP passed archive, package-version, runtime-notice and secret checks. Its executable is NotSigned. The actual packaged desktop passed signed-out access gating, context isolation, notice display and native PTY startup using a disposable profile. Live purchase confirmation remains a separate test; no payment was simulated as a real charge.

## Latest verified state — October 18 continuation

The owner explicitly requested the complete live rollout. General deployment authorization is not missing. Read-only Netlify verification still returned no published deployment for production billing site `d553f956-187c-4d07-a3cb-51e71a8587be`. The marketing site is deployed at `6ad50ecb75e4cdf7d88d0861`; `/contact/`, `/privacy/` and `/download/` each returned HTTP 200. The contact page lists `cole@terminalbuddy.to`; delivery/monitoring of that inbox was not tested. Marketing privacy does not yet describe the new subscription service.

All 32 billing tests, the account-page build and deployment bundle/secret-boundary verification passed again after the schema isolation changes. Supported Stripe snapshot events are now centralized in `billing/webhook-events.mjs` and consumed by the webhook handler. Use that exact list for the production destination at `https://terminal-buddy-billing.netlify.app/api/webhook`.

The actual Windows installer payload includes System, UAC, StdUtils, nsDialogs, nsExec, nsis7z and WinShell DLLs. The portable includes System, nsis7z and StdUtils. The installed StdUtils header declares LGPL-2.1-or-later, so a generic MIT/NSIS notice is not evidence that the external plugin notice review is complete. No additional license grant was invented and no historical artifact was changed.

`LAUNCH_REVIEW.md` collects the exact unresolved owner decisions. The production webhook, policy publication, paid app packaging and end-to-end live payment verification are still incomplete. Browser inspection for webhook setup was blocked by automatic approval review because the previously granted UI permission covered window titles only; the owner has been asked to authorize Stripe dashboard inspection/configuration. No attempt was made to bypass that rejection. No production deployment or payment happened during this continuation.

Earlier entries below are chronological records and may describe states superseded above (including the missing live key and the former separate-database proposal).

## October 18 production preparation

The owner corrected the intended seller identity to **Eric Colton Newman** and authorized launch again. This identifies the seller; it does not establish copyright ownership or approve a new application license. Existing application/dependency notices remain unchanged.

The new live Stripe account `acct_1URyoaGHmsvyAdG8` was verified through authenticated, read-only API calls. Payments and payouts are enabled, business details are submitted, and no currently-due verification requirements were returned. The active live price `price_1URz0IGHmsvyAdG8Bvgt2x8T` is USD 600 cents every month for product `prod_VSupHFVotx32KU`. Portal configuration `bpc_1URz3WGHmsvyAdG8NjDWWT77` enables invoice history, payment updates, and cancellation at period end; subscription updates are disabled. Terms/privacy links remain unset. Customers, invoices, subscriptions, Checkout and portal read checks passed. Write permissions and a live purchase have not been exercised. No customer, subscription or charge was created during these checks.

A separate Netlify site was created in the existing team: `terminal-buddy-billing`, ID `d553f956-187c-4d07-a3cb-51e71a8587be`. Its assigned origin is `https://terminal-buddy-billing.netlify.app`. **There is no published deployment at this origin yet.** No Git integration, DNS change, secret upload or purchase endpoint was enabled. A new production Ed25519 key was generated locally, separate from the sandbox key. Ignored local files hold all credentials; no secret is present in this document.

The owner subsequently chose a paid future application edition and explicitly approved reusing the existing Supabase project. This authorizes the direction and database setup, not invented final commercial license text or retroactive removal of MIT rights. Final commercial terms, privacy/refund/tax details, copyright-holder text and distribution review remain unresolved. The preparation gate has not been bypassed.

Production schema `terminal_buddy_live` and login `terminal_buddy_live_backend` now exist in the existing Supabase project. Its five tables have RLS enabled and grant runtime access only to the dedicated role. The runtime role has no superuser, database/role creation, RLS bypass or TRUNCATE privileges. Auth/SMTP settings were not changed. Actual verified-TLS database checks confirmed that sandbox counts remained unchanged, the production login cannot read sandbox accounts, and browser/sandbox roles cannot access the production schema. No live customer account rows were created. Connection details stay in ignored local configuration; the database administrator password is not used by the runtime.

`billing/schema.mjs` requires `DATABASE_SCHEMA=terminal_buddy_live` in live mode and rejects it in sandbox mode. `postgres()` pins a transaction and sets the schema locally for each operation, avoiding dependence on persistent session settings in Supabase's transaction pooler. Migrations verify the selected schema and revoke browser grants in that schema rather than hard-coding `public`. Local isolation tests cover independent rows with the same user UUID, rollback, schema reset, migration idempotency and denial of browser grants. All 32 billing tests and the frontend build passed after this change.

Netlify rejected function-scoped Secrets Controller variables with HTTP 403 (scope/upgrade restriction). Automatic approval review initially rejected ordinary environment-variable storage because authorized team administrators can view those credentials. The owner subsequently explicitly approved that visibility with “that's fine.” On October 18 at 19:14 UTC, the 13 production settings were stored through `billing/.local/configure-production-env.mjs --standard-storage`, then read back and compared with their local source without printing values. The database URL uses only the restricted production role; no administrator database password was uploaded. The current team plan requires all variable scopes; they are limited to the production context on the isolated billing site, which has no Git integration. These are ordinary Netlify variables, not Secrets Controller secrets. No plan upgrade was purchased. Evidence is in ignored `billing/.local/production-environment-verification.json`. **No production deployment or purchase endpoint is enabled yet.** The production Stripe webhook and paid installer remain unconfigured/unpublished.

Validation on October 18: `npm --prefix billing test` passed all 30 tests; `node --test scripts/verify-commercial-preparation.mjs` passed its preparation-boundary test. These tests use local/simulated payment data, not live purchases. Read-only Stripe evidence is in ignored `billing/.local/live-stripe-verification.json`; infrastructure evidence is in ignored `billing/.local/production-site-preparation.json`. App UI/support edits already present in the worktree were left untouched.

The current local key handoff is `http://127.0.0.1:4323`, started with `node billing/.local/stripe-live-intake.mjs`. It no longer requests copyright-holder text. It saves the seller, selected account/price/portal IDs and live key locally only. The earlier port 4322 intake is superseded.

October 17: the owner explicitly authorized launch, recorded by `productionAuthorized: true`. Other flags describe still-missing decisions/evidence, not another request for general launch permission. Read-only inspection found only the test billing Netlify site and the static marketing site, a sandbox Stripe key, and no GitHub signing secrets. Real payment credentials and the legal seller/copyright identity have not been supplied; the sandbox's test business name is not proof of that identity.

The local-only owner input page is running at `http://127.0.0.1:4322` from ignored `billing/.local/production-intake.mjs`. It stores a live Stripe key and the owner's exact seller/copyright text in ignored `billing/.local/production-owner-inputs.json`, never in Git or the browser bundle. It validates the origin, rejects test keys, serves no-store responses, and performs no payment/deployment action. Values are not printed. Restart with `node billing/.local/production-intake.mjs` if needed; keep this file local. Native browser inspection could not safely establish the Stripe URL, so actual live dashboard setup must be resumed with a supported authenticated connection or the owner's supplied inputs.

Application main includes the automatic account UI and Mac startup correction. Website main `4546705` deployed successfully as Netlify deployment `6ad44e64ac5584652dde32d1`. Live route/crawl/404 checks and full unauthenticated Windows installer/portable hashes passed. This website deployment does **not** enable live billing or change the free Windows v0.1.18 download. See `MAC_RELEASE.md` for the separately tested Mac candidates.

The owner-operated Link test is paid and the isolated desktop observed paid access. The new app also reconciles automatically: one shared background worker checks on startup, at most once per 15 seconds on focus, every five seconds during the ten-minute Checkout observation window, then every five minutes. It coalesces requests, preserves bounded verified access during outages, and broadcasts updates to all account views. **Check again** is a fallback. A URL query never grants access.

## Work prepared locally

- `billing/mode.mjs` defaults to test. Live requires reviewed `billing/release-config.mjs`, matching exact production origins, a mode-matching secret/restricted key and the approved Stripe account. The adapter checks account readiness before live customer/payment operations. It validates USD 600 cents/month and environment on prices, subscriptions, invoices and checkout state. Webhooks reject the other environment.
- Test and production entitlements use different issuers and must use different signing keys. The packaged free edition remains free. Commercial builds get a separate `terminal-buddy-subscription` local profile.
- `scripts/prepare-commercial-config.mjs` refuses missing approvals or unfinished policies. It prepares configuration locally only. It neither licenses source nor deploys anything. Its generated installer uses a separate application ID, product/shortcut name and output directory; it does not replace v0.1.18.
- `COMMERCIAL_POLICY_DRAFT.md` and `PRIVACY_BILLING_DRAFT.md` are internal drafts. No final license, operator identity, tax treatment or support promise has been invented.

## Required inputs and decisions

1. Exact legal operator/copyright name, approved future license/terms and ownership review. Keep all historical and dependency notices. Do not infer a proprietary grant from payment functionality or `private: true`.
2. Approve or revise refunds/tax, private support/recovery, privacy/retention, seven-day bounded offline allowance and three-day failed-renewal grace. Supply finished policy files. Refunds remain a manual supported Stripe operation, not an automatic app promise.
3. Select the production Stripe account and finish its business verification. Create the live USD $6 monthly price, portal configuration with at-period-end cancellation/no plan switches, and webhook endpoint. Use a separate production Supabase database/project and new entitlement key. Auth/SMTP and both owner UUIDs/MFA must be configured there. No production accounts or paid services have been created by this work.
4. Approve signing/distribution and review external installer plugin obligations. A truthful unsigned pilot is a decision for the owner; do not label it signed. Verify actual installer signatures and hashes.
5. Finish remaining provider browser tests and operational checks: no-card first-run trial, customer portal cancellation, action-required checkout, SMTP delivery/rate limits, backup restoration, production alerts and webhook monitoring. Record each result separately; one successful purchase is not approval of every test.

## Exact local preparation sequence after approvals

Run from the isolated application worktree, not the dirty original application checkout. Populate only known, approved values in a copy of `production-inputs.example.json`; this file holds public configuration, not server credentials. Keep server secrets in the hosting environment or an ignored file, never chat or Git.

```powershell
node scripts/prepare-commercial-config.mjs --inputs=billing/.local/production-inputs.json
node scripts/prepare-commercial-config.mjs --inputs=billing/.local/production-inputs.json --write
npm run typecheck
npm run test:account
node --test scripts/verify-commercial-preparation.mjs
npm --prefix billing test
npm run build
```

Apply only the approved future license changes as a separate reviewed change if needed. Review the generated configuration and policy export, then commit the exact release source locally before packaging. With the approved signing configuration supplied securely:

```powershell
npx electron-builder --config electron-builder.commercial.yml --win nsis portable --publish never
node scripts/verify-future-package.mjs --commercial
# Load production server variables securely for this read-only gate:
node scripts/check-commercial-release.mjs
```

The verifier compares packaged main/preload code with the current build, PE/package versions, notices, hashes and signing status. A commercial manifest is separate from the existing local test manifest. Neither packaging nor the gate publishes a binary. An installer built before these source changes is stale.

## Production backend deployment

Keep the marketing site static. Use a separately selected Netlify billing site with `billing/` as its root, `npm ci && npm run check:setup && npm run build`, output `public`, functions `functions`, Node 22. Do not repoint the existing test site or marketing project. Choose the actual assigned origin before generating the production config; no new hostname is assumed here.

Server variables: `BILLING_MODE=live`, `STRIPE_SECRET_KEY` (mode-matching restricted key preferred with required Checkout/customer/subscription/invoice/portal/account permissions), `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_PORTAL_CONFIGURATION_ID`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DATABASE_CA_CERT`, `BILLING_ORIGIN`, `ENTITLEMENT_PRIVATE_KEY`, `OWNER_USER_IDS`, approved `OFFLINE_DAYS` and `PAST_DUE_GRACE_DAYS`. The publishable Supabase key is browser-safe; database/Stripe/signing credentials are server-only.

Optional first-subscription email: a separately scoped Resend sending key plus `RESEND_API_KEY`, `SUBSCRIBER_ALERT_FROM`, `SUBSCRIBER_ALERT_TO`. Delivery failure must not deny access. Stripe's successful-payment email preference must also be checked in the actual live account; the sandbox preference does not prove live delivery. Do not reuse another project's Resend key or Supabase's SMTP secret.

Run `npm --prefix billing run migrate` with the intended production database configuration only after verifying the target. Migrations affect only the five billing tables and deny browser roles. Use the restricted runtime database role, not the administration password. Run `node check-setup.mjs --online --require-owner` from `billing` with that environment; it checks configuration/providers without creating charges. Build account pages with the production Supabase origin so CSP permits the correct auth host.

Use the existing raw-body webhook handler. Subscribe to the supported checkout, invoice and subscription events listed in `billing/service.mjs`; use the live endpoint's own signing secret. Inspect real delivery errors without logging authorization headers or full payloads. Scheduled reconciliation and alert retries are registered by the Netlify function declarations; verify actual invocations after deployment.

Only after the gate passes and the specific release is authorized: deploy the selected production backend, verify unauthenticated/private-route boundaries, upload the new opt-in artifact to the approved release channel, update version-specific website links/copy, and push the reviewed commits. Do not change old installer URLs, old tags, repository visibility, or the free updater feed.

## Operations and rollback

Monitor failed webhook deliveries, reconciliation lag, auth delivery failures and pending alert outbox items. Establish restore-tested backups and the access/retention policy before collecting real customer data. The admin screen is a read-only account view plus explicit recovery workflow, not a full billing administration replacement; payment changes remain in Stripe.

For an incident, stop promoting new purchases while keeping account/help/portal and webhook processing available. Do not revoke existing paid entitlements, cancel customers or delete records merely to roll back a UI build. Restore only a compatible previously approved backend deployment; verify migrations and event reconciliation first. Existing running terminals must remain untouched.

Possible costs: Stripe processing/Billing fees, Supabase and Netlify plan usage, Resend volume, code signing and any separately approved tax/monitoring service. No new paid service has been enabled. Consult the providers' current pricing before enabling a billable option.

## Confirmed launch — October 18, 2026

Production is published at https://terminalbuddy.to with Windows x64 and Apple Silicon/Intel Mac downloads. Website source: bff31fcee40031ddeff371a53d2e7e779d2d18b1. Netlify deployment: 6ad5249fcd49666d09858305. The prior production deployment was locked; the exact passing build was manually promoted, preserving manual publication control.

Application packages: subscription-v0.2.0-beta.2, source 2fa61fbdbf65d5ad45bac10084c23c74a2f191c3, clean build manifests. Both native Mac jobs passed in Actions run 39160226282. All five new files plus both historic free files passed unauthenticated format/size/SHA-256 checks. Existing free binaries/tags remain unchanged.

Billing backend: https://terminal-buddy-billing.netlify.app, deployment 6ad52528862125a6b8e3e395, with the Checkout default fix in source 2e5179b. The new Stripe account defaulted to Managed Payments, causing Checkout rejection without a product tax code. Checkout explicitly uses managed_payments.enabled=false to preserve the approved direct-merchant Stripe flow. This does not configure tax registrations or make Stripe merchant of record.

Live customer, Checkout, repeated-click reuse, and portal creation succeeded for the owner's verified account without starting a trial or taking payment. A real Stripe checkout.session.expired event was received, signature-verified, reconciled, and persisted in the production database (evt_1US0HRGHmsvyAdG873T5tH5g); a fresh unpaid checkout was then prepared. This proves real event delivery, not successful payment/renewal. Real-money purchase and app automatic paid-state confirmation still require the owner to complete checkout.

Production smoke checks passed: public routes/config, unauthorized account/admin rejection, origin rejection, webhook signature rejection, indexable marketing pages, canonical/sitemap consistency, and real 404 behavior. 32 billing tests, 13 account tests, typecheck/build, Windows packaged startup/native PTY, both Mac packaged/native PTY checks, 10 website unit tests, and all 21 website browser cases passed (two copy/mobile failures were fixed and their cases rerun). Screenshot evidence is local under artifacts/ and the native Actions artifacts.

MIT declarations remain unchanged. The subscription is for this edition's hosted account access, not a proprietary relicensing. Windows remains unsigned; Mac remains ad-hoc signed without verified notarization. Personal-Mac installation/provider authentication and final legal/tax review are not claimed as completed. The custom first-subscriber Resend outbox has no credential configured. Stripe successful-payment email notifications are enabled in the owner account preferences; these cover payments rather than a custom first-subscription-only email. Core billing does not depend on notification delivery.


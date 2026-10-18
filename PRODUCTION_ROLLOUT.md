# Subscription rollout — prepared, not enabled

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

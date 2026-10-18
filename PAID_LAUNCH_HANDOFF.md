# Paid launch preparation — 2026-10-17

The separate test service is deployed at https://terminal-buddy-billing-test.netlify.app. The public marketing site and existing downloads remain unchanged. This is not a production-ready paid release.

## Automatic status and production preparation — 2026-10-18 UTC

Current instructions are in `PRODUCTION_ROLLOUT.md`; the new internal offer/refund/tax/support draft is `COMMERCIAL_POLICY_DRAFT.md`. Older entries below are historical where superseded here.

- The desktop now reconciles centrally on startup/focus, every five seconds for up to ten minutes after initiating Checkout, and every five minutes otherwise. Requests coalesce across windows. Renderer events update the welcome screen, Settings and account strip. Pending billing shows a blue status panel; verified paid access shows green **Subscription confirmed**. **Check again** is a fallback, not the primary confirmation flow. No URL parameter or UI toggle grants access.
- `scripts/verify-account-automatic-desktop.mjs` passed in real Electron using a disposable profile and signed synthetic loopback records: pending → paid without clicking refresh, focus reconciliation, offline retention, cancellation display and expiry. Screenshots: `artifacts/account-automatic/{trial,pending,paid,cancelling,expired}.png`. These are UI fixture tests, not additional real customer purchases.
- The updated app was opened in a new isolated test profile using the owner's existing sandbox login. It verified the real paid account automatically at startup and displayed Subscription confirmed. No existing terminal was closed. The old installed/public free application is unchanged.
- `billing/verify-hosted-sandbox.mjs --run-test` completed real Stripe-hosted 3DS authentication, a paid checkout and customer-portal scheduled cancellation using a newly created fictional test customer. Successful run `6f61e409-b841-473d-a774-d56c39a7fa55` is retained under ignored `billing/.local/`. Earlier unsuccessful attempts are also retained. Only test-created subscriptions were cleaned up; the owner's subscription was untouched.
- The portal test found `cancel_at_period_end=false` with `cancel_at` exactly equal to the subscription period end. `billing/stripe.mjs` now recognizes that scheduled cancellation while preserving paid-through access. A regression test uses these actual field semantics.
- Corrected-adapter provider run `02bf83b7-0239-4e66-a9d3-200e03203602` passed all three hosted checks, including the app adapter's scheduled-cancellation/paid-through interpretation. Combined with the earlier lifecycle, decline, renewal, signature/order/idempotency tests and owner-operated login/Link checkout, `realStripeSandboxPassed` is now true. This is technical sandbox evidence only; every business/legal/signing approval remains false. Individual test limitations still apply and no live transaction was attempted.
- Latest isolated TEST deployment is `6ad444c07a3a779fde8d04d0`, reported ready by Netlify. The marketing deployment is unchanged.
- The future production adapter is implemented behind `billing/release-config.mjs` (still `liveApproved:false`). It checks exact approved origins, Stripe account readiness, matching test/live resources, and distinct entitlement issuers. The account-independent renderer never receives a payment key. Live-mode unit tests inject synthetic configuration; no live provider operation has been performed.
- `scripts/prepare-commercial-config.mjs` prepares a separate installer identity/profile and public configuration only after recorded approvals and finished policy inputs. It was tested in a disposable checkout for refusal and generation without changing real approval files. `scripts/verify-future-package.mjs --commercial` and the release gate distinguish future commercial artifacts from old free/test files. No license was replaced.
- Type checks/build, 11 account tests, 30 backend tests, one release-preparation test, real Electron free-edition/sign-out/PTY checks, auth/MFA/recovery browser fixtures, and bundle-boundary checks passed. The commercial release gate intentionally remains blocked by unresolved legal identity/policies, signing/dependency review and production configuration.

Remaining owner inputs: exact legal seller/copyright identity; final license/terms/privacy/refund-tax/support decisions; chosen production Stripe/Supabase/Netlify settings and secure credentials; signing/distribution decision. These facts cannot be supplied by a generic authorization to proceed. The technical preparation and policy drafts are ready for review; production activation is not complete.

Latest deployed test revision: `6ad436650b6a64ec0704e13a`, ready. Hosted device initiation returned 200, both direct bypass routes returned 404, owner endpoints returned 401 without authentication, and admin QR CSP includes data images. Netlify reports the 15-minute reconciliation and five-minute alert schedules registered. A bounded test using invalid bodies observed HTTP 429 after the documented edge propagation delay; no device or email was created by those rate probes.

## Completed this follow-up

- Admin directory and recovery APIs require both an allowlisted verified Supabase user ID and AAL2 from cryptographically verified claims. Email verification alone cannot read owner records. First-time owners can enroll TOTP; returning owners use their authenticator. No factor is enrolled automatically, and no bypass/recovery-code override exists.
- New-user and returning-user email code flows remain passwordless. A forgotten password is not relevant; access depends on the email inbox and, for owners, the authenticator. Recovery intake does not transfer accounts or subscriptions.
- A bounded reconciliation function is scheduled every 15 minutes for five oldest-checked billing accounts. Failed accounts rotate without changing cached paid-through dates; successful accounts still update. At this pilot scale, refresh remains the immediate fallback. Monitor duration as account count grows; the scheduler is not proof of instantaneous repair.
- Device initiation has a dedicated Netlify function with a per-IP/domain limit of ten requests per 60 seconds. The catch-all and direct default function URL cannot bypass it. This is platform abuse mitigation, not device fingerprinting. It does not impose this limit on Stripe webhooks. Supabase email quotas/CAPTCHA still need provider-dashboard review.
- Stripe's personal successful-payment email preference was enabled and persisted in the Terminal Buddy sandbox for the owner's Gmail login. It includes renewals. Actual inbox delivery and the future production account preference are not established.

## Real provider evidence

### Owner-operated checkout verification — 2026-10-18 UTC

The primary owner's email and TOTP factor were verified through read-only provider metadata. The secondary owner account still lacked email verification at that check. No factor secret or verification code was read.

The owner completed hosted Stripe Link checkout in the sandbox. A subsequent read-only check confirmed `checkout.status=complete`, `payment_status=paid`, `livemode=false`, an active subscription, no duplicate active subscription, and matching backend/Stripe paid-through values. After the owner selected Refresh status, the isolated desktop observer reported `state=paid`, `configured=true`, `offline=false`. This establishes the owner-operated checkout-to-app path with a manual refresh; it does not establish automatic return/refresh, a live charge, or enforcement in the packaged edition.

The owner's trial was not activated in this flow. Customer-portal cancellation through the browser, action-required/3DS checkout, production alert delivery, and the production installer remain outstanding. Do not set the aggregate sandbox approval flag based on this one successful path. The active owner test subscription has not been canceled or changed by the agent.

After the owner's go-ahead to proceed, `npm run test:account` passed 6 tests and `npm --prefix billing test` passed 26 tests. The commercial release gate still fails: legal/policy and signing/dependency approvals are unresolved, the edition is free/test, and the implementation rejects live Stripe mode. The gate was run without production credentials; its missing-environment messages describe that local invocation, not a provider outage or proof that hosted test variables are absent. Production preparation is authorized; no specific missing legal terms or rights-holder identity can be inferred from that authorization.

`billing/verify-stripe-sandbox.mjs --run-test` creates new fictional Stripe TEST customers on test clocks and refuses live keys. Completed run `f0c710c9-babf-4f7b-8ae0-a570d58346ce` demonstrated: idempotent no-card trial and expiry; real hosted Checkout creation/retry reuse; successful API test payment; paid-invoice access; duplicate purchase prevention; real portal session/configuration; actual Stripe-originated webhook updating the hosted test database; renewal; cancellation through paid-through; expiry; and a declined first payment. Seven processed event IDs were independently retrieved from Stripe and verified. No locally forged webhook payload was used for this provider evidence.

`billing/verify-stripe-failure.mjs --run-test` run `cbfd5c36-9ee4-4be4-8024-e6d7dc859687` confirmed a real TEST failed renewal, unchanged paid-through, and the proposed three-day grace boundary. These simulations use API test PaymentMethods, not a completed user-operated hosted Checkout. The test-created subscriptions were canceled; evidence customers/clocks and clearly fictional hosted account records remain in the test environment. No owner's subscription or trial was reset.

Reports are in ignored `billing/.local/stripe-lifecycle-*.json` and `stripe-failure-*.json`. Credentials are not in these reports. Do not copy the whole `.local` directory: it also holds secrets. The first lifecycle attempt passed renewal/cancellation but failed because the decline fixture could not be attached; the corrected attachable decline fixture passed on the later run. Keep the failed evidence as well.

## Repeatable checks

From this worktree:

```powershell
npm run typecheck
npm run test:account
npm --prefix billing test
npm run build
node scripts/verify-account-desktop.mjs
cd billing
npm run build
node verify-admin-mfa.mjs
node verify-recovery.mjs
node verify-auth-page.mjs
node verify-deployment.mjs
# verify-owner additionally needs the loopback fixture server on port 4318.
node verify-owner.mjs
# Explicit external TEST mutations, with approved test credentials loaded:
node --env-file=.env verify-stripe-sandbox.mjs --run-test
node --env-file=.env verify-stripe-failure.mjs --run-test
```

Browser fixtures verify enrollment, returning MFA, invalid codes, no pre-MFA records, clearing secrets and sign-out, with 390/768/1440 screenshots in `artifacts/admin-mfa-screenshots/`. Their QR code is deliberately synthetic. Visual review caught and fixed double encoding caused by auth-js's data-URL prefix; tests now assert the image actually decodes. These are not evidence that a real owner has enrolled MFA. Account/regression tests verify bounded offline access, clock changes and sign-out preserving a real running PTY in a disposable profile.

## Package status

Fresh local Windows x64 installer and portable binaries are in this worktree's `release/`, version 0.2.0-beta.1. They retain the MIT notices, contain fifteen runtime-package notices and Chromium notices, and remain the free/test edition with enforcement off. They are **not** an account-connected commercial installer. Authenticode inspection reports NotSigned. No package was installed over the existing app, uploaded, or connected to an updater feed.

`node scripts/verify-future-package.mjs` extracts both payloads without installing, compares notices/app bytes, checks package and PE versions, scans obvious secret patterns and writes fresh sizes/hashes/provenance to `release/future-test-manifest.json`. Only that generated manifest describes the current artifact hashes. A dirty source build is explicitly marked dirty; it cannot pass the commercial gate. External NSIS plugin notices/conditions still require review.

## Exact owner steps before publication

1. Primary-owner authenticator enrollment is verified. Complete email verification and authenticator enrollment for the second owner if that account will be used: https://terminal-buddy-billing-test.netlify.app/admin/. Store an authenticator backup securely. Never paste codes or setup keys in chat. Real enrollment is user-operated.
2. Hosted test Checkout → app Refresh → paid access is verified above. Finish customer-portal cancellation and action-required/3DS testing, and the user-operated no-card trial journey in a separate test account. Use Stripe's test details only. API tests do not replace the remaining customer journey. `realStripeSandboxPassed` remains false until the full required suite is evidenced.
3. Supply the exact legal owner/copyright text and approved future licensing/terms. Prior MIT copies retain their terms. Decide whether to retain MIT for future source and charge for the account service, or supply a separately reviewed license for code you have authority to license. No proprietary terms or ownership assumptions have been applied.
4. Approve privacy/retention, a private support route and account-recovery proof/escalation policy; refund/tax/dispute treatment; seven-day bounded offline allowance and three-day failed-renewal grace (currently proposals). Existing draft: `PRIVACY_BILLING_DRAFT.md`. Review imported code/assets, the unlocated Terminal repository, and installer plugin obligations in `LICENSE_TRANSITION.md`.
5. Review Supabase email quotas, OTP expiry, CAPTCHA and SMTP bounce handling; establish backup/restore and production monitoring. No new security settings or provider account credentials were silently changed.
6. Approve signing/distribution and the exact production infrastructure/account. Configure a separate production database/origin/secrets, owner IDs and a live $6 USD monthly Price with its own portal/webhook. Do not copy the test database or entitlement key into production. The current implementation deliberately refuses live keys and events; a reviewed production-mode change is still required. Supplying a live key alone will not turn it on.
7. After the above, authorize the specific main push, production deployment and opt-in commercial installer. Use separate application/profile identity and a new release channel so the historical free release is never silently made time-limited. Verify production download hashes, actual signing state, live email preference and monitoring before announcing paid access.

No license approvals, production authorization or completion flags were fabricated. No main push, live charge, paid public release, DNS change or website redesign was performed in this follow-up.

References: https://supabase.com/docs/guides/auth/auth-mfa/totp ; https://supabase.com/docs/reference/javascript/auth-getclaims ; https://docs.stripe.com/billing/testing ; https://docs.stripe.com/automated-testing ; https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/ ; https://docs.netlify.com/build/functions/scheduled-functions/

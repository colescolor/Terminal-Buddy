# Paid launch preparation — 2026-10-17

The separate test service is deployed at https://terminal-buddy-billing-test.netlify.app. The public marketing site and existing downloads remain unchanged. This is not a production-ready paid release.

Latest deployed test revision: `6ad436650b6a64ec0704e13a`, ready. Hosted device initiation returned 200, both direct bypass routes returned 404, owner endpoints returned 401 without authentication, and admin QR CSP includes data images. Netlify reports the 15-minute reconciliation and five-minute alert schedules registered. A bounded test using invalid bodies observed HTTP 429 after the documented edge propagation delay; no device or email was created by those rate probes.

## Completed this follow-up

- Admin directory and recovery APIs require both an allowlisted verified Supabase user ID and AAL2 from cryptographically verified claims. Email verification alone cannot read owner records. First-time owners can enroll TOTP; returning owners use their authenticator. No factor is enrolled automatically, and no bypass/recovery-code override exists.
- New-user and returning-user email code flows remain passwordless. A forgotten password is not relevant; access depends on the email inbox and, for owners, the authenticator. Recovery intake does not transfer accounts or subscriptions.
- A bounded reconciliation function is scheduled every 15 minutes for five oldest-checked billing accounts. Failed accounts rotate without changing cached paid-through dates; successful accounts still update. At this pilot scale, refresh remains the immediate fallback. Monitor duration as account count grows; the scheduler is not proof of instantaneous repair.
- Device initiation has a dedicated Netlify function with a per-IP/domain limit of ten requests per 60 seconds. The catch-all and direct default function URL cannot bypass it. This is platform abuse mitigation, not device fingerprinting. It does not impose this limit on Stripe webhooks. Supabase email quotas/CAPTCHA still need provider-dashboard review.
- Stripe's personal successful-payment email preference was enabled and persisted in the Terminal Buddy sandbox for the owner's Gmail login. It includes renewals. Actual inbox delivery and the future production account preference are not established.

## Real provider evidence

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

1. Open https://terminal-buddy-billing-test.netlify.app/admin/, reload, sign in with an approved owner email, choose **Set up authenticator**, scan privately, and enter its code. Repeat for the second owner account after its email is verified. Store an authenticator backup securely. Never paste codes or setup keys in chat. Real enrollment is user-operated.
2. Complete the interactive app → email code → trial → hosted test Checkout → app Refresh → customer portal cancellation sequence. Use Stripe's test card only. API purchase and cancellation tests do not replace this customer journey, 3DS/action-required testing, or real MFA verification. `realStripeSandboxPassed` remains false until the full required suite is evidenced.
3. Supply the exact legal owner/copyright text and approved future licensing/terms. Prior MIT copies retain their terms. Decide whether to retain MIT for future source and charge for the account service, or supply a separately reviewed license for code you have authority to license. No proprietary terms or ownership assumptions have been applied.
4. Approve privacy/retention, a private support route and account-recovery proof/escalation policy; refund/tax/dispute treatment; seven-day bounded offline allowance and three-day failed-renewal grace (currently proposals). Existing draft: `PRIVACY_BILLING_DRAFT.md`. Review imported code/assets, the unlocated Terminal repository, and installer plugin obligations in `LICENSE_TRANSITION.md`.
5. Review Supabase email quotas, OTP expiry, CAPTCHA and SMTP bounce handling; establish backup/restore and production monitoring. No new security settings or provider account credentials were silently changed.
6. Approve signing/distribution and the exact production infrastructure/account. Configure a separate production database/origin/secrets, owner IDs and a live $6 USD monthly Price with its own portal/webhook. Do not copy the test database or entitlement key into production. The current implementation deliberately refuses live keys and events; a reviewed production-mode change is still required. Supplying a live key alone will not turn it on.
7. After the above, authorize the specific main push, production deployment and opt-in commercial installer. Use separate application/profile identity and a new release channel so the historical free release is never silently made time-limited. Verify production download hashes, actual signing state, live email preference and monitoring before announcing paid access.

No license approvals, production authorization or completion flags were fabricated. No main push, live charge, paid public release, DNS change or website redesign was performed in this follow-up.

References: https://supabase.com/docs/guides/auth/auth-mfa/totp ; https://supabase.com/docs/reference/javascript/auth-getclaims ; https://docs.stripe.com/billing/testing ; https://docs.stripe.com/automated-testing ; https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/ ; https://docs.netlify.com/build/functions/scheduled-functions/

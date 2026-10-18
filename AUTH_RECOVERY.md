# Authentication and recovery operations

Updated 2026-10-17. This is implementation documentation for the separate TEST billing service, not a published promise of account restoration. No passwords are used. No account or subscription transfer endpoint was added.

Hosted verification: test deploy `6ad4313acb51b83d67a05270` is ready. Account/admin/recovery pages returned 200; all five recovery/revocation endpoints returned 401 without authentication and cross-origin requests returned 403. Hosted recovery JavaScript loaded without exceptions or horizontal overflow at 390/768/1440px. No OTP or real recovery request was sent by these checks. Source is kept on the development branch; this follow-up does not authorize a new main push or installer release.

## Implemented paths

- `/account/`: email code sign-in, explicit resend with a 60-second client cooldown, email correction, duplicate-submit prevention and expired-code guidance. Codes verify the address to which they were sent rather than an editable field. Provider-side rate limits remain authoritative.
- A device handoff is checked before sending each code; expired/used requests point back to Login in the app. The existing random state/challenge, five-minute expiry and one-use exchange remain.
- After standalone browser verification, Sign out all devices revokes that account's desktop sessions and pending approved device flows. It does not kill terminals, delete work, cancel subscriptions, or reset trials. Offline cached access remains bounded by its original expiry; revocation is learned on the next online refresh.
- Desktop refresh distinguishes HTTP 401 from outages. A revoked/expired login clears its cached login and offers sign-in. A 503/timeout does not pretend a subscription was canceled. An unknown account state still offers refresh/sign-out.
- `/recovery/`: verifies a reachable contact email with Supabase, accepts the claimed original email and a short explanation, and shows only that verified requester's requests/replies. No lookup reveals whether the claimed account exists. No upload or public issue is required. One open request per verified requester; three new requests per 24 hours. New email accounts can evade this limit, so provider anti-abuse controls still matter.
- `/admin/`: only the explicitly configured Supabase IDs can list recovery requests and save private replies with review/closed status. Concurrent updates use a revision check. Closing a request is not restoration. Applicant content is untrusted and rendered as text.

## What manual review means

The reachable email is a contact channel, not proof of ownership of the original account. Do not transfer an account because someone knows its email, has an invoice screenshot, or writes a convincing explanation. Do not request passwords, OTPs, full card numbers, provider credentials, identity documents or customer project data in the recovery form. The software deliberately cannot change login emails, subscription ownership or admin IDs from a recovery request.

Before enabling actual restoration, the owner must approve an identity-proof policy and an auditable operator procedure. Prefer recovery through the original email provider where possible. A stronger future self-service option is a recovery secret enrolled while the user still has verified access; none has been silently generated or enrolled here. Lost admin access needs separately verified owner handling, never customer recovery automation. Two approved owner accounts reduce dependence on one inbox, but are not MFA.

Requesters must revisit `/recovery/` and sign in to see a reply. Recovery notifications are not configured; subscription-alert email configuration does not notify recovery requests. Review the dashboard regularly. Request retention/deletion, response expectations, private support and escalation policy remain owner decisions. Do not promise an SLA or guaranteed recovery.

## Schema and deployment

`billing/migrations/002_recovery.sql` adds only `recovery_requests`, its one-open-request index and RLS. `migrate` removes Supabase browser-role grants. On the existing test database, the restricted backend role has SELECT/INSERT/UPDATE and a role-specific RLS policy. It has no public, anon or authenticated access. No auth.users rows, billing mappings or existing user records are edited by this migration.

For another approved database, run `node --env-file=.env migrate.mjs` from billing using the migration administrator. Grant SELECT/INSERT/UPDATE on public.recovery_requests to the dedicated backend role and create its role-specific policy, as for the existing billing tables. Keep the administrator connection out of Netlify. Build and deploy only the billing directory to its separate project; never copy `.local` or secrets into the site. `check-setup.mjs --online` now requires the fifth table and RLS.

## Evidence and remaining gaps

Code inspection: server-verified Supabase users; exact UUID admin allowlist; no browser-persisted auth tokens; no trust in browser flags or Checkout return pages; durable desktop tokens expire in 30 days; safeStorage protects local tokens where available. Admin MFA is not enforced. Supabase logout alone does not revoke the independent desktop tokens; the new explicit device-revocation action does.

Observed provider flags: email sign-in enabled, signup allowed, email autoconfirm false. The public settings endpoint does not expose current OTP lifetime, email/IP quotas or CAPTCHA configuration. Inspect these in the actual Supabase dashboard before production; a client cooldown is not a security rate limit. Device-start currently has a global pending-flow cap, not a durable per-source rate limit. No mass requests were made to test quotas.

Tests: automated database/HTTP authorization, cross-account isolation, replay, revision conflicts, payload limits, private replies and rate limits; mocked-browser real-SDK flows, no HTML injection, no token persistence and 390/768/1440 layouts. Electron free-edition sign-out preserved a running PTY. Separate desktop tests cover 401 versus 503 and stale refresh after sign-out. Real end-to-end recovery with user-entered email codes and real ownership restoration have not been performed. No test OTP was read from a user's inbox.

Remaining before paid launch: approve recovery proof/retention/support policy; add and test admin MFA; review provider quotas/CAPTCHA, SMTP bounce handling and recovery email notifications; complete actual Stripe purchase/portal/webhook/cancellation tests and existing licensing/privacy/payment gates. No live payments, new installer or public commercial release is enabled by this change.

## Repeatable checks

From the worktree root: `npm run typecheck`, `npm run build`, `npm run test:account`, `node --test scripts/verify-account-session.mjs`, `node scripts/verify-account-desktop.mjs`.

From billing: `npm test`, `npm run build`, `node verify-deployment.mjs`, `node verify-auth-page.mjs`, `node verify-recovery.mjs`. `node verify-owner.mjs` additionally expects the local fixture server (`npm run dev`, port 4318). Screenshots: `artifacts/recovery-screenshots/`. No real email or payment is sent by these browser tests.

References: https://supabase.com/docs/guides/auth/auth-email-passwordless, https://supabase.com/docs/guides/auth/rate-limits, https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

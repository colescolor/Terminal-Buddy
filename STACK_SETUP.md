# Terminal Buddy account stack: connection checklist

The owner selected Netlify + Supabase + Stripe + Resend on 2026-10-17. This authorizes local implementation; no new provider accounts, paid plan purchases, DNS records, public deployment, live Stripe setup or main push were performed. This branch stays TEST-only and retains all prior license/release boundaries.

## What is ready locally

- Customer account page and desktop handoff, no-card trial, server-side Stripe test integration.
- Read-only owner page at /admin/ on the future billing service. Actual customer data is fetched only after server verification of an allowlisted Supabase user UUID. An empty owner list denies access. No privileged browser key, editable subscription flag, or public customer directory exists.
- Local owner preview: http://127.0.0.1:4318/owner-preview/ (fictional records, no providers). Customer state preview remains http://127.0.0.1:4318/.
- Owner directory: email search, state filters, pagination, trial/paid-through dates, last Stripe synchronization timestamp and Stripe test dashboard links. Four totals count connected accounts, current trials, paid access (including scheduled cancellation, excluding grace), and expired access. These are not revenue/MAU/download statistics. Accounts appear after app approval, not merely after creating a Supabase identity.
- Production browser/function bundles exclude the local fixture server and sample data. No desktop source or existing marketing/demo files changed in this follow-up.
- Browser builds preserve full license/notice text for nine actual bundled packages in public/THIRD_PARTY_LICENSES.txt, linked from account and owner pages. This does not change the app's or website's license.

## 1. Supabase TEST project

Use an owner-approved Supabase project dedicated to Terminal Buddy test data. Do not reuse a client database. The project provides both email authentication and Postgres. Obtain its HTTPS project URL and publishable (or legacy anon) key. Never put a service-role key into SUPABASE_PUBLISHABLE_KEY.

Use the project's documented TLS database/pooler connection string for DATABASE_URL. Configure an appropriately privileged server role; billing tables must not be accessible to anon/authenticated browser roles. RLS is enabled without public policies. Do not disable certificate verification to fix a connection error.

After approving the target test database, apply billing/migrations/001_accounts.sql using `node --env-file=.env migrate.mjs` from billing/. The migration is idempotent and is for a new billing database. Back up/review any existing schema before applying it elsewhere. No chats or local app databases are migrated.

Enable email authentication and confirmation. Configure Site URL and permitted redirect URLs for the actual approved HTTPS billing origin. The app uses a typed email code; browser session tokens stay in memory.

## 2. Resend and verified sending domain

Use an approved Resend account and a verified domain/subdomain you own. Add only the exact verification records Resend issues, after DNS authorization. Preserve existing email and website DNS records. No domain, sender mailbox, or verification token is invented here.

In Supabase Authentication's custom SMTP settings enter:

- Host: smtp.resend.com
- Port: 465 (implicit TLS)
- Username: resend
- Password: a Resend API key authorized for the approved sending domain
- Sender name: Terminal Buddy
- Sender email: an owner-approved address on that verified domain

The Resend credential lives in Supabase SMTP settings. It does not belong in the desktop, marketing site, Netlify browser bundle, or Git. There is no extra Resend SDK/API server to maintain.

Use billing/emails/sign-in.html for both the signup-confirmation and magic-link/OTP email templates as applicable to the configured Supabase email flow. Subject: Your Terminal Buddy sign-in code. Keep the exact `{{ .Token }}` provider placeholder. Test first-time signup and returning login separately. Set an approved code expiry, resend limits and email-abuse controls; align Supabase sending limits with the Resend plan. Disable marketing/link tracking for sign-in emails. Complete real delivery/spam-folder checks to owner-controlled recipients before launch.

References: https://supabase.com/docs/guides/auth/auth-smtp and https://resend.com/docs/send-with-smtp

## 3. Stripe sandbox

Use a Stripe sandbox/test environment. Create one test product and one active recurring USD 6.00/month Price with quantity 1 and interval count 1. Configure the test customer portal for payment methods, invoices and cancellation at period end; no plan changes, coupons or extra products are required. Obtain the test secret key and Price ID. Never use a live key; code rejects it.

After an approved staging deployment exists, register its actual /api/webhook endpoint in the same sandbox, using the event list in BILLING_SETUP.md. Store that endpoint's signing secret as STRIPE_WEBHOOK_SECRET. Test the raw-body signature through the deployed Netlify route. A local Stripe CLI listener and deployed endpoint have different secrets; use the matching one.

The backend creates no Stripe subscription at trial activation. App Subscribe requires recurring-charge acceptance and creates Checkout with the fixed server-controlled Price. Customers use Stripe's portal; the owner uses Stripe's own dashboard for invoices/refunds/subscription changes. The new owner page cannot mutate them.

## 4. Keys and server configuration

From billing/, `npm run keygen` writes an Ed25519 pair to ignored .local/ files without printing the private key. It refuses to overwrite existing files. Windows ACLs are inherited from the local user directory; restrict access and place the private key in the approved secret manager. This is not a production key-rotation service. Only the public key belongs in a future approved desktop edition.

Copy .env.example to untracked .env for local provider checks, or enter values in the approved Netlify project's environment settings. Do not paste secrets into chat. BILLING_ORIGIN is the actual assigned HTTPS staging origin or an approved hostname, never localhost or an invented address. The customer/account test integration is disabled in the ordinary free desktop package.

Required server configuration: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_MONTHLY_PRICE_ID, DATABASE_URL, ENTITLEMENT_PRIVATE_KEY. SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are deliberately public configuration. BILLING_ORIGIN and proposed OFFLINE_DAYS/PAST_DUE_GRACE_DAYS are also configuration, not credentials. OWNER_USER_IDS is server-only authorization configuration.

## 5. Netlify billing project

Keep the marketing site and its existing project untouched. After explicit staging/push authorization, use a separate Netlify billing project pointing to the approved app source branch, with base directory billing, its billing/netlify.toml, Node 22, command `npm ci && npm run check:setup && npm run build`, output public, functions functions. No permanent Node server or second database is needed. Do not connect main to production as a side effect.

Environment variables needed by the setup check must be available to Builds; runtime variables also need Functions scope. Netlify secret storage, access and logging settings require review. The check prints names/errors, never values. SUPABASE_URL is used at build time for CSP, so rebuild after changing its origin. Disable automatic production publication until review. Keep account/admin pages noindex, no-store and same-origin; noindex is not access control.

Checks from billing/ after approved test configuration:

```powershell
node --env-file=.env check-setup.mjs
node --env-file=.env check-setup.mjs --online
npm run build
node verify-deployment.mjs
```

The --online mode only retrieves the configured Stripe Price and reads/checks the database schema/RLS. It creates no users, products, Checkout sessions, emails or charges. It does not prove SMTP delivery, webhook delivery or auth correctness. Missing configuration currently blocks deployment as intended.

## 6. Activate owner access

OWNER_USER_IDS may be blank during initial account-service bootstrap; all owner data requests then fail closed. Complete ordinary email verification and app approval with the owner's account. Copy the exact resulting user UUID from Supabase Authentication → Users into Netlify's server OWNER_USER_IDS setting. Multiple approved owners can be comma-separated. Email text, user-editable metadata and desktop session tokens cannot grant owner access.

Reload/redeploy the billing function as required by the environment change, then visit /admin/ at the actual billing origin and request an email code. The owner sign-in uses `shouldCreateUser: false`; it does not create arbitrary admin accounts. `node --env-file=.env check-setup.mjs --require-owner` checks that the allowlist is configured. Test a normal customer account and an unsigned request: neither must return account records. Use MFA for provider administration; an additional app-level owner MFA policy is a future decision.

## Operation and remaining evidence

Webhook processing and customer Refresh reconcile Stripe into the database. `node --env-file=.env reconcile.mjs` performs an operator reconciliation. No cloud schedule is configured yet. Before launch choose and test an approved bounded reconciliation schedule; Netlify scheduled functions have a 30-second execution limit, so do not blindly run the unbounded full-account CLI inside one. Large account counts also require evaluating Stripe history pagination/query costs. Dashboard Refresh only reads stored records and displays their last-sync date.

Validate real emailed signup/sign-in, app connection, one-time trial across installations, explicit Stripe test purchase/decline/3DS, delayed/duplicate webhooks, cancellation and reconciliation. Use test cards and no live charges. Local fixtures and browser-intercept tests are not evidence of hosted provider success.

Still needed from owner: existing account/project identifiers, chosen billing origin, permission for exact staging resources/usage/push/deployment, approved sender/DNS changes, verified owner UUID, secure test credentials, and the prior license/copyright/privacy/refund/tax/support/offline/grace/signing decisions. Do not publish a paid edition or replace old free releases until those gates are satisfied.

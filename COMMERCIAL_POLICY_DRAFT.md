# Terminal Buddy subscription policy draft — NOT FOR PUBLICATION

Prepared for the next opt-in release. This is a review draft, not accepted customer terms or a legal determination. The legal operator, jurisdiction, contact details and approved license have not been supplied. No existing license or prior release is changed by this document.

## Proposed customer-facing offer

Terminal Buddy organizes your local coding-agent workspace. Claude Code, Codex and other provider accounts, subscriptions and usage are separate.

Create and verify a Terminal Buddy account, then select **Start free trial** to activate 14 days of full application access. No payment card is required and trial activation does not create a Stripe subscription. Signing in and starting a trial require an internet connection. Reinstalling the application does not restart that account's trial.

If you choose to subscribe, the individual plan is **USD $6 per month**, charged immediately and renewed monthly until canceled. Purchasing during a trial starts billing immediately; remaining trial days do not delay the first charge. If you do not subscribe, the trial expires without a charge. There is no annual or team plan.

Use **Manage billing** to view invoices, update your payment method or cancel renewal through Stripe's hosted portal. Canceling renewal normally leaves access available through the paid-through date. Payment confirmation comes from the billing service; a browser success page alone does not activate access.

The proposed offline allowance is at most seven days since successful verification, bounded by the trial or paid-through date. The proposed failed-renewal grace period is three days after the last paid-through date. An outage does not itself mean cancellation. These values must be approved and match production configuration.

After access expires, new paid-workspace actions are restricted. Open terminals remain operable until you close them. Terminal Buddy does not delete, encrypt, hide or upload your projects or chat history to enforce access. Account, billing, support and retrieval of existing work remain available.

Historical free releases retain the terms distributed with them. The subscription edition is an explicit, separate installation; it does not silently convert an existing free copy into a trial.

## Decisions the owner must supply before these words become terms

- **Operator and contact:** exact legal individual/entity name, required business address/contact, and the appropriate governing jurisdiction. Do not substitute a product name for the legal operator.
- **License:** choose the future application's license scope after checking contributor/imported-code rights. Retaining MIT for code while charging for a hosted service is a distinct option from proposing a commercial code license. This draft chooses neither. Preserve third-party and historical MIT grants.
- **Refunds:** proposed starting point for review: a first-charge refund request window of 14 days, handled manually through a private support route, with any mandatory consumer rights preserved. Do not advertise this until approved; no automated refund endpoint exists. Decide renewal refunds, duplicate charges and dispute handling explicitly.
- **Tax:** confirm seller location, customer regions and registration/collection obligations with an appropriate adviser. Decide whether the advertised $6 includes applicable tax, whether Stripe Tax is used and its cost, and configure Checkout accordingly. No tax registration or paid tax service is enabled here.
- **Support:** approve a monitored private contact/recovery route, response expectations and escalation. A public issue tracker is appropriate for nonsensitive bugs, not payment details or identity evidence. Recovery submissions currently require verified contact and manual review; they never automatically transfer access.
- **Privacy/retention:** finalize PRIVACY_BILLING_DRAFT.md with the actual operator/contact, lawful purposes where applicable, data-retention periods, deletion process, processor regions and backup policy. Do not promise immediate deletion of legally required payment records.
- **Renewal notices and changes:** approve required notices, price-change policy and customer acceptance language for the markets served. No unilateral retroactive rights changes are drafted here.
- **Distribution:** approve signing status, supported platforms, installer dependency notices and final install/uninstall text. Unsigned is not signed or trusted. Do not tell users to disable security protections.

## Operational proposals for approval

Keep support data limited to what is necessary. Verify an authenticated account and relevant provider evidence before billing/account changes; never ask for passwords, OTPs, card numbers or agent credentials in tickets. Recovery alone must not establish ownership. Keep a minimal action audit trail and require MFA for owner access. Define a second recovery-capable owner without bypassing MFA.

Use separate production credentials, database and entitlement signing key. Verify backups by restoring to an isolated environment. Monitor webhook delivery failures, reconciliation lag, email failures and pending alert retries without storing full billing payloads or authentication material. No paid monitoring service has been purchased.

References reviewed: [MIT license](https://opensource.org/license/mit), [Stripe customer portal](https://docs.stripe.com/customer-management), [Stripe environment/key separation](https://docs.stripe.com/keys). These establish implementation facts, not the operator's legal obligations or rights ownership.

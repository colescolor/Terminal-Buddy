# Terminal Buddy — concrete launch decisions

Superseded for the current launch: the owner again directed the full rollout to proceed. The subscription service is being launched with existing software licensing preserved and factual customer disclosures based on the agreed offer. No future proprietary license, invented refund guarantee or new copyright holder is applied. See SUBSCRIPTION_RELEASE.md for current facts; the earlier decision list below is retained as history and must not be treated as another general deployment-approval request.

Prepared October 18, 2026. This is an internal review document, not published terms or an approval record. Infrastructure launch permission is already granted. Do not ask for that permission again.

## Customer offer to approve

Seller: Eric Colton Newman. Individual plan: USD $6 per month. The first payment occurs when the customer explicitly subscribes, including during a trial. Renewal is monthly until canceled through Stripe's customer portal. Cancellation preserves access through the paid-through date. Claude/Codex accounts and usage are separate.

The verified account gets one 14-day trial after explicitly selecting Start free trial. No card, subscription or charge is created by trial activation. Reinstallation does not reset the account's trial. Signing in and activating require internet access.

Proposed operating policies: up to seven days offline after a successful verification, never extending the verified access date; three days of grace after a failed renewal; first-payment refund requests accepted within 14 days, with renewals reviewed individually and mandatory consumer rights preserved. Refunds are handled manually in Stripe. No automatic Stripe Tax service is configured, and this setup does not determine the seller's tax obligations.

Expiry restricts new workspace launches. It does not close running terminals, remove files, or change provider accounts. Existing free installations remain separate and retain their distributed terms.

## Decisions that are still actual owner inputs

1. **Future software license:** the owner requested commercial licensing, but no final commercial license text has been supplied or approved. All current application code still carries MIT declarations, including previously public billing code. An access check does not revoke that grant. Supply/approve the future license, or explicitly choose to keep the existing software license while charging for the account service. These are different choices; launch authorization alone is not permission to invent a proprietary EULA.
2. **Copyright metadata:** confirm the exact text for the future original work. The seller's supplied name is Eric Colton Newman; that is not a claim that he owns every dependency or contribution. Preserve existing copyright and license notices. The current `copyright: MIT` field is incorrect and remains unchanged pending this input.
3. **Customer policies:** approve or amend the operating policies above and the factual data-flow draft in PRIVACY_BILLING_DRAFT.md. The public /contact/ page currently lists cole@terminalbuddy.to; confirm this inbox is monitored for billing, privacy and refund requests. Specify retention/deletion handling and any required seller contact information. Do not publish a guarantee of immediate deletion or tax compliance.
4. **Distribution:** Windows has no verified publisher signature and the Mac candidates have only ad-hoc signing, without Apple notarization. Do not describe either as signed by a verified publisher. Commercial Mac artifacts still need their own native build and verification after production configuration is approved.

## Engineering work versus owner decisions

The production Stripe account/price/portal and isolated database are configured. Production Netlify variables were stored and verified. The billing site has no published deployment and no configured production webhook secret. Creating the webhook, deploying the backend, packaging the opted-in application, verifying its login/payment flow, and updating the website are engineering work, not reasons to ask for a second general launch authorization.

The public site was checked on October 18: /download/, /privacy/ and /contact/ returned 200. The latest marketing deployment is `6ad50ecb75e4cdf7d88d0861`. Its free-download links and existing privacy page have not been changed by this launch preparation.

No live purchase, subscription, customer record, installer publication or production billing deployment has been performed as part of this review.

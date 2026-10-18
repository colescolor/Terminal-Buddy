# Subscription beta 0.2.0-beta.2

This is an explicit opt-in release with app ID `com.terminalbuddy.subscription`, application name Terminal Buddy Subscription, and profile `terminal-buddy-subscription`. It does not replace the free release's application identity, updater feed, binaries, tags, notices or profile.

The owner repeatedly authorized production launch, most recently on October 18. This release preserves the existing MIT application license and every third-party license. The hosted account service implements the agreed 14-day trial and USD $6/month subscription. A future proprietary license is not part of this rollout; the earlier proprietary-license approval checklist does not describe this unchanged-license release. No copyright holder is invented: the subscription package metadata copies the notice already in LICENSE.

## Production service

- Origin: https://terminal-buddy-billing.netlify.app
- Account: /account/; owner dashboard: /admin/; private recovery: /recovery/
- Customer disclosures: /terms/ and /privacy/, sourced from billing/policies/
- Verified Netlify deployment: `6ad51fba444096cadf6b8399`
- Stripe live destination: `we_1URznQGHmsvyAdG8xqYYb7eq`, 12 snapshot events from billing/webhook-events.mjs, API 2026-09-30.endive
- Supabase: existing project, isolated terminal_buddy_live schema and restricted runtime role
- All 16 production variables were saved and read back. Secrets remain in ignored local files and the authorized Netlify environment; no database-admin password is deployed.

Public route checks passed for account, owner, recovery and policies. Unauthenticated account/admin API requests returned 401; an invalid webhook signature returned 400; foreign-origin calls returned 403; a missing page returned 404. A locally signed, unsupported webhook probe returned ignored without writing account data. That probe is not evidence of an actual Stripe delivery or purchase.

## Build

From this checkout, run `npm ci`, `npm ci --prefix billing`, `npm run typecheck`, `npm run test:account`, and `npm run build`.

Windows: `node node_modules/electron-builder/cli.js --config electron-builder.commercial.yml --win zip --x64 --publish never`.

Mac, on the relevant native runner: `node node_modules/electron-builder/cli.js --config electron-builder.commercial.yml --mac dmg zip --arm64 --config.mac.identity=- --config.mac.hardenedRuntime=false --publish never` (use --x64 for Intel). The Subscription beta packages workflow performs native builds and tests without publishing artifacts automatically.

Validate with `node scripts/verify-subscription-package.mjs --arch=x64` (or arm64 on that Mac runner). Set BUDDY_EXE to the separate packaged subscription executable, then run `node scripts/verify-subscription-desktop.mjs`. This test uses a disposable profile and verifies the signed-out access gate, context isolation, license viewer and actual native PTY module. It does not sign in or charge anyone.

Windows is distributed as a portable ZIP: extract the complete folder, then run Terminal Buddy Subscription.exe. This avoids shipping the unresolved external NSIS plugins in this beta; old NSIS installers remain untouched. Uninstall by closing the subscription app and removing its extracted folder. Account cancellation is separate, through Manage billing. Mac artifacts are ad-hoc signed, not Developer ID signed or verified notarized. Do not advise disabling operating-system security protections.

The package verifier records hashes, sizes, actual signing status, version and source commit, and rejects stale code, missing notices and secret patterns. A dirty-source manifest must not be published. The ordinary builder config refuses to package subscription enforcement under the historical free app ID.

## Remaining evidence

Real live purchase, signed-in production desktop access, refund handling and owner inbox delivery must be recorded separately when exercised. Existing real Stripe sandbox tests do not prove live payment success. No new tax, monitoring, signing or email subscription has been purchased. Account privacy states actual data flows and a contact route; it does not promise tax compliance, immediate deletion or a new software license.

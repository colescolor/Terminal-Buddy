# Future license transition — owner/legal approval required

This is a local implementation for 0.2.0-beta.1. Billing does not change any license. The application LICENSE and MIT package declaration remain intact; copyright: MIT remains unresolved, not silently corrected.

## Verified baseline and scope
Application checkout: C:\Users\Owner\Desktop\code-projects\Personal\Terminal Buddy.
Website checkout: website/artifacts/github-source beneath that application root.
This work lives in website/artifacts/paid-release-worktree on development/paid-release-local, copied from the current working application state so existing uncommitted fixes remain intact in the original checkout.

The application's LICENSE says “Copyright (c) 2026 Terminal Buddy contributors” and contains MIT. package.json declares author Terminal Buddy contributors and license MIT. README has an MIT License section, plus an uncommitted free-to-use statement. electron-builder.yml has copyright: MIT; this is not an adequate owner identification. Initial commit f22094a9 (2026-09-04) introduced these declarations. This history is not proof of informed owner approval or contributor ownership.

The separate website repository has its own root LICENSE, public/LICENSE.txt, and demo/product/LICENSE with the same notice. Its package.json has no license field; private: true is an npm publication safeguard, not licensing. Initial website commit b502cb4 (2026-10-13) added the license and MIT marketing claims. Exported app components retained the notice at be66eac (2026-10-16). The website remains unchanged in this task.

A separate repository called Terminal was not located. Do not assume it is xterm.js or infer that its license applies to the app. Obtain its exact URL/path and inspect imported code/assets before final terms.

## Previously distributed copies
Preserve v0.1.18 binaries, tag, source history, LICENSE.txt, release description/notes, SHA256SUMS and manifest. The public Windows installer and portable file contain app.asar/LICENSE and app.asar/package.json with MIT. Their public hashes remain:
- Setup: 58e28b26aa8ed5dd901f2b92aef21edf019e401463e5a390b4c6e97ff8cb74b0
- Portable: b6989fa65eca4f985b3f9dd91474aa37b5bf51931ecd3c23809ae04644f3eeb7

Public release: https://github.com/colescolor/Terminal-Buddy/releases/tag/v0.1.18
The tag's source declares 0.1.17 while the binaries declare 0.1.18. Do not move that tag. Future artifacts need their own matching source commit and manifest.
Other existing copies retain whatever terms accompanied them; this work makes no revocation or retroactive licensing claim.

## Files requiring an explicit future decision
Only after approved terms and authority are supplied:
- Application LICENSE: the future edition's own code terms; never overwrite prior distribution copies.
- package.json license and package-lock.json root metadata: align with the approved future terms.
- electron-builder.yml copyright: use the owner's exact approved copyright-holder text (requested, not yet supplied).
- README.md Install/License sections and free/no-account statements: version-specific distinction between the free edition and an opt-in commercial edition.
- scripts/prepare-windows-downloads.mjs and scripts/prepare-mac-downloads.mjs: future manifests, installation/release notes currently contain MIT wording. Keep historical outputs untouched; do not reuse the old release directory or stable asset URL to replace v0.1.18.
- Website LICENSE: separate ownership/licensing decision; desktop commercial terms do not automatically cover website code.
- Website public/LICENSE.txt, demo/product/LICENSE, README.md, tools/pages.mjs, tools/presentation.mjs, tools/export-product-ui.mjs, site.config.mjs: retain notices for exported MIT code; make any future download/offer text version-specific and approval-gated.
- release-approvals.json and src/shared/edition.ts: keep commercial approval/enforcement false until deliberate opt-in rollout authorization.
No proprietary EULA has been drafted or applied.

## Third-party notices
Third-party licenses remain separate. Current runtime includes MIT components (React, React DOM, Scheduler, Zustand, xterm, node-pty, Electron), ISC YAML, and Chromium's many separate notices. Renderer module IDs are captured during the actual build; scripts/generate-third-party.mjs traverses installed external dependency metadata and collects full license/notice text with exact versions and hashes.

resources/THIRD_PARTY_LICENSES.txt and resources/third-party-manifest.json cover 15 runtime packages on this Windows build, including native node-pty. Electron's LICENSES.chromium.html remains alongside the executable and has a dedicated Settings action. Installer and portable packaging copy the same resources. Regenerate natively for another architecture; do not reuse Windows's native-package inventory for Mac.

@xterm/headless 6.0.0 and addon-serialize 0.14.0 omit LICENSE in their npm payloads. Their npm gitHead is f447274f430fd22513f6adbf9862d19524471c04; the repository-root license at that exact revision is retained in resources/third-party with source URL/hash. Their package metadata declares MIT. Confirm the inherited repository notice's scope during review.

The NSIS distribution has a COPYING file; plugin-specific notices/conditions (including external StdUtils/WinShell/nsis7z components) still require a final installer dependency review. No unknown plugin was guessed to be MIT. installerDependencyReviewApproved remains false. This is not a claim that every distributor obligation has been legally cleared.

## Owner/legal questions
Confirm the actual rights holder, contributor permissions, imported code, mascot/screenshots/assets, missing Terminal repository, dependency notice completeness, commercial license scope and treatment of preexisting MIT components. Decide what is paid: a future licensed edition, hosted account services, support, or another approved offer. Future pricing alone does not establish exclusive rights or remove existing grants. Review existing public permissions before deciding any licensing change.

References: https://opensource.org/license/mit and https://opensource.guide/legal/

# macOS release handoff

## Launch work — October 17, 2026

### Verified candidates

[Native run 39098051088](https://github.com/colescolor/Terminal-Buddy/actions/runs/39098051088) passed **both** Apple Silicon and Intel jobs from `ba304255517a53c23a856103caca3dea8635b6ba` on main. Packaged terminal/process/keyboard, independent workspace/recovery, launcher and custom-assistant tests passed. Native package checks confirmed version, architecture, ad-hoc signature, DMG/ZIP integrity, original application license, runtime notices, Chromium notices and clean source provenance.

All four files were downloaded to `release/native-mac-39098051088/{arm64,x64}/` and independently matched against their native SHA-256 manifests. Apple Silicon: DMG 130,541,584 bytes; ZIP 130,504,693 bytes. Intel: DMG 136,021,019 bytes; ZIP 136,016,491 bytes. Exact hashes are in each `manifest.json` and `SHA256SUMS.txt`.

[Unpublished GitHub draft](https://github.com/colescolor/Terminal-Buddy/releases/tag/untagged-055ea0d7ba58877b917e): all four binaries plus architecture-qualified manifests, checksum/install notes and the original MIT license were uploaded. GitHub's reported SHA-256 digest and size matched every local upload. This draft requires repository access and is **not a public download URL**. Publishing is withheld pending the free-beta versus paid-launch decision; no historical release/tag/download was changed.

These remain **free test candidates**, not subscription-enabled commercial installers. No Developer ID credential or notarization is configured. Separate-Mac downloaded installation and real provider sign-in remain untested. The website's Mac download support is deployed but its release list is empty, so no unverified/publicly unavailable binary is advertised. The owner was asked whether to publish a free experimental beta now or retain it for the paid launch; that answer remains pending.

The first native run exposed needless account Keychain initialization in free editions; the account service now skips it until account storage is needed. An Intel smoke test also assumed persistence completed in 500 ms; it now waits for the actual persisted state. Both corrections passed native verification. Superseded/failed runs remain in history rather than being represented as successes.

The owner authorized launch and Mac preparation. `productionAuthorized` records that authorization; it is not evidence of a final seller identity, live Stripe credentials, or Apple signing. The current source is **0.2.0-beta.1**, still the free MIT edition with subscription enforcement disabled. Earlier version-specific notes below are historical.

Native Apple Silicon and Intel builds started in [run 39097212867](https://github.com/colescolor/Terminal-Buddy/actions/runs/39097212867) from `b0375c6`. A packaging correction adds Chromium notices inside the app and checks the bundled package version, application license, runtime notices, secret patterns and clean source commit. Rebuild after that correction before distributing anything.

The repository has no Actions secrets configured. Developer ID signing and notarization are therefore unavailable. Ad-hoc artifacts must be labeled experimental; they must not be advertised as notarized or as the paid edition. The existing Windows v0.1.18 download and all prior license grants stay unchanged.

## Current evidence

- Desktop source version: 0.1.18. Electron 44.2 requires macOS 13 Ventura or later.
- The existing public app repository is `colescolor/Terminal-Buddy` (the older origin redirects there).
- [Run 34047048766](https://github.com/colescolor/Terminal-Buddy/actions/runs/34047048766) successfully built and smoke-tested **0.1.10**, on Apple Silicon and Intel. This does not validate current 0.1.18.
- No current Mac binary has been built or published by this change. No website Mac download is advertised. Windows release URLs remain unchanged.
- Changes here are local, not pushed to main. Existing uncommitted desktop and website work must be reviewed separately before choosing the source for a release.

## Build a test beta

Use Node 22 on each native architecture: Apple Silicon (`arm64`) and Intel (`x64`). Do not copy Windows node_modules. Run the following in the repository root on the corresponding Mac:

```sh
npm ci
npm run typecheck
npm run test:platform
npm run test:mac-downloads
npm run dist:mac:beta -- --arm64
BUDDY_EXE="$PWD/release/mac-arm64/Terminal Buddy.app/Contents/MacOS/Terminal Buddy" npm run test:platform-app
npm run downloads:mac -- --arch=arm64
```

For Intel use `--x64`, `--arch=x64`, and `release/mac/Terminal Buddy.app/Contents/MacOS/Terminal Buddy`.
The existing `macOS builds` GitHub Actions workflow runs both native builds, additional tests, and prepares the downloads. It can be dispatched on an approved branch once these changes are pushed there. It never publishes a release or changes the website. Current workflow uses GitHub-hosted public-repository runners; no new paid service is configured.

Outputs: `release/mac-downloads/arm64/` and `release/mac-downloads/x64/`, each with versioned DMG/ZIP, SHA256SUMS, manifest, MIT license and installation notes. The preparation command checks native architecture, bundle identity/version, minimum OS, code signature, DMG checksum and ZIP integrity. It hashes the exact copied files. The CI runtime smoke test separately checks terminal startup, mock agent detection, clipboard shortcuts and interrupt handling. These checks do not replace a downloaded-installer test on a separate Mac.

The beta build uses explicit **ad-hoc signing**, not an Apple Developer ID certificate; hardened runtime is disabled only for that test command. Ad-hoc signing does not establish publisher trust or notarization. Gatekeeper can block downloaded copies. Never tell users to disable security protections.

## Public release gates

1. Approve the exact current app source/commit and a branch build; do not silently push uncommitted changes or main. Run both architecture jobs and retain run URL + commit.
2. Choose testing-only beta or a Developer ID signed and notarized public release. Signing credentials have not been supplied or inspected. For public signing, use `dist:mac` (not `dist:mac:beta`), repository/environment secrets for the certificate/password and Apple notarization authentication. Follow [electron-builder v26 signing instructions](https://www.electron.build/v26/docs/features/code-signing/). Never commit credentials. Add/verify hardened-runtime entitlements for Electron and the native PTY before releasing; do not assume signing alone proves notarization.
3. Test each final downloaded DMG on a separate corresponding Mac: open, drag to Applications, launch through Finder, open a folder, start terminal, launch installed CLI, reopen a supported chat, clipboard, notifications and uninstall. Verify Gatekeeper and notarization independently. Recalculate manifests after any signing/stapling changes.
4. With publication approval, attach the **exact files named in each manifest** to the existing distribution release, along with architecture-qualified manifests/checksum/license filenames. Do not upload the entire release folder, source profiles or CI logs. Workflow artifacts are not public download URLs and expire.
5. Verify anonymous public GET, file type, byte count and SHA-256 after redirects. Only then add actual Mac assets and measured signing status to the website's centralized release configuration and download page. Show separate Apple Silicon and Intel buttons. Keep existing Windows URLs pinned to their version; never replace them with a Mac-only latest-release URL.
6. Website publication requires explicit approval to push main/deploy. Update Download/Help OS requirements and download-report tests for additional assets. Count requests separately from installations. No Mac download URL should be invented while artifacts are pending.

## Outstanding

- Current Mac builds and packaged-runtime verification on both architectures.
- Owner answer on Apple Developer signing vs initial testing beta.
- Separate-Mac installation test, real public artifact URLs, and website rollout approval.

## Local checks for this change

Passed on Windows: TypeScript checks, platform contracts (including mocked macOS behavior), two Mac packaging tests, existing Windows packaging test, YAML parsing of both native workflow targets, and Electron production build. The production build required normal filesystem access outside the restricted sandbox for esbuild configuration discovery. No Mac runtime or native signing/container command was executed locally; those remain required on the runners.

Reference: [Electron 44 release notes](https://www.electronjs.org/blog/electron-44-0), [electron-builder v26 macOS settings](https://www.electron.build/v26/docs/mac/).

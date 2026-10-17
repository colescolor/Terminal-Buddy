// Build-time configuration only. Changing environment variables cannot enable a packaged paid edition.
// Release approval gates must pass before these values are deliberately changed.
export const EDITION = {
 kind: 'free' as 'free' | 'commercial',
 commercialApproved: false,
 enforcement: false,
 billingOrigin: '',
 entitlementPublicKey: '',
 supportUrl: 'https://github.com/colescolor/Terminal-Buddy/issues'
}

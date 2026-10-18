// Reviewed build-time configuration. Environment variables alone cannot enable live payments.
// Populate only through the approved release preparation workflow.
export const release = Object.freeze({
 liveApproved: false,
 billingOrigin: '',
 supabaseOrigin: '',
 stripeAccountId: ''
})

// Snapshot events consumed by service.webhook. Reuse this list when configuring Stripe.
export const webhookEvents=Object.freeze([
 'customer.subscription.created',
 'customer.subscription.updated',
 'customer.subscription.deleted',
 'customer.subscription.paused',
 'customer.subscription.resumed',
 'invoice.paid',
 'invoice.payment_failed',
 'invoice.payment_action_required',
 'checkout.session.completed',
 'checkout.session.async_payment_succeeded',
 'checkout.session.async_payment_failed',
 'checkout.session.expired'
])

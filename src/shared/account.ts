export type AccessState = 'free' | 'signed-out' | 'eligible' | 'trial' | 'paid' | 'cancelling' | 'past_due' | 'expired' | 'confirming' | 'unknown'
export interface AccountView {
 state: AccessState; email?: string; trialEndsAt?: number; accessUntil?: number; customer?: boolean;
 offline?: boolean; configured: boolean; enforcement: boolean; message?: string
}
export interface Entitlement {payload: string; signature: string}
export interface AccountRecord extends AccountView {accountId: string; entitlement: Entitlement}

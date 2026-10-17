CREATE TABLE IF NOT EXISTS accounts (
 id uuid PRIMARY KEY, email text NOT NULL,
 trial_started_at bigint, trial_ends_at bigint,
 billing jsonb NOT NULL DEFAULT '{}'::jsonb,
 CHECK ((trial_started_at IS NULL AND trial_ends_at IS NULL) OR trial_ends_at = trial_started_at + 1209600000)
);
CREATE TABLE IF NOT EXISTS desktop_sessions (
 token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id),
 expires_at bigint NOT NULL, created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS device_flows (
 id uuid PRIMARY KEY, challenge text NOT NULL, state_hash text NOT NULL,
 account_id uuid REFERENCES accounts(id), expires_at bigint NOT NULL, consumed boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS processed_events (
 id text PRIMARY KEY, event_type text NOT NULL, processed_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_lookup ON accounts ((billing->>'customerId'));
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE desktop_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON accounts, desktop_sessions, device_flows, processed_events FROM PUBLIC;

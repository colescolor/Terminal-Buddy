CREATE TABLE IF NOT EXISTS recovery_requests (
 id uuid PRIMARY KEY, requester_id uuid NOT NULL, requester_email text NOT NULL,
 original_email text NOT NULL, reason text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','review','closed')),
 reply text NOT NULL DEFAULT '', revision integer NOT NULL DEFAULT 0,
 created_at bigint NOT NULL, updated_at bigint NOT NULL, reviewed_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_recovery ON recovery_requests(requester_id) WHERE status <> 'closed';
ALTER TABLE recovery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON recovery_requests FROM PUBLIC;

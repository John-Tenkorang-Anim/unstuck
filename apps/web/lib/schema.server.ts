import "server-only";

/**
 * Community data owned by the web app. It lives in its own schema so it never
 * collides with the API's tables. Every statement is idempotent; the app runs
 * this at startup under an advisory lock.
 */
export const webSchema = `CREATE SCHEMA IF NOT EXISTS web;

CREATE TABLE IF NOT EXISTS web.accounts (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  role text NOT NULL DEFAULT '',
  moderator boolean NOT NULL DEFAULT false,
  suspended boolean NOT NULL DEFAULT false,
  created timestamptz NOT NULL DEFAULT now()
);
-- One row per signed-in browser. Only SHA-256 hashes are stored.
CREATE TABLE IF NOT EXISTS web.tokens (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES web.accounts(id) ON DELETE CASCADE,
  created timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS web.recovery_codes (
  code_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES web.accounts(id) ON DELETE CASCADE,
  created timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS web.files (
  id uuid PRIMARY KEY,
  owner uuid NOT NULL REFERENCES web.accounts(id),
  mime text NOT NULL,
  bytes integer NOT NULL CHECK (bytes > 0),
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
  scan text NOT NULL DEFAULT '',
  created timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS web.sessions (
  id uuid PRIMARY KEY,
  owner uuid NOT NULL REFERENCES web.accounts(id),
  data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-review', 'revised', 'resolved')),
  hidden boolean NOT NULL DEFAULT false,
  created timestamptz NOT NULL DEFAULT now()
);
-- Session ids are text because sample sessions use readable slugs.
CREATE TABLE IF NOT EXISTS web.notes (
  id uuid PRIMARY KEY,
  session_id text NOT NULL,
  owner uuid NOT NULL REFERENCES web.accounts(id),
  data jsonb NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_session ON web.notes (session_id, created);
CREATE TABLE IF NOT EXISTS web.pins (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  owner uuid NOT NULL REFERENCES web.accounts(id),
  data jsonb NOT NULL,
  created timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pins_session ON web.pins (session_id, created);
CREATE TABLE IF NOT EXISTS web.entries (
  id uuid PRIMARY KEY,
  owner uuid NOT NULL REFERENCES web.accounts(id),
  data jsonb NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS web.reports (
  id uuid PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('session', 'note', 'entry')),
  target_id text NOT NULL,
  reporter uuid NOT NULL REFERENCES web.accounts(id),
  reason text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, reporter)
);
CREATE TABLE IF NOT EXISTS web.moderation_actions (
  id uuid PRIMARY KEY,
  moderator uuid NOT NULL REFERENCES web.accounts(id),
  target_type text NOT NULL,
  target_id text NOT NULL,
  action text NOT NULL,
  note text NOT NULL,
  created timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS web.rate_events (
  key text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_key_at ON web.rate_events (key, at);

-- Later additions. Each is safe to run again.
ALTER TABLE web.files ADD COLUMN IF NOT EXISTS pdq text;
ALTER TABLE web.files ADD COLUMN IF NOT EXISTS quarantined boolean NOT NULL DEFAULT false;
ALTER TABLE web.files DROP CONSTRAINT IF EXISTS files_status_check;
ALTER TABLE web.files ADD CONSTRAINT files_status_check
  CHECK (status IN ('approved', 'pending', 'rejected', 'blocked'));
CREATE INDEX IF NOT EXISTS files_pdq ON web.files (pdq) WHERE pdq IS NOT NULL;

-- Uploads that matched a known-abuse hash list. The file is quarantined and
-- never served; moderators record the report they filed with the authorities.
CREATE TABLE IF NOT EXISTS web.incidents (
  id uuid PRIMARY KEY,
  file_id uuid NOT NULL REFERENCES web.files(id),
  account_id uuid NOT NULL REFERENCES web.accounts(id),
  matched text NOT NULL,
  distance integer NOT NULL,
  reported_by uuid REFERENCES web.accounts(id),
  report_reference text,
  reported_at timestamptz,
  created timestamptz NOT NULL DEFAULT now()
);

-- One appeal per person per hidden item or suspension, decided by a moderator
-- other than the one who acted when possible.
CREATE TABLE IF NOT EXISTS web.appeals (
  id uuid PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('session', 'note', 'entry', 'account')),
  target_id text NOT NULL,
  appellant uuid NOT NULL REFERENCES web.accounts(id),
  statement text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'overturned')),
  decided_by uuid REFERENCES web.accounts(id),
  decision_note text,
  created timestamptz NOT NULL DEFAULT now(),
  decided timestamptz,
  UNIQUE (target_type, target_id, appellant)
);
`;

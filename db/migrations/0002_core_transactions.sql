-- Runtime invariants for the persistent entry workflows. Never rewrite 0001:
-- deployed databases must receive changes through a new, checked migration.
ALTER TABLE entries ADD CONSTRAINT entries_version_positive CHECK (version > 0);
ALTER TABLE entries ADD CONSTRAINT published_entries_have_timestamp
  CHECK (status <> 'published' OR published_at IS NOT NULL);
ALTER TABLE entry_stats ADD CONSTRAINT entry_stats_nonnegative CHECK (
  same_count >= 0 AND not_same_count >= 0 AND worked_count >= 0
  AND didnt_work_count >= 0 AND helped_count >= 0 AND saved_count >= 0
  AND comment_count >= 0 AND solved_for_count >= 0
);

-- Scope retry keys by operation. Existing rows remain in their legacy namespace.
ALTER TABLE idempotency_keys ADD COLUMN operation text NOT NULL DEFAULT 'legacy';
ALTER TABLE idempotency_keys ALTER COLUMN operation DROP DEFAULT;
ALTER TABLE idempotency_keys ADD COLUMN request_hash bytea;
ALTER TABLE idempotency_keys DROP CONSTRAINT idempotency_keys_pkey;
ALTER TABLE idempotency_keys ADD PRIMARY KEY (account_id, operation, key);
ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_key_length
  CHECK (length(key) BETWEEN 1 AND 200);
CREATE INDEX idempotency_expiry_idx ON idempotency_keys (created_at);

CREATE TABLE problem_resolutions (
  entry_id uuid PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  by_kind text NOT NULL CHECK (by_kind IN ('answer', 'solution')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Public delivery metadata is separate from private processing variants.
ALTER TABLE media ADD COLUMN public_manifest jsonb;

-- A comment's parent must be in the same entry even if a caller bypasses services.
ALTER TABLE comments ADD CONSTRAINT comments_entry_identity UNIQUE (entry_id, id);
ALTER TABLE comments ADD CONSTRAINT comments_parent_entry
  FOREIGN KEY (entry_id, parent_id) REFERENCES comments(entry_id, id);
CREATE INDEX helped_author_lookup_idx ON helped (target_id, account_id)
  WHERE target_type = 'entry';
CREATE INDEX sessions_expiry_idx ON sessions (expires_at) WHERE revoked_at IS NULL;

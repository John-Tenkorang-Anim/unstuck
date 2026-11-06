
-- =====================================================================
-- Unstuck 0001_init.sql · Postgres 16 · pgvector >= 0.8
-- Conventions: uuid PKs, timestamptz, text + CHECK for enums (easy to migrate),
-- every public-facing name comes from entry_aliases (INV-01).
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- identity (internal; never exposed) ----------
CREATE TABLE accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),     -- INV-01: never leaves the server
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','limited','suspended','deleted')),
  trust_score  real NOT NULL DEFAULT 1.0 CHECK (trust_score BETWEEN 0.2 AND 3.0),  -- internal
  is_moderator bool NOT NULL DEFAULT false,
  email_enc    bytea,                                          -- optional, encrypted, recovery only
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE passkey_credentials (
  credential_id bytea PRIMARY KEY,
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_key    bytea NOT NULL, sign_count bigint NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now()
);
CREATE TABLE recovery_codes (account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
                             code_hash bytea NOT NULL, used_at timestamptz, PRIMARY KEY (account_id, code_hash));
CREATE TABLE magic_link_tokens (token_hash bytea PRIMARY KEY, account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
                                expires_at timestamptz NOT NULL, used_at timestamptz);
CREATE TABLE sessions (id_hash bytea PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                       created_at timestamptz DEFAULT now(), expires_at timestamptz NOT NULL, revoked_at timestamptz);
CREATE TABLE account_settings (
  account_id     uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  ui_lang        text NOT NULL DEFAULT 'en',
  read_langs     text[] NOT NULL DEFAULT '{en}',       -- languages they read without translation
  my_context     jsonb NOT NULL DEFAULT '{}',          -- "works where I am"; never public
  lite_mode      text NOT NULL DEFAULT 'auto' CHECK (lite_mode IN ('auto','on','off')),
  country        text CHECK (country ~ '^[A-Z]{2}$')   -- optional; used only in aggregates of 10+
);

-- ---------- taxonomy ----------
CREATE TABLE topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL, parent_id uuid REFERENCES topics(id),
  names       jsonb NOT NULL,                          -- {"en": "Concrete", "fr": "Béton", ...}
  high_stakes bool NOT NULL DEFAULT false              -- INV-10
);
CREATE TABLE context_keys (
  key        text PRIMARY KEY,                         -- 'country', 'climate_zone', 'os', 'soil_type', ...
  labels     jsonb NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('enum','number','text','country','version')),
  allowed    jsonb,                                    -- enum values or {min,max,unit}
  templates  text[] NOT NULL DEFAULT '{}'              -- empty = all templates
);

-- ---------- entries ----------
CREATE TABLE entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    uuid NOT NULL REFERENCES accounts(id),
  kind         text NOT NULL CHECK (kind IN ('experience','problem','solution','idea','discovery','research')),
  template     text NOT NULL CHECK (template IN ('everyday','making','farming_food','software','research','work_business','community')),
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','pending_review','published','hidden','deleted')),
  outcome      text CHECK (outcome IN ('worked','failed','mixed','ongoing')),
  problem_state text CHECK (problem_state IN ('open','answered','solved','stale')),
  title        text NOT NULL CHECK (length(title) BETWEEN 6 AND 160),
  goal         text NOT NULL,
  approach     text,
  result       text,
  why_text     text,
  advice       text,
  type_fields  jsonb NOT NULL DEFAULT '{}',             -- validated against domain/templates/{template}.json
  lang         text NOT NULL,                          -- BCP-47 of the original
  license      text NOT NULL DEFAULT 'CC-BY-4.0' CHECK (license IN ('CC-BY-4.0','CC-BY-SA-4.0','CC0-1.0')),
  why_status   text NOT NULL DEFAULT 'unknown'
               CHECK (why_status IN ('unknown','suspected','author_confirmed','verified')),
  high_stakes  bool NOT NULL DEFAULT false,            -- copied from topics on publish
  version      int NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'problem') = (problem_state IS NOT NULL)),
  CHECK (kind NOT IN ('experience','research') OR outcome IS NOT NULL OR status = 'draft')
);
CREATE INDEX entries_feed_idx    ON entries (status, published_at DESC);
CREATE INDEX entries_problem_idx ON entries (problem_state, last_activity_at) WHERE kind = 'problem';
CREATE INDEX entries_author_idx  ON entries (author_id);

CREATE TABLE entry_versions (entry_id uuid REFERENCES entries(id) ON DELETE CASCADE, version int NOT NULL,
                             snapshot jsonb NOT NULL, edited_at timestamptz DEFAULT now(), PRIMARY KEY (entry_id, version));
CREATE TABLE entry_context (entry_id uuid REFERENCES entries(id) ON DELETE CASCADE,
                            key text REFERENCES context_keys(key), value text NOT NULL, PRIMARY KEY (entry_id, key));
CREATE INDEX entry_context_kv_idx ON entry_context (key, value);
CREATE TABLE entry_topics  (entry_id uuid REFERENCES entries(id) ON DELETE CASCADE,
                            topic_id uuid REFERENCES topics(id), PRIMARY KEY (entry_id, topic_id));

-- INV-01: a different alias per (entry, account); the author is shown as "Author".
CREATE TABLE entry_aliases (
  entry_id   uuid REFERENCES entries(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id),
  alias      text NOT NULL,
  PRIMARY KEY (entry_id, account_id), UNIQUE (entry_id, alias)
);
-- v1.1 signed entries: an explicit, per-entry choice to show a display name
CREATE TABLE entry_signatures (entry_id uuid PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
                               display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 60));

-- INV-04: all public counts live here and change in the same transaction as the action
CREATE TABLE entry_stats (
  entry_id      uuid PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  same_count    int NOT NULL DEFAULT 0, not_same_count int NOT NULL DEFAULT 0,
  worked_count  int NOT NULL DEFAULT 0, didnt_work_count int NOT NULL DEFAULT 0,
  helped_count  int NOT NULL DEFAULT 0, saved_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0, solved_for_count int NOT NULL DEFAULT 0,
  frozen        bool NOT NULL DEFAULT false        -- anti-brigading freeze (AC-07.2)
);

CREATE TABLE entry_links (
  from_id    uuid REFERENCES entries(id) ON DELETE CASCADE,
  to_id      uuid REFERENCES entries(id) ON DELETE CASCADE,
  rel        text NOT NULL CHECK (rel IN ('solves','next_attempt','replicates','contradicts','builds_on','duplicate_of')),
  created_by uuid NOT NULL REFERENCES accounts(id),
  note       text,                                  -- for next_attempt: what changed
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (from_id, to_id, rel), CHECK (from_id <> to_id)
);
CREATE INDEX entry_links_to_idx ON entry_links (to_id, rel);

-- ---------- media ----------
CREATE TABLE media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      uuid REFERENCES entries(id) ON DELETE CASCADE,
  comment_id    uuid,                                -- media can attach to a comment instead
  uploader_id   uuid NOT NULL REFERENCES accounts(id),
  kind          text NOT NULL CHECK (kind IN ('image','video','video_link','pdf','csv','code','audio_note')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','processing','ready','failed')),
  review_status text NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review','approved','rejected')),
  original_key  text,                                -- PRIVATE bucket
  public_prefix text,                                -- set only on approval (INV-03)
  link_url      text,
  variants      jsonb NOT NULL DEFAULT '{}',
  bytes bigint, width int, height int, duration_s real, sha256 bytea,
  alt_text      text,                                -- required for images before publish
  ocr_text text, transcript text, captions_key text,
  metadata_stripped bool NOT NULL DEFAULT false, faces_blurred bool NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES accounts(id), reviewed_at timestamptz,
  attempts int NOT NULL DEFAULT 0, last_error text, created_at timestamptz DEFAULT now()
);
CREATE INDEX media_entry_idx  ON media (entry_id);
CREATE INDEX media_review_idx ON media (created_at) WHERE review_status = 'pending_review' AND status = 'ready';
CREATE TABLE annotations   (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), media_id uuid REFERENCES media(id) ON DELETE CASCADE,
                            shape text NOT NULL CHECK (shape IN ('arrow','circle','box','label')),
                            coords jsonb NOT NULL, label text);           -- coords normalized 0..1
CREATE TABLE video_markers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), media_id uuid REFERENCES media(id) ON DELETE CASCADE,
                            at_seconds real NOT NULL CHECK (at_seconds >= 0), label text NOT NULL,
                            kind text NOT NULL DEFAULT 'broke' CHECK (kind IN ('broke','worked','note')));
CREATE TABLE datasets      (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entry_id uuid REFERENCES entries(id) ON DELETE CASCADE,
                            media_id uuid REFERENCES media(id), columns jsonb NOT NULL, stats jsonb, chart_spec jsonb);

-- ---------- evidence from many people ----------
CREATE TABLE outcome_reports (
  entry_id   uuid REFERENCES entries(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id),
  verdict    text NOT NULL CHECK (verdict IN ('same_for_me','not_for_me','worked_for_me','didnt_work_for_me','solved_for_me')),
  context    jsonb NOT NULL DEFAULT '{}',
  note       text CHECK (length(note) <= 2000),
  flagged    bool NOT NULL DEFAULT false,            -- new-account / brigading signal
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, account_id)
);
CREATE TABLE helped (
  target_type text NOT NULL CHECK (target_type IN ('entry','page')), target_id uuid NOT NULL,
  account_id  uuid REFERENCES accounts(id),
  kind        text NOT NULL CHECK (kind IN ('helped','saved')),
  saved_note  text CHECK (length(saved_note) <= 280),
  country     text,                                  -- copied from settings at the time; aggregated only
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, target_id, account_id)
);

-- ---------- discussion and the Why board ----------
CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES accounts(id),
  parent_id  uuid REFERENCES comments(id),
  type       text NOT NULL CHECK (type IN ('reply','question','answer','hypothesis','evidence','fix_tried')),
  body_md    text NOT NULL CHECK (length(body_md) <= 10000),
  lang       text NOT NULL,
  fix_outcome text CHECK (fix_outcome IN ('worked','failed','mixed')),   -- for fix_tried
  status     text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_entry_idx ON comments (entry_id, created_at);

CREATE TABLE explanations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id         uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  source_comment   uuid UNIQUE REFERENCES comments(id),
  text             text NOT NULL,
  direction        text NOT NULL CHECK (direction IN ('why_failed','why_worked')),
  state            text NOT NULL DEFAULT 'proposed'
                   CHECK (state IN ('proposed','supported','author_confirmed','verified','disputed','ruled_out')),
  prior_state      text,
  author_note      text,
  verified_by      uuid REFERENCES accounts(id), verified_at timestamptz,
  ruled_out_reason text,
  score            real NOT NULL DEFAULT 0,          -- ORDER ONLY (INV-02)
  CHECK (state <> 'ruled_out' OR ruled_out_reason IS NOT NULL),
  CHECK (state <> 'verified'  OR verified_by IS NOT NULL),
  CHECK (state <> 'disputed'  OR prior_state IS NOT NULL),
  CHECK (state <> 'author_confirmed' OR author_note IS NOT NULL)
);
CREATE TABLE explanation_votes (explanation_id uuid REFERENCES explanations(id) ON DELETE CASCADE,
                                account_id uuid REFERENCES accounts(id), weight real NOT NULL,
                                PRIMARY KEY (explanation_id, account_id));
CREATE TABLE explanation_evidence (
  explanation_id uuid REFERENCES explanations(id) ON DELETE CASCADE,
  comment_id     uuid REFERENCES comments(id),
  account_id     uuid NOT NULL REFERENCES accounts(id),
  stance         text NOT NULL CHECK (stance IN ('supports','contradicts')),
  kind           text NOT NULL CHECK (kind IN ('observation','measurement','fix_worked','fix_failed','replication','citation')),
  hidden         bool NOT NULL DEFAULT false,          -- moderators hide; nothing is deleted
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (explanation_id, comment_id)
);

-- INV-05: one history table for every state machine
CREATE TABLE state_events (
  id bigserial PRIMARY KEY,
  entity text NOT NULL CHECK (entity IN ('entry','problem','explanation','media','trial','page_revision','report','challenge')),
  entity_id uuid NOT NULL, from_state text, to_state text NOT NULL,
  actor_id uuid, note text, at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX state_events_entity_idx ON state_events (entity, entity_id, id);

-- ---------- trials (v1.1; schema ready in v1.0) ----------
CREATE TABLE trials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_entry   uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES accounts(id),
  title           text NOT NULL, protocol_md text NOT NULL,
  measures        jsonb NOT NULL,                      -- [{"key":"days_fresh","type":"number","unit":"days"}]
  contexts_wanted jsonb NOT NULL DEFAULT '[]',         -- [{"climate_zone":"A","slots":3}]
  slots           int NOT NULL CHECK (slots BETWEEN 1 AND 500),
  joined          int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','full','closed','concluded')),
  closes_at       timestamptz NOT NULL,
  CHECK (joined BETWEEN 0 AND slots)
);
CREATE TABLE trial_participants (trial_id uuid REFERENCES trials(id) ON DELETE CASCADE, account_id uuid REFERENCES accounts(id),
                                 status text NOT NULL CHECK (status IN ('joined','reported','withdrawn','expired')),
                                 joined_at timestamptz DEFAULT now(), PRIMARY KEY (trial_id, account_id));
CREATE TABLE trial_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trial_id uuid NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
                            account_id uuid NOT NULL REFERENCES accounts(id),
                            outcome text NOT NULL CHECK (outcome IN ('worked','failed','mixed')),
                            measurements jsonb NOT NULL, context jsonb NOT NULL, note text,
                            created_at timestamptz DEFAULT now(), UNIQUE (trial_id, account_id));

-- ---------- patterns and knowledge pages ----------
CREATE TABLE patterns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic_id uuid REFERENCES topics(id),
                       label text NOT NULL, centroid vector(384), entry_count int NOT NULL DEFAULT 0, updated_at timestamptz);
CREATE TABLE pattern_entries (pattern_id uuid REFERENCES patterns(id) ON DELETE CASCADE, entry_id uuid REFERENCES entries(id) ON DELETE CASCADE,
                              PRIMARY KEY (pattern_id, entry_id));

CREATE TABLE knowledge_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, topic_id uuid REFERENCES topics(id),
  title text NOT NULL, lang text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  current_revision uuid, license text NOT NULL DEFAULT 'CC-BY-SA-4.0',
  source_pattern uuid REFERENCES patterns(id), created_at timestamptz DEFAULT now()
);
CREATE TABLE page_maintainers (page_id uuid REFERENCES knowledge_pages(id) ON DELETE CASCADE,
                               account_id uuid REFERENCES accounts(id), PRIMARY KEY (page_id, account_id));
CREATE TABLE page_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), page_id uuid NOT NULL REFERENCES knowledge_pages(id) ON DELETE CASCADE,
  author_id uuid REFERENCES accounts(id),               -- NULL = AI draft (labeled)
  summary_md text NOT NULL, change_note text,
  state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','accepted','rejected','superseded')),
  decided_by uuid REFERENCES accounts(id), decided_note text, created_at timestamptz DEFAULT now()
);
CREATE TABLE page_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES page_revisions(id) ON DELETE CASCADE,
  position int NOT NULL, section text NOT NULL CHECK (section IN ('what_works','what_fails','why','open_questions','safety')),
  text_md text NOT NULL,
  strength text NOT NULL CHECK (strength IN ('anecdotal','consistent','tested','verified','contested')),  -- computed
  UNIQUE (revision_id, position)
);
CREATE TABLE claim_citations (claim_id uuid REFERENCES page_claims(id) ON DELETE CASCADE,
                              target_type text NOT NULL CHECK (target_type IN ('entry','explanation','trial')),
                              target_id uuid NOT NULL, PRIMARY KEY (claim_id, target_type, target_id));

-- ---------- challenges and spaces (v1.1) ----------
CREATE TABLE spaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, name text NOT NULL,
                     kind text NOT NULL CHECK (kind IN ('ngo','lab','school','company','community','government')),
                     verified bool NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE space_members (space_id uuid REFERENCES spaces(id) ON DELETE CASCADE, account_id uuid REFERENCES accounts(id),
                            role text NOT NULL CHECK (role IN ('admin','editor','member')), PRIMARY KEY (space_id, account_id));
CREATE TABLE challenges (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, space_id uuid REFERENCES spaces(id),
                         title text NOT NULL, problem_md text NOT NULL, success_criteria text NOT NULL,
                         status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed','archived')),
                         page_id uuid REFERENCES knowledge_pages(id), opens_at timestamptz, closes_at timestamptz);
CREATE TABLE challenge_items (challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE,
                              item_type text NOT NULL CHECK (item_type IN ('entry','trial')), item_id uuid NOT NULL,
                              PRIMARY KEY (challenge_id, item_type, item_id));

-- ---------- search, translation, AI cache ----------
CREATE TABLE search_docs (
  doc_type   text NOT NULL CHECK (doc_type IN ('entry','page','challenge')), doc_id uuid NOT NULL,
  lang       text NOT NULL,
  title      text NOT NULL, body text NOT NULL,
  kind text, template text, outcome text, topic_ids uuid[] NOT NULL DEFAULT '{}',
  has_media bool NOT NULL DEFAULT false, has_data bool NOT NULL DEFAULT false,
  context    jsonb NOT NULL DEFAULT '{}',
  searchable bool NOT NULL DEFAULT false,              -- true only while published AND (not high_stakes OR approved)
  tsv        tsvector NOT NULL,                        -- built by worker: original ('simple') + English translation ('english')
  embedding  vector(384),                              -- multilingual model
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_type, doc_id)
);
CREATE INDEX search_docs_tsv  ON search_docs USING gin (tsv) WHERE searchable;
CREATE INDEX search_docs_topics ON search_docs USING gin (topic_ids) WHERE searchable;
CREATE INDEX search_docs_hnsw ON search_docs USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64) WHERE searchable;   -- tune from the eval sweep (section 17)

CREATE TABLE translations (
  target_type text NOT NULL CHECK (target_type IN ('entry','comment','page_revision','explanation')),
  target_id uuid NOT NULL, source_version text NOT NULL, lang text NOT NULL,
  fields jsonb NOT NULL,                               -- {"title": "...", "goal": "...", ...}
  model text NOT NULL, created_at timestamptz DEFAULT now(),
  PRIMARY KEY (target_type, target_id, source_version, lang)
);
CREATE TABLE ai_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('why_summary','plan_summary','page_draft','alt_text','entry_draft')),
  target_type text NOT NULL, target_id uuid NOT NULL, source_version text NOT NULL,
  text_md text NOT NULL, citations jsonb NOT NULL DEFAULT '[]', model text NOT NULL, created_at timestamptz DEFAULT now(),
  UNIQUE (kind, target_type, target_id, source_version)
);

-- ---------- following and notifications (INV-12: no following people) ----------
CREATE TABLE follows (account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
                      target_type text NOT NULL CHECK (target_type IN ('topic','entry','page','challenge')),
                      target_id uuid NOT NULL, created_at timestamptz DEFAULT now(),
                      PRIMARY KEY (account_id, target_type, target_id));
CREATE INDEX follows_target_idx ON follows (target_type, target_id);
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                            type text NOT NULL, payload jsonb NOT NULL, dedupe_key text UNIQUE NOT NULL,
                            created_at timestamptz DEFAULT now(), sent_at timestamptz, read_at timestamptz);
CREATE TABLE notification_settings (account_id uuid REFERENCES accounts(id) ON DELETE CASCADE, type text NOT NULL,
                                    mode text NOT NULL CHECK (mode IN ('instant','daily','off')), PRIMARY KEY (account_id, type));
CREATE TABLE push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
                                 endpoint text UNIQUE NOT NULL, p256dh text NOT NULL, auth text NOT NULL);

-- ---------- trust and safety ----------
CREATE TABLE domain_trust (account_id uuid REFERENCES accounts(id) ON DELETE CASCADE, topic_id uuid REFERENCES topics(id),
                           score real NOT NULL DEFAULT 1.0, PRIMARY KEY (account_id, topic_id));      -- v1.1
CREATE TABLE reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid REFERENCES accounts(id),
                      target_type text NOT NULL, target_id uuid NOT NULL,
                      reason text NOT NULL CHECK (reason IN ('harmful_howto','dangerous_advice','personal_data','harassment',
                                                             'spam','misinformation','copyright','csam','other')),
                      detail text, severity int NOT NULL DEFAULT 2 CHECK (severity BETWEEN 1 AND 4),
                      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','actioned','dismissed','appealed','closed')),
                      created_at timestamptz DEFAULT now());
CREATE TABLE moderation_actions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES reports(id),
                                 moderator_id uuid REFERENCES accounts(id),
                                 action text NOT NULL CHECK (action IN ('hide','remove','warn','limit','suspend','approve','reject')),
                                 explanation text NOT NULL CHECK (length(explanation) >= 20),
                                 appeal_status text NOT NULL DEFAULT 'none' CHECK (appeal_status IN ('none','pending','upheld','reversed')),
                                 created_at timestamptz DEFAULT now());

-- ---------- reliability ----------
CREATE TABLE outbox_events (id bigserial PRIMARY KEY, stream text NOT NULL, payload jsonb NOT NULL,
                            created_at timestamptz DEFAULT now(), relayed_at timestamptz);
CREATE INDEX outbox_pending ON outbox_events (id) WHERE relayed_at IS NULL;
CREATE TABLE idempotency_keys (account_id uuid NOT NULL, key text NOT NULL, response jsonb NOT NULL,
                               created_at timestamptz DEFAULT now(), PRIMARY KEY (account_id, key));   -- purged after 24 h

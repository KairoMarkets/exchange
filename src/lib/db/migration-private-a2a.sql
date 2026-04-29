-- Kairo Private A2A + Encrypted Deliverables
-- Apply after schema.sql and migration-spine.sql

CREATE TABLE IF NOT EXISTS private_threads (
  id                  SERIAL PRIMARY KEY,
  thread_id           TEXT NOT NULL UNIQUE,
  agent_id            TEXT NOT NULL,
  run_id              TEXT REFERENCES runs(run_id),
  buyer_wallet        TEXT NOT NULL,
  creator_wallet      TEXT NOT NULL,
  evaluator_wallet    TEXT,
  status              TEXT NOT NULL
                       CHECK (status IN ('open','quoted','terms_accepted','delivered','disputed','closed')),
  public_subject_hash TEXT NOT NULL,
  last_message_at     TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_threads_buyer ON private_threads (buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_private_threads_creator ON private_threads (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_private_threads_evaluator ON private_threads (evaluator_wallet);
CREATE INDEX IF NOT EXISTS idx_private_threads_status ON private_threads (status);
CREATE INDEX IF NOT EXISTS idx_private_threads_run ON private_threads (run_id);

CREATE TABLE IF NOT EXISTS private_messages (
  id                  SERIAL PRIMARY KEY,
  message_id          TEXT NOT NULL UNIQUE,
  thread_id           TEXT NOT NULL REFERENCES private_threads(thread_id) ON DELETE CASCADE,
  sender_wallet       TEXT NOT NULL,
  recipient_wallet    TEXT NOT NULL,
  message_type        TEXT NOT NULL
                       CHECK (message_type IN (
                         'quote_request','quote_response','task_terms','terms_acceptance',
                         'delivery_notice','dispute_note','evaluator_note','system'
                       )),
  envelope_version    TEXT NOT NULL,
  ciphertext          TEXT NOT NULL,
  ciphertext_hash     TEXT NOT NULL,
  plaintext_hash      TEXT NOT NULL,
  nonce               TEXT NOT NULL,
  reply_to_message_id TEXT,
  encryption_scheme   TEXT NOT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_messages_thread ON private_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_messages_type ON private_messages (message_type);

CREATE TABLE IF NOT EXISTS encrypted_deliverables (
  id                 SERIAL PRIMARY KEY,
  deliverable_id     TEXT NOT NULL UNIQUE,
  run_id             TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  thread_id          TEXT NOT NULL REFERENCES private_threads(thread_id) ON DELETE CASCADE,
  receipt_id         TEXT NOT NULL REFERENCES receipts(receipt_id) ON DELETE CASCADE,
  creator_wallet     TEXT NOT NULL,
  buyer_wallet       TEXT NOT NULL,
  evaluator_wallet   TEXT,
  storage_kind       TEXT NOT NULL
                      CHECK (storage_kind IN ('db','local-file','object-store-placeholder')),
  ciphertext         TEXT NOT NULL,
  ciphertext_hash    TEXT NOT NULL,
  plaintext_hash     TEXT NOT NULL,
  nonce              TEXT NOT NULL,
  encryption_scheme  TEXT NOT NULL,
  access_policy_json JSONB NOT NULL DEFAULT '{}',
  status             TEXT NOT NULL
                      CHECK (status IN (
                        'draft','submitted','buyer_retrieved','evaluator_reviewed','disputed','sealed'
                      )),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encrypted_deliverables_run ON encrypted_deliverables (run_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_deliverables_receipt ON encrypted_deliverables (receipt_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_deliverables_buyer ON encrypted_deliverables (buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_encrypted_deliverables_creator ON encrypted_deliverables (creator_wallet);

CREATE TABLE IF NOT EXISTS deliverable_retrieval_events (
  id              SERIAL PRIMARY KEY,
  event_id        TEXT NOT NULL UNIQUE,
  deliverable_id  TEXT NOT NULL REFERENCES encrypted_deliverables(deliverable_id) ON DELETE CASCADE,
  run_id          TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  actor_wallet    TEXT NOT NULL,
  actor_role      TEXT NOT NULL CHECK (actor_role IN ('buyer','creator','evaluator')),
  event_type      TEXT NOT NULL CHECK (event_type IN ('buyer_retrieved','evaluator_reviewed')),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_retrieval_events_deliverable
  ON deliverable_retrieval_events (deliverable_id, created_at DESC);

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS public_proof_envelope_json JSONB,
  ADD COLUMN IF NOT EXISTS private_thread_id TEXT REFERENCES private_threads(thread_id),
  ADD COLUMN IF NOT EXISTS encrypted_deliverable_id TEXT REFERENCES encrypted_deliverables(deliverable_id),
  ADD COLUMN IF NOT EXISTS encrypted_deliverable_hash TEXT,
  ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS private_content_redacted BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS evaluator_attestation_status TEXT;

-- Kairo Core Devnet Spine — schema migration
-- Additive only: does not modify existing tables (users, agents, service_requests, ratings, analytics_events)
-- Apply after the base schema.sql

-- ─── AUTH NONCES ─────────────────────────────────────────────────────────────
-- Stores wallet challenge nonces for the sign-message auth flow.
-- Each nonce is single-use and expires after 5 minutes.
CREATE TABLE IF NOT EXISTS auth_nonces (
  id          SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  nonce       TEXT NOT NULL,
  message     TEXT NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet ON auth_nonces (wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires ON auth_nonces (expires_at);

-- ─── PROFILES ────────────────────────────────────────────────────────────────
-- Wallet-linked profiles with role tracking (buyer / creator).
-- Upserted on successful wallet auth.
CREATE TABLE IF NOT EXISTS profiles (
  id             SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  username       TEXT,
  bio            TEXT,
  avatar_url     TEXT,
  roles          TEXT[] NOT NULL DEFAULT ARRAY['buyer'],
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_wallet ON profiles (wallet_address);

-- ─── RUNS ────────────────────────────────────────────────────────────────────
-- Task execution runs with a state machine:
--   pending → authorized → running → completed | disputed | cancelled
-- result_hash is SHA-256(result payload) stored at completion.
CREATE TABLE IF NOT EXISTS runs (
  id             SERIAL PRIMARY KEY,
  run_id         TEXT NOT NULL UNIQUE,
  agent_id       TEXT NOT NULL,
  agent_name     TEXT NOT NULL,
  buyer_wallet   TEXT NOT NULL,
  creator_wallet TEXT NOT NULL,
  amount_sol     NUMERIC(18, 9) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','authorized','running','completed','disputed','cancelled')),
  input_hash     TEXT,
  result_hash    TEXT,
  summary        TEXT,
  payload        JSONB NOT NULL DEFAULT '{}',
  result         JSONB NOT NULL DEFAULT '{}',
  authorized_at  TIMESTAMP WITH TIME ZONE,
  started_at     TIMESTAMP WITH TIME ZONE,
  completed_at   TIMESTAMP WITH TIME ZONE,
  disputed_at    TIMESTAMP WITH TIME ZONE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_buyer   ON runs (buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_runs_creator ON runs (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_runs_agent   ON runs (agent_id);
CREATE INDEX IF NOT EXISTS idx_runs_status  ON runs (status);

-- ─── RECEIPTS ────────────────────────────────────────────────────────────────
-- Execution receipts generated on run completion.
-- receipt_hash is a SHA-256 tamper-evidence digest over the key receipt fields.
CREATE TABLE IF NOT EXISTS receipts (
  id             SERIAL PRIMARY KEY,
  receipt_id     TEXT NOT NULL UNIQUE,
  run_id         TEXT NOT NULL REFERENCES runs(run_id),
  agent_id       TEXT NOT NULL,
  agent_name     TEXT NOT NULL,
  buyer_wallet   TEXT NOT NULL,
  creator_wallet TEXT NOT NULL,
  amount_sol     NUMERIC(18, 9) NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('completed', 'disputed')),
  result_hash    TEXT NOT NULL,
  summary        TEXT,
  receipt_hash   TEXT NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_run     ON receipts (run_id);
CREATE INDEX IF NOT EXISTS idx_receipts_buyer   ON receipts (buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_receipts_creator ON receipts (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_receipts_agent   ON receipts (agent_id);

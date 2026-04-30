-- AgentMarket DB schema
-- Created: automated helper

-- Users / Wallets
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  username TEXT,
  preferences JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE, -- on-chain agent id or uuid
  name TEXT NOT NULL,
  description TEXT,
  capabilities JSONB,
  pricing JSONB,
  endpoint TEXT,
  creator_wallet TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Service Requests / Jobs
CREATE TABLE IF NOT EXISTS service_requests (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  agent_id TEXT NOT NULL,
  user_wallet TEXT NOT NULL,
  amount NUMERIC(18,6) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, funded, completed, disputed, cancelled
  payload JSONB,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ratings and Reviews
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_wallet TEXT NOT NULL,
  stars INTEGER CHECK (stars >= 0 AND stars <= 5),
  quality_score INTEGER,
  speed_score INTEGER,
  value_score INTEGER,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Analytics / Events
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agents_creator ON agents (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_requests_agent ON service_requests (agent_id);
CREATE INDEX IF NOT EXISTS idx_ratings_agent ON ratings (agent_id);

-- Payment authorization/proof lane records. The active provider is payai
-- through a Kairo-owned adapter, with Solana cluster RailGuard.
CREATE TABLE IF NOT EXISTS payment_authorizations (
  id                                  SERIAL PRIMARY KEY,
  authorization_id                    TEXT NOT NULL UNIQUE,
  run_id                              TEXT NOT NULL,
  receipt_id                          TEXT,
  buyer_wallet                        TEXT NOT NULL,
  creator_wallet                      TEXT NOT NULL,
  agent_id                            TEXT NOT NULL,
  agent_name                          TEXT NOT NULL,
  amount_atomic                       NUMERIC(38, 0) NOT NULL CHECK (amount_atomic > 0),
  amount_sol                          NUMERIC(18, 9) NOT NULL,
  max_amount_atomic                   NUMERIC(38, 0) NOT NULL CHECK (max_amount_atomic > 0),
  currency                            TEXT NOT NULL,
  token_mint                          TEXT NOT NULL,
  network                             TEXT NOT NULL CHECK (network IN ('solana-mainnet','solana-devnet')),
  provider                            TEXT NOT NULL CHECK (provider IN ('payai')),
  provider_payment_reference_id       TEXT,
  nonce                               TEXT NOT NULL,
  idempotency_key                     TEXT NOT NULL,
  status                              TEXT NOT NULL CHECK (status IN (
                                        'quoted','authorization_requested','wallet_approved',
                                        'proof_pending','proof_recorded','settled','failed',
                                        'refunded','disputed','expired'
                                      )),
  signed_authorization_payload_hash   TEXT,
  proof_payload_hash                  TEXT,
  proof_reference                     TEXT,
  proof_recorded_at                   TIMESTAMP WITH TIME ZONE,
  settled_at                          TIMESTAMP WITH TIME ZONE,
  expires_at                          TIMESTAMP WITH TIME ZONE NOT NULL,
  platform_fee_atomic                 NUMERIC(38, 0) NOT NULL,
  creator_payout_atomic               NUMERIC(38, 0) NOT NULL,
  creator_payout_status               TEXT NOT NULL CHECK (creator_payout_status IN ('pending','eligible','paid','blocked')),
  evaluator_attestation_status        TEXT NOT NULL CHECK (evaluator_attestation_status IN ('not_required','pending','approved','rejected')),
  chain_proof_reference               TEXT,
  escrow_adapter                      TEXT NOT NULL CHECK (escrow_adapter IN ('payai_manual_devnet','solana_escrow')),
  escrow_state                        TEXT NOT NULL CHECK (escrow_state IN ('none','held','released','refunded','disputed')),
  escrow_reference                    TEXT,
  public_metadata_json                JSONB NOT NULL DEFAULT '{}',
  private_metadata_json               JSONB NOT NULL DEFAULT '{}',
  provider_metadata_json              JSONB NOT NULL DEFAULT '{}',
  state_events_json                   JSONB NOT NULL DEFAULT '[]',
  created_at                          TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at                          TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_authorizations_idempotency
  ON payment_authorizations (buyer_wallet, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_run ON payment_authorizations (run_id);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_receipt ON payment_authorizations (receipt_id);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_buyer ON payment_authorizations (buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_creator ON payment_authorizations (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_status ON payment_authorizations (status);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  delivery_id TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','delivered','failed')),
  response_status INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries (event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries (status);

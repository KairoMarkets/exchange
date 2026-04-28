-- Kairo PayAI private payment/proof lane
-- Apply after migration-spine.sql and migration-private-a2a.sql

CREATE TABLE IF NOT EXISTS payment_authorizations (
  id                                  SERIAL PRIMARY KEY,
  authorization_id                    TEXT NOT NULL UNIQUE,
  run_id                              TEXT NOT NULL REFERENCES runs(run_id),
  receipt_id                          TEXT REFERENCES receipts(receipt_id),
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
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_run
  ON payment_authorizations (run_id);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_receipt
  ON payment_authorizations (receipt_id);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_buyer
  ON payment_authorizations (buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_creator
  ON payment_authorizations (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_status
  ON payment_authorizations (status);

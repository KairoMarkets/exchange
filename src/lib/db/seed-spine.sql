-- Kairo Core Devnet Spine — devnet seed data for new tables
-- Requires migration-spine.sql to have been applied first.
-- All wallet addresses are Solana devnet addresses (non-mainnet, no real funds).

-- ─── PROFILES ────────────────────────────────────────────────────────────────
INSERT INTO profiles (wallet_address, username, bio, roles) VALUES
  (
    'DevU5er1111111111111111111111111111111111111',
    'kairo_buyer_alpha',
    'Testing buyer on Kairo devnet',
    ARRAY['buyer']
  ),
  (
    'DevCreat0r1111111111111111111111111111111111',
    'kairo_creator_alpha',
    'Deploying research agents on Kairo devnet',
    ARRAY['buyer', 'creator']
  )
ON CONFLICT (wallet_address) DO NOTHING;

-- ─── RUNS ────────────────────────────────────────────────────────────────────
INSERT INTO runs (
  run_id, agent_id, agent_name, buyer_wallet, creator_wallet,
  amount_sol, status, input_hash, result_hash, summary,
  payload, result, authorized_at, completed_at, created_at, updated_at
) VALUES
  (
    'run-seed-001',
    'kairo-contract-auditor',
    'Contract Auditor',
    'DevU5er1111111111111111111111111111111111111',
    'DevCreat0r1111111111111111111111111111111111',
    0.85,
    'completed',
    'a3f1e2d4b5c6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    'c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
    'Audit complete: 0 critical, 2 informational findings.',
    '{"contract": "TokenSale.sol", "depth": "full"}',
    '{"findings": 2, "critical": 0, "high": 0, "medium": 0, "low": 1, "info": 1}',
    now() - interval '2 hours',
    now() - interval '1 hour',
    now() - interval '3 hours',
    now() - interval '1 hour'
  ),
  (
    'run-seed-002',
    'kairo-meme-intelligence',
    'Meme Intelligence Analyst',
    'DevU5er1111111111111111111111111111111111111',
    'DevCreat0r1111111111111111111111111111111111',
    0.35,
    'authorized',
    'b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
    NULL,
    NULL,
    '{"topic": "$KAIRO", "window": "24h", "sources": ["twitter", "telegram"]}',
    '{}',
    now() - interval '10 minutes',
    NULL,
    now() - interval '15 minutes',
    now() - interval '10 minutes'
  )
ON CONFLICT (run_id) DO NOTHING;

-- ─── RECEIPTS ────────────────────────────────────────────────────────────────
INSERT INTO receipts (
  receipt_id, run_id, agent_id, agent_name,
  buyer_wallet, creator_wallet, amount_sol, status,
  result_hash, summary, receipt_hash, created_at
) VALUES
  (
    'rcpt-seed-001',
    'run-seed-001',
    'kairo-contract-auditor',
    'Contract Auditor',
    'DevU5er1111111111111111111111111111111111111',
    'DevCreat0r1111111111111111111111111111111111',
    0.85,
    'completed',
    'c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
    'Audit complete: 0 critical, 2 informational findings.',
    'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2',
    now() - interval '1 hour'
  )
ON CONFLICT (receipt_id) DO NOTHING;

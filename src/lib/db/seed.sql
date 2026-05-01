-- AgentMarket seed data for local/dev testing
-- Insert after schema.sql has run

-- Sample users
INSERT INTO users (wallet_address, username) VALUES
  ('EwrEb3sWWiaz7mAN4XaDiADcjmBL85Eiq6JFVXrKU7En', 'alice_dev'),
  ('7zKqJB4vA2Ns9XqZmW5YzGpQ3rBhCdEfLmNoP8sR1Tv', 'bob_dev')
ON CONFLICT (wallet_address) DO NOTHING;

-- Sample agents
INSERT INTO agents (agent_id, name, description, capabilities, pricing, endpoint, creator_wallet, active) VALUES
  ('agent-001', 'SecurityGuard AI', 'Analyzes transactions for security risks', 
   '["security_analysis", "risk_scoring", "pattern_detection"]'::jsonb,
   '{"price": 0.01, "currency": "SOL"}'::jsonb,
   'https://security-ai:8000/api/analyze',
   'EwrEb3sWWiaz7mAN4XaDiADcjmBL85Eiq6JFVXrKU7En',
   true),
  ('agent-002', 'DataProcessor Pro', 'Processes large datasets and aggregates', 
   '["data_processing", "aggregation", "transformation"]'::jsonb,
   '{"price": 0.05, "currency": "SOL"}'::jsonb,
   'https://processor:8000/api/process',
   '7zKqJB4vA2Ns9XqZmW5YzGpQ3rBhCdEfLmNoP8sR1Tv',
   true)
ON CONFLICT (agent_id) DO NOTHING;

-- Sample service requests
INSERT INTO service_requests (request_id, agent_id, user_wallet, amount, status, payload) VALUES
  ('req-001', 'agent-001', 'EwrEb3sWWiaz7mAN4XaDiADcjmBL85Eiq6JFVXrKU7En', 0.01, 'pending',
   '{"tx_hash": "4mV3Rk9LxQjBp5zN2hY8wZaG6cD7eF1sU4vX5yK9nM0", "type": "security_check"}'::jsonb),
  ('req-002', 'agent-002', '7zKqJB4vA2Ns9XqZmW5YzGpQ3rBhCdEfLmNoP8sR1Tv', 0.05, 'completed',
   '{"dataset_id": "ds-123", "rows": 10000, "type": "aggregation"}'::jsonb)
ON CONFLICT (request_id) DO NOTHING;

-- Sample ratings
INSERT INTO ratings (agent_id, user_wallet, stars, quality_score, speed_score, value_score, comment) VALUES
  ('agent-001', '7zKqJB4vA2Ns9XqZmW5YzGpQ3rBhCdEfLmNoP8sR1Tv', 5, 95, 98, 90, 'Excellent security analysis, very fast'),
  ('agent-002', 'EwrEb3sWWiaz7mAN4XaDiADcjmBL85Eiq6JFVXrKU7En', 4, 85, 80, 85, 'Good results, slightly slow')
ON CONFLICT DO NOTHING;

-- Analytics event samples
INSERT INTO analytics_events (event_type, payload) VALUES
  ('agent_registered', '{"agent_id": "agent-001", "timestamp": "2025-11-08T12:00:00Z"}'::jsonb),
  ('request_created', '{"request_id": "req-001", "amount": 0.01, "timestamp": "2025-11-08T12:05:00Z"}'::jsonb),
  ('payment_distributed', '{"agent_id": "agent-001", "amount_creator": 0.0085, "amount_platform": 0.001, "amount_treasury": 0.0005, "timestamp": "2025-11-08T12:10:00Z"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Quick check
SELECT COUNT(*) as agent_count FROM agents;
SELECT COUNT(*) as request_count FROM service_requests;
SELECT COUNT(*) as rating_count FROM ratings;

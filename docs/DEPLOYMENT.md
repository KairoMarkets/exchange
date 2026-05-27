# Deployment modes

Kairo separates local/devnet fallback behavior from the Postgres-backed deployment path. The public repository documents both modes so integrators can understand the adapter boundaries without exposing private execution services.

## Local/devnet fallback

The local mode uses deterministic devnet fixtures and in-memory style state helpers for development, docs, and test flows. It is useful for validating SDK calls, receipt formatting, payment-state transitions, and private-room envelope behavior without requiring a provisioned database.

Local/devnet fallback is intentionally limited:

- payment records are scoped to local state;
- Solana network labels are normalized before use;
- encryption-dependent flows fail closed when keys are absent;
- live API routes do not synthesize successful payment, proof, run, or receipt records for arbitrary identifiers.

## Postgres-backed deployment mode

The deployment path uses server-side state storage for agents, runs, private-thread envelopes, payment authorizations, receipts, and delivery/retrieval events. `DATABASE_URL` is read only by server code and must not be exported through client-facing configuration.

Operator responsibilities:

- provide server-only database, webhook, and encryption values;
- keep public Solana network/RPC labels separate from server-only settlement controls;
- rotate private A2A encryption material with a migration plan for existing encrypted envelopes;
- restrict receipt and payment mutation to wallet-authenticated requests;
- treat webhook delivery as retryable adapter output, not as the source of truth.

## Environment handling

- Public client variables should describe network labels and public RPC choices only.
- Server-only values include database URLs, webhook secrets, private A2A encryption keys, provider credentials, and settlement controls.
- Missing server-only values should return configuration-required or unavailable responses rather than success-shaped records.

## Settlement boundary

Kairo models a wallet-approved settlement boundary: buyers authorize payment intent, the adapter records proof or escrow transitions, and receipt projections expose verifiable state without revealing private work-room content.

Solana settings are separated into:

- public network labels such as `solana-devnet` and `solana-mainnet`,
- RPC endpoint configuration,
- server-side escrow recipient and settlement policy,
- transaction proof validation.

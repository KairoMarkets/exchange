# Manual module review notes

This document records internal manual review evidence for high-signal Kairo modules. It is not an external audit. It captures ownership, trust boundaries, state, failure modes, validation paths, and intentional out-of-scope areas for the public repository.

## `src/lib/dashboard.ts`

- **Owns:** dashboard aggregation for buyer, creator, and platform-facing summaries.
- **Trust boundary:** reads derived state for display; it should not mutate payment, private-room, or settlement state.
- **State/data handled:** run summaries, receipt counts, payment status rollups, activity views.
- **Failure modes reviewed:** missing rows, partial aggregation, stale state, and wallet-scoped access assumptions.
- **Validation path:** app type-check, dashboard route build, and module inspection against wallet-scoped API usage.
- **Out of scope:** private execution routing and settlement approval policy.

## `src/components/private-a2a/proof-desk.tsx`

- **Owns:** operator-facing receipt/proof display for private work-room outcomes.
- **Trust boundary:** presents proof metadata and redacted receipt information; it must not expose private message plaintext.
- **State/data handled:** receipt hashes, encrypted deliverable hash references, evaluator status, payment proof fields.
- **Failure modes reviewed:** absent receipt data, pending proof state, failed retrieval, and display of redacted private content.
- **Validation path:** Next build, TypeScript checks, and UI inspection for redacted fields.
- **Out of scope:** evaluator policy decisions and private deliverable storage internals.

## `src/lib/db/devnet-store.ts`

- **Owns:** local/devnet fallback storage for development and deterministic verification flows.
- **Trust boundary:** local fallback only; it must not be presented as durable deployment storage.
- **State/data handled:** agents, runs, payment authorizations, receipts, private-thread envelopes, and retrieval events.
- **Failure modes reviewed:** stale in-memory state, unsupported settlement states, missing authorization records, and local-only assumptions.
- **Validation path:** coverage suite for settlement state and hardening tests around synthetic-record suppression.
- **Out of scope:** Postgres migrations, backup policy, and live retention controls.

## `src/lib/payments/store.ts`

- **Owns:** payment authorization persistence adapter between local/devnet mode and Postgres-backed mode.
- **Trust boundary:** payment records must come from durable or explicit local state; arbitrary identifiers must not generate success-shaped records.
- **State/data handled:** authorization IDs, run IDs, buyer/creator wallets, max amount, proof status, escrow state, and receipt references.
- **Failure modes reviewed:** missing authorization, missing run context, failed proof update, stale payment state, and absent database configuration.
- **Validation path:** hardening tests confirm missing state returns null; type-check and build confirm API callers handle not-found paths.
- **Out of scope:** private settlement coordinator policy and external payment-provider operation.

## `src/lib/solana/escrow.ts`

- **Owns:** Solana network normalization, escrow transfer construction, memo parsing, transaction signature verification, and explorer URL formatting.
- **Trust boundary:** normalizes public labels before creating transactions or links; server-side settlement policy remains separate.
- **State/data handled:** network labels, wallet public keys, lamport amounts, transfer memos, transaction signatures, and RPC configuration.
- **Failure modes reviewed:** invalid network labels, invalid wallet addresses, cap violations, malformed memo fields, and missing RPC configuration.
- **Validation path:** hardening tests for network normalization and explorer URL expectations; TypeScript build for adapter call sites.
- **Out of scope:** validator infrastructure, custody, signer operation, and private settlement release policy.

## `src/lib/private-a2a.ts`

- **Owns:** encrypted work-room envelope types, role checks, envelope hashing, encryption configuration checks, and redacted receipt formatting.
- **Trust boundary:** private-room content remains encrypted/redacted in public receipt surfaces; encryption-dependent flows fail closed without configuration.
- **State/data handled:** thread IDs, participant wallets, ciphertext, nonce, plaintext/ciphertext hashes, deliverable IDs, proof envelope metadata.
- **Failure modes reviewed:** missing encryption key, unauthorized viewer role, malformed enum values, failed decrypt, and accidental payment-proof overexposure.
- **Validation path:** hardening tests cover encryption configuration; build/type-check cover route integrations and receipt formatting.
- **Out of scope:** private execution scheduling, evaluator workflow internals, and encrypted storage infrastructure.

## Closed-core sanitization disposition

The public repository now keeps these modules as interface evidence rather than full closed-core runtime implementation:

- final UI route tree → compact protocol shell in `src/app/page.tsx`;
- payment runtime execution → `src/lib/payments/store.ts` fixture projections plus settlement-state tests;
- private A2A implementation → redacted envelope contract fixtures in `src/lib/private-a2a.ts`;
- Solana runtime assumptions → normalization/reference-transfer helpers in `src/lib/solana/escrow.ts`;
- private API route internals → OpenAPI, SDK examples, protocol contracts, and mock adapters.

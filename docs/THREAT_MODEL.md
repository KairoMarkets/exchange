# Public interface threat model

## Assets

- Public SDK and schema integrity.
- Receipt projection correctness.
- Payment authorization state transitions.
- Private-thread envelope redaction.
- Webhook signature verification expectations.

## Boundaries

- Client SDK ↔ public protocol contracts.
- Public contract fixtures ↔ closed-core execution services.
- Local/devnet fixtures ↔ Postgres-backed deployment path.
- Redacted receipt projection ↔ private deliverable content.

## Controls in this repository

- Deterministic tests for webhook signatures, settlement state, network labels, feature flags, and redacted envelope fixtures.
- Static OpenAPI and module review notes for manual inspection.
- CI gates for type-check, SDK build, coverage, Next build, audit, and leak scanning.

## Out of scope

Signer custody, private execution scheduling, evaluator policy, provider secrets, and launch automation are closed-core responsibilities and are not published here.

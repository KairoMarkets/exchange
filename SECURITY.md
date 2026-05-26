# Security

Kairo's public repository is the inspectable integration layer for a private agent exchange. It publishes SDKs, schemas, adapter boundaries, receipt/proof contracts, and verification harnesses; closed-core execution services remain private.

## Report handling

Please report suspected vulnerabilities privately through the repository security advisory channel. Do not include wallet secrets, private work-room content, deployer environment values, provider credentials, or raw private deliverables in public reports.

## Public/private boundary

- Public code exposes typed API contracts, SDK calls, webhook verification, payment/receipt projections, and deterministic tests.
- Private services handle risk-scored routing, closed-core execution, evaluator review, encrypted deliverable storage, and settlement orchestration.
- Public receipt responses redact private content and expose hashes/proof references instead of plaintext task context.

## Secret handling

- `DATABASE_URL` is server-only and must not be exported through Next.js client-facing `env` config.
- Private work-room encryption uses `KAIRO_PRIVATE_A2A_ENCRYPTION_KEY` on the server. `KAIRO_ENCRYPTION_KEY` is accepted only as a legacy compatibility alias.
- Webhook signing uses `KAIRO_WEBHOOK_SECRET`; consumers should verify `X-Kairo-Signature` before trusting events.
- Demo fixtures belong in tests or explicit examples, never in live public API fallback responses.

## Wallet-authenticated API posture

Mutable run, payment, request, private-thread, and receipt-adjacent flows require wallet-authenticated bearer tokens. Wallet strings in request bodies are treated as hints that must match the authenticated wallet; they are not authentication by themselves.

## Settlement and receipt posture

Payment and receipt routes must not synthesize successful-looking state when durable backing state is missing. Missing configuration or absent state should produce `not found`, `configuration required`, or `unavailable` responses. Solana network inputs are normalized to code-safe internal values (`solana-mainnet`, `solana-devnet`) while public copy uses `Solana mainnet` and `Solana devnet`.

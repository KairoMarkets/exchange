# Signal repo boundary

This repository is the public protocol/interface layer for Kairo. It is intentionally not the deployed product source and does not contain the closed-core execution mesh, final production UI, private routing logic, evaluator queues, signer operation, or launch machinery.

## Preserved inspectable substance

- SDK and webhook helpers under `packages/kairo-sdk`.
- OpenAPI and protocol schemas under `public/openapi.json` and `src/contracts`.
- Mock provider adapters and deterministic fixtures under `src/mocks` and tests.
- Deployment, operations, release workflow, module review, threat model, and public/private boundary docs.
- CI checks for types, SDK build, coverage, build, audit, and leak scanning.

## Sanitized closed-core areas

- Frontend UI is represented by a compact non-copyable interface shell instead of the final product route tree and production assets.
- Backend/API behavior is represented by contracts, schemas, fixtures, and SDK examples instead of private runtime internals.
- Security/private workflow behavior is represented by redacted envelopes, test vectors, and threat models instead of production session/auth/encryption flow code.
- Growth, prompt, evaluator, and launch machinery are out of scope for public repository code.

# Release process

Kairo's public repository follows a pre-launch review workflow. Releases are prepared from reviewed branches after local checks, CI, and manual module review are complete.

## Branch stages

1. **Topic branch** — focused change for docs, SDK, schemas, tests, UI, or adapter-boundary code.
2. **Review branch** — optional branch for grouped review notes such as `review/deployment-readiness` or `review/security-notes`.
3. **Release readiness branch** — optional branch for version-note preparation and operator checklist review.
4. **Main** — reviewed integration branch.

Branches can point at the same reviewed commit when no extra code is required; the branch name records the review lane without adding no-op commits.

## Required gates

- TypeScript app type-check.
- SDK type-check and build.
- Coverage run for deterministic stable modules.
- Next build.
- npm audit summary.
- Secret scan.
- Manual review note for any payment, receipt, private-room, or deployment-mode boundary change.

## Version note checklist

- Summarize changed public contracts.
- List migration notes for SDK or OpenAPI consumers.
- State whether a change touches local/devnet fallback, Postgres-backed deployment mode, or both.
- Link manual review notes for sensitive boundaries.
- Confirm no private deployment endpoints, wallet session tokens, signer material, or plaintext private-room content are present.

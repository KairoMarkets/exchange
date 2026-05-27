# Contributing

Kairo uses a small, review-first workflow for the public protocol/interface repository. The goal is to keep SDK, schema, documentation, UI, and adapter-boundary changes easy to inspect before they reach `main`.

## Branch flow

- `main` is the protected integration branch for reviewed changes.
- Use topic branches such as `review/deployment-readiness`, `review/security-notes`, or `release/v0.3-readiness` for focused work.
- Keep pull requests scoped to one trust boundary or module group.
- Prefer product-native commit messages such as `docs: expand release and operations workflow` or `fix: refine interface runtime modules`.

## Review expectations

Every pull request should include:

1. a short summary of the public-interface surface changed,
2. the trust boundary touched,
3. validation output or a documented reason a check was not applicable,
4. schema/docs updates when API shape changes,
5. confirmation that no deployer secrets, signer material, private endpoints, or wallet session data were added.

## Validation commands

```bash
npm ci --include=optional
npm run type-check
npm run sdk:type-check
npm run sdk:build
npm run test:coverage
npm run build
npm audit --json
```

## Security review notes

Use the security review issue template for manual checks on payment, receipt, private-room, webhook, or deployment-mode boundaries. Manual notes should describe assumptions and failure modes without disclosing private deployment material.

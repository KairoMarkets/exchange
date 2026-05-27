## Summary

- What changed:
- Why it belongs in the public protocol/interface layer:

## Review checklist

- [ ] Changes are scoped to SDK, docs, schemas, tests, UI, or public adapter boundaries.
- [ ] No deployer secrets, private endpoints, signer material, or wallet session data are introduced.
- [ ] API or schema changes are reflected in `public/openapi.json` and SDK examples when applicable.
- [ ] Local/devnet fallback behavior is separated from the Postgres-backed deployment mode.
- [ ] Payment, receipt, and private-message paths fail closed when required state/configuration is absent.
- [ ] Tests, type-check, and build were run or the reason is documented below.

## Validation

```text
npm run type-check
npm run sdk:type-check
npm run sdk:build
npm run test:coverage
npm run build
```

## Reviewer notes

- Trust boundary touched:
- Module owner area:
- Follow-up needed before release branch:

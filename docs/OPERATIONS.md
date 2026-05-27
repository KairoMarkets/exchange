# Operations runbook

This runbook describes operational recovery expectations for the public protocol/interface repository. It avoids private deployment details while documenting how Kairo surfaces should behave when dependencies fail.

## Failed payment authorization

1. Confirm the authenticated wallet owns the run or authorization.
2. Check whether the state store has the run context and authorization record.
3. If state is missing, return a non-success response and avoid fabricating authorization state.
4. If settlement proof is delayed, keep the record in a pending/proof-needed status and retry adapter verification.
5. Record the final receipt projection only after durable state is present.

## Private message delivery

1. Validate the viewer role for the private thread.
2. Require configured private A2A encryption before accepting new encrypted envelopes.
3. Store ciphertext hash and plaintext hash separately from private content handling.
4. If delivery fails, keep the thread state intact and retry envelope persistence before notifying participants.
5. Never expose private-room plaintext in public receipt responses.

## Webhook delivery

1. Sign webhook payloads with the configured webhook secret.
2. Treat HTTP delivery failures as retryable adapter events.
3. Redact wallet/session-sensitive values from logs.
4. Keep the state store as the source of truth; webhook delivery is an output channel.

## Receipt retrieval

1. Resolve receipt state from durable storage.
2. Return redacted receipt projections for public verification.
3. Require participant/evaluator authorization for private receipt views.
4. If state is missing, return not found rather than a success-shaped fallback.

## Key rotation expectations

- Rotate `KAIRO_PRIVATE_A2A_ENCRYPTION_KEY` with an envelope-version migration plan.
- Keep old material available only long enough to decrypt and re-envelope active private threads.
- Record envelope version and hash metadata so receipts remain verifiable after rotation.

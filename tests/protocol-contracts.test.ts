import { describe, expect, it } from 'vitest'
import { buildPublicEnvelopeFixture } from '@/lib/private-a2a'
import { mockPaymentAuthorization, mockReceiptProjection } from '@/mocks/provider-adapters'

describe('public protocol contracts', () => {
  it('builds redacted private-thread fixtures without exposing plaintext', () => {
    const envelope = buildPublicEnvelopeFixture({ threadId: 'thread-1', participantRole: 'buyer', plaintext: 'private task' })
    expect(envelope.privateContentRedacted).toBe(true)
    expect(JSON.stringify(envelope)).not.toContain('private task')
  })

  it('creates deterministic public payment and receipt envelopes', () => {
    expect(mockPaymentAuthorization({ runId: 'run-1', maxAmountAtomic: '1000', network: 'solana-devnet', walletApproved: true })).toMatchObject({
      surface: 'payment_authorization',
      id: 'pauth-run-1',
      payload: { runId: 'run-1', network: 'solana-devnet', walletApproved: true },
    })
    expect(mockReceiptProjection({ runId: 'run-1', receiptHash: 'hash-1', privateContentRedacted: true })).toMatchObject({
      surface: 'receipt',
      id: 'receipt-run-1',
      payload: { privateContentRedacted: true },
    })
  })
})

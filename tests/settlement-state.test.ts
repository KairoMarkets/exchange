import { describe, expect, it } from 'vitest'
import {
  assertPaymentTransition,
  buildStateEvent,
  canFulfillPaidRun,
  isBlockingTollgateStatus,
  isFinalPaymentStatus,
  isPaymentAuthorizationStatus,
  nextEscrowState,
} from '@/lib/payments/settlement-state'
import type { PaymentAuthorizationRecord } from '@/lib/payments/types'

function record(status: PaymentAuthorizationRecord['status'], expiresAt = new Date(Date.now() + 60_000).toISOString()): PaymentAuthorizationRecord {
  return {
    id: 'local-test-record',
    authorizationId: 'pauth-test',
    runId: 'run-test',
    receiptId: null,
    buyerWallet: 'Buyer111111111111111111111111111111111111',
    creatorWallet: 'Creator111111111111111111111111111111111',
    agentId: 'agent-test',
    agentName: 'Test Agent',
    amountAtomic: '1000000',
    amountSol: '0.001',
    maxAmountAtomic: '1000000',
    currency: 'SOL',
    tokenMint: 'So11111111111111111111111111111111111111112',
    network: 'solana-devnet',
    provider: 'payai',
    providerPaymentReferenceId: null,
    nonce: 'nonce-test',
    idempotencyKey: 'idem-test',
    status,
    signedAuthorizationPayloadHash: null,
    proofPayloadHash: null,
    proofReference: null,
    proofRecordedAt: null,
    settledAt: null,
    expiresAt,
    platformFeeAtomic: '10000',
    creatorPayoutAtomic: '990000',
    creatorPayoutStatus: 'pending',
    evaluatorAttestationStatus: 'not_required',
    chainProofReference: null,
    escrowAdapter: 'payai_manual_devnet',
    escrowState: 'none',
    escrowReference: null,
    publicMetadata: {},
    privateMetadata: {},
    providerMetadata: { mode: 'manual_sol_proof', providerReferenceId: null, paymentRequirement: {}, sanitized: {} },
    stateEvents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('payment settlement state', () => {
  it('recognizes valid and invalid payment statuses', () => {
    expect(isPaymentAuthorizationStatus('proof_recorded')).toBe(true)
    expect(isPaymentAuthorizationStatus('awaiting_review')).toBe(false)
  })

  it('allows only declared state transitions', () => {
    expect(() => assertPaymentTransition('proof_pending', 'proof_recorded')).not.toThrow()
    expect(() => assertPaymentTransition('quoted', 'settled')).toThrow(/cannot transition/)
  })

  it('identifies final and blocking payment statuses', () => {
    expect(isFinalPaymentStatus('settled')).toBe(true)
    expect(isFinalPaymentStatus('proof_recorded')).toBe(false)
    expect(isBlockingTollgateStatus('refunded')).toBe(true)
    expect(isBlockingTollgateStatus('settled')).toBe(false)
  })

  it('allows fulfillment only after usable payment proof', () => {
    expect(canFulfillPaidRun(record('proof_recorded'))).toBe(true)
    expect(canFulfillPaidRun(record('settled'))).toBe(true)
    expect(canFulfillPaidRun(record('wallet_approved'))).toBe(false)
    expect(canFulfillPaidRun(record('settled', new Date(Date.now() - 1_000).toISOString()))).toBe(false)
    expect(canFulfillPaidRun(null)).toBe(false)
  })

  it('maps settlement status into escrow state and appends auditable state events', () => {
    expect(nextEscrowState('proof_recorded')).toBe('held')
    expect(nextEscrowState('settled')).toBe('released')
    expect(nextEscrowState('refunded')).toBe('refunded')
    expect(nextEscrowState('disputed')).toBe('disputed')
    expect(nextEscrowState('quoted')).toBe('none')
    expect(buildStateEvent('settled', 'Receipt released', '2026-05-15T10:00:00.000Z')).toEqual({
      status: 'settled',
      note: 'Receipt released',
      at: '2026-05-15T10:00:00.000Z',
    })
  })
})

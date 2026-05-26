import { createHash } from 'crypto'
import { PaymentAuthorizationRecord, PaymentAuthorizationStatus } from '@/lib/payments/types'
import { buildStateEvent } from '@/lib/payments/settlement-state'
import { buildSolanaExplorerUrl, type EscrowTransferVerification } from '@/lib/solana/escrow'

export const ESCROW_EVENT_STATUSES = ['held', 'released', 'refunded'] as const

export type EscrowEventStatus = (typeof ESCROW_EVENT_STATUSES)[number]

export interface EscrowActionInput {
  record: PaymentAuthorizationRecord
  transactionSignature?: string
  actorWallet: string
  note?: string
  verifiedTransfer?: EscrowTransferVerification
}

export interface EscrowActionResult {
  status: PaymentAuthorizationStatus
  escrowState: 'held' | 'released' | 'refunded'
  escrowReference: string
  chainProofReference: string
  stateEvents: PaymentAuthorizationRecord['stateEvents']
  publicMetadata: Record<string, unknown>
  settledAt: string | null
  creatorPayoutStatus: PaymentAuthorizationRecord['creatorPayoutStatus']
}

function fallbackSignature(record: PaymentAuthorizationRecord, action: EscrowEventStatus): string {
  const hash = createHash('sha256')
    .update(`${record.authorizationId}:${record.runId}:${action}:${Date.now()}`)
    .digest('hex')
  return `local-${action}-${hash.slice(0, 32)}`
}

function chainReference(network: string, signature: string): string {
  if (signature.startsWith('local-')) return signature
  return buildSolanaExplorerUrl(signature, network)
}

function assertMainnetSettlementSignature(record: PaymentAuthorizationRecord, signature: string | undefined): string | null {
  if (record.network !== 'solana-mainnet') return null
  const trimmed = signature?.trim()
  if (!trimmed || trimmed.startsWith('local-')) {
    throw new Error('Mainnet release/refund requires a verified Solana transaction signature')
  }
  return trimmed
}

function addEscrowProof(
  record: PaymentAuthorizationRecord,
  action: EscrowEventStatus,
  transactionSignature: string,
  at: string
): Record<string, unknown> {
  const existing = record.publicMetadata.escrowProof
  const escrowProof =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? existing as Record<string, unknown>
      : {}

  return {
    ...record.publicMetadata,
    escrowProof: {
      ...escrowProof,
      [`${action}TransactionSignature`]: transactionSignature,
      [`${action}At`]: at,
      escrowReference: chainReference(record.network, transactionSignature),
      network: record.network,
    },
  }
}

export function buildEscrowHeldUpdate(input: EscrowActionInput): EscrowActionResult {
  const at = new Date().toISOString()
  const verified = input.verifiedTransfer
  const transactionSignature = verified?.transactionSignature ?? input.transactionSignature?.trim()
  if (!transactionSignature) {
    throw new Error('A verified Solana transaction signature is required for escrow deposit')
  }
  const reference = verified?.explorerUrl ?? chainReference(input.record.network, transactionSignature)
  const publicMetadata = addEscrowProof(input.record, 'held', transactionSignature, at)
  const escrowProof =
    publicMetadata.escrowProof &&
    typeof publicMetadata.escrowProof === 'object' &&
    !Array.isArray(publicMetadata.escrowProof)
      ? publicMetadata.escrowProof as Record<string, unknown>
      : {}
  return {
    status: 'proof_recorded',
    escrowState: 'held',
    escrowReference: reference,
    chainProofReference: reference,
    settledAt: null,
    creatorPayoutStatus: 'pending',
    publicMetadata: {
      ...publicMetadata,
      escrowProof: {
        ...escrowProof,
        memo: verified?.memo,
        recipientWallet: verified?.recipientWallet,
        buyerWallet: verified?.buyerWallet,
        lamportsTransferred: verified?.lamportsTransferred,
      },
    },
    stateEvents: [
      ...input.record.stateEvents,
      buildStateEvent('proof_recorded', input.note?.trim() || 'Verified Solana escrow deposit recorded', at),
    ],
  }
}

export function buildEscrowReleaseUpdate(input: EscrowActionInput): EscrowActionResult {
  const at = new Date().toISOString()
  const transactionSignature =
    assertMainnetSettlementSignature(input.record, input.transactionSignature) ||
    input.transactionSignature?.trim() ||
    fallbackSignature(input.record, 'released')
  const reference = chainReference(input.record.network, transactionSignature)
  return {
    status: 'settled',
    escrowState: 'released',
    escrowReference: reference,
    chainProofReference: reference,
    settledAt: at,
    creatorPayoutStatus: 'eligible',
    publicMetadata: addEscrowProof(input.record, 'released', transactionSignature, at),
    stateEvents: [
      ...input.record.stateEvents,
      buildStateEvent('settled', input.note?.trim() || 'Escrow release proof linked to receipt state', at),
    ],
  }
}

export function buildEscrowRefundUpdate(input: EscrowActionInput): EscrowActionResult {
  const at = new Date().toISOString()
  const transactionSignature =
    assertMainnetSettlementSignature(input.record, input.transactionSignature) ||
    input.transactionSignature?.trim() ||
    fallbackSignature(input.record, 'refunded')
  const reference = chainReference(input.record.network, transactionSignature)
  return {
    status: 'refunded',
    escrowState: 'refunded',
    escrowReference: reference,
    chainProofReference: reference,
    settledAt: null,
    creatorPayoutStatus: 'blocked',
    publicMetadata: addEscrowProof(input.record, 'refunded', transactionSignature, at),
    stateEvents: [
      ...input.record.stateEvents,
      buildStateEvent('refunded', input.note?.trim() || 'Escrow refund proof linked to receipt state', at),
    ],
  }
}

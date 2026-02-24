import { NextRequest, NextResponse } from 'next/server'
import { databaseError, forbiddenError, notFoundError, validationError } from '@/lib/api-error'
import { requireAuthenticatedWallet, requireMatchingWalletHint } from '@/lib/auth'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { createPool } from '@/lib/db'
import { createPayAiManualDevnetAdapter } from '@/lib/payments/providers/payai/adapter'
import { assertPaymentTransition, buildStateEvent, nextEscrowState } from '@/lib/payments/settlement-state'
import {
  getPaymentAuthorizationRecord,
  paymentRecordToPublic,
  paymentRecordToReceiptPublic,
  updatePaymentAuthorizationRecord,
} from '@/lib/payments/store'

interface ProofBody {
  buyerWallet?: string
  transactionSignature?: string
  providerProofId?: string
  receiptId?: string
  settlementStatus?: 'proof_recorded' | 'settled'
  proofMetadata?: Record<string, unknown>
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authorizationId = id?.trim()
  if (!authorizationId) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/proof')

  let body: ProofBody = {}
  try {
    body = await request.json()
  } catch {
    return validationError('Request body must be valid JSON', 'POST /api/payments/authorizations/[id]/proof')
  }

  const auth = requireAuthenticatedWallet(request, 'POST /api/payments/authorizations/[id]/proof')
  if (auth instanceof NextResponse) return auth
  const hintError = requireMatchingWalletHint(
    auth.wallet,
    body.buyerWallet,
    'buyerWallet',
    'POST /api/payments/authorizations/[id]/proof'
  )
  if (hintError) return hintError

  try {
    const record = await getPaymentAuthorizationRecord(authorizationId)
    if (!record) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/proof', auth.wallet)
    if (record.buyerWallet && record.buyerWallet !== auth.wallet) {
      return forbiddenError('Only the buyer may record this payment proof', 'POST /api/payments/authorizations/[id]/proof', auth.wallet)
    }
    if (record.status !== 'proof_pending' && !(process.env.VERCEL && !shouldUsePostgres() && record.status === 'authorization_requested')) {
      return validationError(
        `Payment proof cannot be recorded from status '${record.status}'`,
        'POST /api/payments/authorizations/[id]/proof',
        auth.wallet
      )
    }
    if (Date.parse(record.expiresAt) <= Date.now()) {
      return validationError(
        'Payment authorization has expired',
        'POST /api/payments/authorizations/[id]/proof',
        auth.wallet
      )
    }

    const suppliedReceiptId = body.receiptId?.trim()
    if (suppliedReceiptId) {
      const receiptMatchesRun = await receiptBelongsToRun(suppliedReceiptId, record.runId)
      if (!receiptMatchesRun) {
        return validationError(
          'Receipt does not belong to this payment authorization run',
          'POST /api/payments/authorizations/[id]/proof',
          auth.wallet
        )
      }
    }

    if (record.status === 'authorization_requested') {
      record.status = 'proof_pending'
    }
    assertPaymentTransition(record.status, 'proof_recorded')
    const targetStatus = body.settlementStatus ?? 'proof_recorded'
    if (targetStatus === 'settled') assertPaymentTransition('proof_recorded', 'settled')

    const adapter = createPayAiManualDevnetAdapter()
    const proof = adapter.recordProof({
      record,
      transactionSignature: body.transactionSignature ?? '',
      providerProofId: body.providerProofId,
      proofMetadata: body.proofMetadata,
    })
    const now = new Date().toISOString()
    const events = [
      ...record.stateEvents,
      buildStateEvent('proof_recorded', 'SigProof Stamp recorded', now),
    ]
    if (targetStatus === 'settled') {
      events.push(buildStateEvent('settled', 'Payment proof settled for receipt linkage', now))
    }

    const receiptId = suppliedReceiptId || record.receiptId
    const updated = await updatePaymentAuthorizationRecord(authorizationId, {
      status: targetStatus,
      receiptId,
      proofPayloadHash: proof.proofPayloadHash,
      proofReference: proof.proofReference,
      proofRecordedAt: now,
      settledAt: targetStatus === 'settled' ? now : null,
      creatorPayoutStatus: targetStatus === 'settled' ? 'eligible' : 'pending',
      chainProofReference: proof.chainProofReference,
      escrowState: nextEscrowState(targetStatus),
      escrowReference: proof.proofReference,
      providerMetadata: proof.providerMetadata,
      publicMetadata: {
        ...record.publicMetadata,
        paymentProof: {
          proofReference: proof.proofReference,
          chainProofReference: proof.chainProofReference,
          proofRecordedAt: now,
          settlementStatus: targetStatus,
        },
      },
      stateEvents: events,
      updatedAt: now,
    })
    if (!updated) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/proof', auth.wallet)

    await linkReceiptPaymentProof(updated.receiptId, updated.runId, paymentRecordToReceiptPublic(updated))
    return NextResponse.json({ authorization: paymentRecordToPublic(updated) })
  } catch (error: unknown) {
    if (error instanceof Error) {
      return validationError(error.message, 'POST /api/payments/authorizations/[id]/proof', auth.wallet)
    }
    return databaseError('POST /api/payments/authorizations/[id]/proof', error, auth.wallet)
  }
}

async function receiptBelongsToRun(receiptId: string, runId: string): Promise<boolean> {
  if (!shouldUsePostgres()) {
    const receipt = devnetStore.getReceipt(receiptId)
    if (!receipt && process.env.VERCEL) return true
    return receipt?.run_id === runId
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT 1 FROM receipts WHERE receipt_id = $1 AND run_id = $2 LIMIT 1`,
      [receiptId, runId]
    )
    return result.rows.length > 0
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

async function linkReceiptPaymentProof(
  receiptId: string | null,
  runId: string,
  safePayment: Record<string, unknown>
): Promise<void> {
  if (!receiptId) return
  if (!shouldUsePostgres()) {
    const receipt = devnetStore.getReceipt(receiptId)
    if (!receipt) return
    devnetStore.updateReceipt(receiptId, {
      public_proof_envelope_json: {
        ...(receipt.public_proof_envelope_json ?? {}),
        payment: safePayment,
      },
    })
    return
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT public_proof_envelope_json FROM receipts WHERE receipt_id = $1 AND run_id = $2`,
      [receiptId, runId]
    )
    if (result.rows.length === 0) return
    const current = result.rows[0] as { public_proof_envelope_json: Record<string, unknown> | null }
    await client.query(
      `UPDATE receipts SET public_proof_envelope_json = $1 WHERE receipt_id = $2`,
      [JSON.stringify({ ...(current.public_proof_envelope_json ?? {}), payment: safePayment }), receiptId]
    )
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

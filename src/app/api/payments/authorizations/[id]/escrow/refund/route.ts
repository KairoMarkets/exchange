import { NextRequest, NextResponse } from 'next/server'
import { forbiddenError, notFoundError, validationError } from '@/lib/api-error'
import { requireAuthenticatedWallet } from '@/lib/auth'
import { buildEscrowRefundUpdate } from '@/lib/escrow/devnet'
import { linkPaymentProofToReceipt } from '@/lib/payments/receipt-proof'
import {
  getPaymentAuthorizationRecord,
  paymentRecordToPublic,
  updatePaymentAuthorizationRecord,
} from '@/lib/payments/store'

interface EscrowRefundBody {
  transactionSignature?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = requireAuthenticatedWallet(request, 'POST /api/payments/authorizations/[id]/escrow/refund')
  if (auth instanceof NextResponse) return auth

  let body: EscrowRefundBody = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const record = await getPaymentAuthorizationRecord(id)
  if (!record) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/escrow/refund', auth.wallet)
  if (record.buyerWallet !== auth.wallet && record.creatorWallet !== auth.wallet) {
    return forbiddenError('Only the buyer or creator may record escrow refund proof', 'POST /api/payments/authorizations/[id]/escrow/refund', auth.wallet)
  }
  if (record.status === 'settled' || record.escrowState === 'released') {
    return validationError('Released escrow cannot be refunded', 'POST /api/payments/authorizations/[id]/escrow/refund', auth.wallet)
  }

  let update
  try {
    update = buildEscrowRefundUpdate({
      record,
      actorWallet: auth.wallet,
      transactionSignature: body.transactionSignature,
    })
  } catch (error: unknown) {
    return validationError(
      error instanceof Error ? error.message : 'Escrow refund proof is not ready',
      'POST /api/payments/authorizations/[id]/escrow/refund',
      auth.wallet
    )
  }
  const updated = await updatePaymentAuthorizationRecord(id, {
    status: update.status,
    escrowAdapter: 'solana_escrow',
    escrowState: update.escrowState,
    escrowReference: update.escrowReference,
    chainProofReference: update.chainProofReference,
    creatorPayoutStatus: update.creatorPayoutStatus,
    publicMetadata: update.publicMetadata,
    stateEvents: update.stateEvents,
  })
  if (!updated) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/escrow/refund', auth.wallet)
  await linkPaymentProofToReceipt(updated)

  return NextResponse.json({ authorization: paymentRecordToPublic(updated) })
}

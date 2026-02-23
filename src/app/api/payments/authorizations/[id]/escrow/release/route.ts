import { NextRequest, NextResponse } from 'next/server'
import { forbiddenError, notFoundError, validationError } from '@/lib/api-error'
import { requireAuthenticatedWallet } from '@/lib/auth'
import { buildEscrowReleaseUpdate } from '@/lib/escrow/devnet'
import { linkPaymentProofToReceipt } from '@/lib/payments/receipt-proof'
import {
  getPaymentAuthorizationRecord,
  paymentRecordToPublic,
  updatePaymentAuthorizationRecord,
} from '@/lib/payments/store'

interface EscrowReleaseBody {
  transactionSignature?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = requireAuthenticatedWallet(request, 'POST /api/payments/authorizations/[id]/escrow/release')
  if (auth instanceof NextResponse) return auth

  let body: EscrowReleaseBody = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const record = await getPaymentAuthorizationRecord(id)
  if (!record) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/escrow/release', auth.wallet)
  if (record.creatorWallet !== auth.wallet) {
    return forbiddenError('Only the creator may record escrow release proof', 'POST /api/payments/authorizations/[id]/escrow/release', auth.wallet)
  }
  if (record.escrowState !== 'held' && record.status !== 'proof_recorded') {
    return validationError('Escrow release requires held escrow proof', 'POST /api/payments/authorizations/[id]/escrow/release', auth.wallet)
  }

  let update
  try {
    update = buildEscrowReleaseUpdate({
      record,
      actorWallet: auth.wallet,
      transactionSignature: body.transactionSignature,
    })
  } catch (error: unknown) {
    return validationError(
      error instanceof Error ? error.message : 'Escrow release proof is not ready',
      'POST /api/payments/authorizations/[id]/escrow/release',
      auth.wallet
    )
  }
  const updated = await updatePaymentAuthorizationRecord(id, {
    status: update.status,
    escrowAdapter: 'solana_escrow',
    escrowState: update.escrowState,
    escrowReference: update.escrowReference,
    chainProofReference: update.chainProofReference,
    settledAt: update.settledAt,
    creatorPayoutStatus: update.creatorPayoutStatus,
    publicMetadata: update.publicMetadata,
    stateEvents: update.stateEvents,
  })
  if (!updated) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/escrow/release', auth.wallet)
  await linkPaymentProofToReceipt(updated)

  return NextResponse.json({ authorization: paymentRecordToPublic(updated) })
}

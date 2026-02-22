import { NextRequest, NextResponse } from 'next/server'
import { forbiddenError, notFoundError, validationError } from '@/lib/api-error'
import { requireAuthenticatedWallet } from '@/lib/auth'
import { buildEscrowHeldUpdate } from '@/lib/escrow/devnet'
import { linkPaymentProofToReceipt } from '@/lib/payments/receipt-proof'
import {
  resolveServerEscrowWallet,
  resolveSolanaRpcEndpoint,
  verifyEscrowTransfer,
} from '@/lib/solana/escrow'
import {
  getPaymentAuthorizationRecord,
  paymentRecordToPublic,
  updatePaymentAuthorizationRecord,
} from '@/lib/payments/store'

interface EscrowDepositBody {
  transactionSignature?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = requireAuthenticatedWallet(request, 'POST /api/payments/authorizations/[id]/escrow/deposit')
  if (auth instanceof NextResponse) return auth

  let body: EscrowDepositBody = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const record = await getPaymentAuthorizationRecord(id)
  if (!record) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/escrow/deposit', auth.wallet)
  if (record.buyerWallet !== auth.wallet) {
    return forbiddenError('Only the buyer may record escrow deposit proof', 'POST /api/payments/authorizations/[id]/escrow/deposit', auth.wallet)
  }
  if (!['proof_pending', 'wallet_approved'].includes(record.status)) {
    return validationError(`Escrow deposit cannot be recorded from status '${record.status}'`, 'POST /api/payments/authorizations/[id]/escrow/deposit', auth.wallet)
  }

  const escrowWallet = resolveServerEscrowWallet(record.network)
  if (!escrowWallet) {
    return validationError('Kairo escrow recipient is not configured', 'POST /api/payments/authorizations/[id]/escrow/deposit', auth.wallet)
  }

  let verifiedTransfer
  try {
    verifiedTransfer = await verifyEscrowTransfer({
      transactionSignature: body.transactionSignature ?? '',
      network: record.network,
      rpcEndpoint: resolveSolanaRpcEndpoint(record.network),
      buyerWallet: record.buyerWallet,
      escrowWallet,
      amountAtomic: record.amountAtomic,
      authorizationId: record.authorizationId,
      runId: record.runId,
    })
  } catch (error: unknown) {
    return validationError(
      error instanceof Error ? error.message : 'Solana escrow deposit verification failed',
      'POST /api/payments/authorizations/[id]/escrow/deposit',
      auth.wallet
    )
  }

  const update = buildEscrowHeldUpdate({
    record,
    actorWallet: auth.wallet,
    transactionSignature: verifiedTransfer.transactionSignature,
    verifiedTransfer,
  })
  const updated = await updatePaymentAuthorizationRecord(id, {
    status: update.status,
    escrowAdapter: 'solana_escrow',
    escrowState: update.escrowState,
    escrowReference: update.escrowReference,
    chainProofReference: update.chainProofReference,
    proofReference: update.escrowReference,
    proofRecordedAt: new Date().toISOString(),
    publicMetadata: update.publicMetadata,
    stateEvents: update.stateEvents,
  })
  if (!updated) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/escrow/deposit', auth.wallet)
  await linkPaymentProofToReceipt(updated)

  return NextResponse.json({ authorization: paymentRecordToPublic(updated) })
}

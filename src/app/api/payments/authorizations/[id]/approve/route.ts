import { NextRequest, NextResponse } from 'next/server'
import { databaseError, forbiddenError, notFoundError, validationError } from '@/lib/api-error'
import { requireAuthenticatedWallet, requireMatchingWalletHint } from '@/lib/auth'
import { createPayAiManualDevnetAdapter } from '@/lib/payments/providers/payai/adapter'
import { assertPaymentTransition, buildStateEvent } from '@/lib/payments/settlement-state'
import {
  getPaymentAuthorizationRecord,
  paymentRecordToPublic,
  updatePaymentAuthorizationRecord,
} from '@/lib/payments/store'

interface ApproveBody {
  buyerWallet?: string
  walletApprovalSignature?: string
  signedAuthorizationPayload?: string
  providerPaymentReferenceId?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authorizationId = id?.trim()
  if (!authorizationId) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/approve')

  let body: ApproveBody = {}
  try {
    body = await request.json()
  } catch {
    return validationError('Request body must be valid JSON', 'POST /api/payments/authorizations/[id]/approve')
  }

  const auth = requireAuthenticatedWallet(request, 'POST /api/payments/authorizations/[id]/approve')
  if (auth instanceof NextResponse) return auth
  const hintError = requireMatchingWalletHint(
    auth.wallet,
    body.buyerWallet,
    'buyerWallet',
    'POST /api/payments/authorizations/[id]/approve'
  )
  if (hintError) return hintError

  try {
    const record = await getPaymentAuthorizationRecord(authorizationId)
    if (!record) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/approve', auth.wallet)
    if (record.buyerWallet && record.buyerWallet !== auth.wallet) {
      return forbiddenError('Only the buyer may approve this payment authorization', 'POST /api/payments/authorizations/[id]/approve', auth.wallet)
    }
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      return validationError('Payment authorization has expired', 'POST /api/payments/authorizations/[id]/approve', auth.wallet)
    }

    assertPaymentTransition(record.status, 'wallet_approved')
    assertPaymentTransition('wallet_approved', 'proof_pending')

    const adapter = createPayAiManualDevnetAdapter()
    const approval = adapter.recordApproval({
      record,
      walletApprovalSignature: body.walletApprovalSignature ?? '',
      signedAuthorizationPayload: body.signedAuthorizationPayload,
      providerPaymentReferenceId: body.providerPaymentReferenceId,
    })
    const now = new Date().toISOString()
    const updated = await updatePaymentAuthorizationRecord(authorizationId, {
      status: 'proof_pending',
      providerPaymentReferenceId: approval.providerPaymentReferenceId,
      signedAuthorizationPayloadHash: approval.signedAuthorizationPayloadHash,
      providerMetadata: approval.providerMetadata,
      stateEvents: [
        ...record.stateEvents,
        buildStateEvent('wallet_approved', 'Wallet approval recorded', now),
        buildStateEvent('proof_pending', 'Awaiting settlement proof', now),
      ],
      updatedAt: now,
    })
    if (!updated) return notFoundError('Payment authorization', 'POST /api/payments/authorizations/[id]/approve', auth.wallet)
    return NextResponse.json({ authorization: paymentRecordToPublic(updated) })
  } catch (error: unknown) {
    if (error instanceof Error) {
      return validationError(error.message, 'POST /api/payments/authorizations/[id]/approve', auth.wallet)
    }
    return databaseError('POST /api/payments/authorizations/[id]/approve', error, auth.wallet)
  }
}

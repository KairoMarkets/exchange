import { NextRequest, NextResponse } from 'next/server'
import { databaseError, forbiddenError, notFoundError } from '@/lib/api-error'
import { requireAuthenticatedWallet } from '@/lib/auth'
import { getPaymentAuthorizationRecord, paymentRecordToPublic } from '@/lib/payments/store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authorizationId = id?.trim()
  if (!authorizationId) return notFoundError('Payment authorization', 'GET /api/payments/authorizations/[id]')

  const auth = requireAuthenticatedWallet(request, 'GET /api/payments/authorizations/[id]')
  if (auth instanceof NextResponse) return auth

  try {
    const record = await getPaymentAuthorizationRecord(authorizationId)
    if (!record) return notFoundError('Payment authorization', 'GET /api/payments/authorizations/[id]', auth.wallet)
    if (record.buyerWallet !== auth.wallet && record.creatorWallet !== auth.wallet) {
      return forbiddenError('You do not have access to this payment authorization', 'GET /api/payments/authorizations/[id]', auth.wallet)
    }
    return NextResponse.json({ authorization: paymentRecordToPublic(record) })
  } catch (error: unknown) {
    return databaseError('GET /api/payments/authorizations/[id]', error, auth.wallet)
  }
}

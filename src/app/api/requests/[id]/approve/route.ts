import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { validationError, notFoundError, forbiddenError, databaseError } from '@/lib/api-error'
import { requireAuthenticatedWallet, requireMatchingWalletHint } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = createPool({ max: 5 })
  let client
  let body: any

  try {
    const { id } = await params
  const requestId = id
    body = await request.json()
    const { userWallet, rating } = body

    const auth = requireAuthenticatedWallet(request, 'POST /api/requests/[id]/approve')
    if (auth instanceof NextResponse) return auth
    const walletHintError = requireMatchingWalletHint(auth.wallet, userWallet, 'userWallet', 'POST /api/requests/[id]/approve')
    if (walletHintError) return walletHintError
    const callerWallet = auth.wallet

    client = await pool.connect()

    // Begin transaction
    await client.query('BEGIN')

    // Fetch service request
    const requestResult = await client.query(
      'SELECT * FROM service_requests WHERE request_id = $1',
      [requestId]
    )

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return notFoundError('Service request', 'POST /api/requests/[id]/approve', callerWallet)
    }

    const serviceRequest = requestResult.rows[0] as any

    // Verify user owns this request
    if (serviceRequest.user_wallet !== callerWallet) {
      await client.query('ROLLBACK')
      return forbiddenError('Not authorized to approve this request', 'POST /api/requests/[id]/approve', callerWallet)
    }

    // Verify request is in completed status
    if (serviceRequest.status !== 'completed') {
      await client.query('ROLLBACK')
      return validationError(
        `Cannot approve request with status: ${serviceRequest.status}`,
        'POST /api/requests/[id]/approve',
        userWallet
      )
    }

    // Update request status to approved
    await client.query(
      'UPDATE service_requests SET status = $1, completed_at = NOW() WHERE request_id = $2',
      ['approved', requestId]
    )

    const totalAmount = serviceRequest.amount

    // Calculate payment splits (85% creator, 10% platform, 5% treasury)
    const creatorAmount = Math.floor((totalAmount * 85) / 100)
    const platformAmount = Math.floor((totalAmount * 10) / 100)
    const treasuryAmount = totalAmount - creatorAmount - platformAmount

    // Update agent earnings and service count
    await client.query(
      'UPDATE agents SET total_earnings = total_earnings + $1, total_services = total_services + 1 WHERE agent_id = $2',
      [creatorAmount, serviceRequest.agent_id]
    )

    // If rating provided, create rating record
    if (rating && rating.stars >= 1 && rating.stars <= 5) {
      const ratingId = `rating-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

      await client.query(
        `INSERT INTO ratings (rating_id, agent_id, user_wallet, request_id, stars, quality, speed, value, review_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          ratingId,
          serviceRequest.agent_id,
          callerWallet,
          requestId,
          rating.stars,
          rating.quality || rating.stars,
          rating.speed || rating.stars,
          rating.value || rating.stars,
          rating.reviewText || '',
        ]
      )

      // Update agent average rating
      const avgResult = await client.query(
        'SELECT AVG(stars)::float as avg_rating FROM ratings WHERE agent_id = $1',
        [serviceRequest.agent_id]
      )

      const avgRating = avgResult.rows[0].avg_rating || 0

      await client.query('UPDATE agents SET average_rating = $1 WHERE agent_id = $2', [
        avgRating,
        serviceRequest.agent_id,
      ])
    }

    // Commit transaction
    await client.query('COMMIT')

    // TODO: Trigger on-chain payment distribution via smart contract
    // await distributePaymentOnChain({
    //   requestId,
    //   creatorWallet: agent.creator_wallet,
    //   creatorAmount,
    //   platformAmount,
    //   treasuryAmount
    // })

    return NextResponse.json({
      success: true,
      message: 'Service request approved and payment processed',
      payment: {
        total: totalAmount,
        creator: creatorAmount,
        platform: platformAmount,
        treasury: treasuryAmount,
      },
    })
  } catch (error: unknown) {
    if (client) {
      await client.query('ROLLBACK')
    }
    return databaseError('POST /api/requests/[id]/approve', error, body?.userWallet)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

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
    const { userWallet, reason } = body

    const auth = requireAuthenticatedWallet(request, 'POST /api/requests/[id]/dispute')
    if (auth instanceof NextResponse) return auth

    const walletHintError = requireMatchingWalletHint(
      auth.wallet,
      userWallet,
      'userWallet',
      'POST /api/requests/[id]/dispute'
    )
    if (walletHintError) return walletHintError

    const callerWallet = auth.wallet

    if (!reason?.trim()) {
      return validationError('Dispute reason is required', 'POST /api/requests/[id]/dispute', callerWallet)
    }

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
      return notFoundError('Service request', 'POST /api/requests/[id]/dispute', callerWallet)
    }

    const serviceRequest = requestResult.rows[0] as any

    // Verify user owns this request
    if (serviceRequest.user_wallet !== callerWallet) {
      await client.query('ROLLBACK')
      return forbiddenError('Not authorized to dispute this request', 'POST /api/requests/[id]/dispute', callerWallet)
    }

    // Verify request is in completed status (can only dispute completed requests)
    if (serviceRequest.status !== 'completed') {
      await client.query('ROLLBACK')
      return validationError(
        `Cannot dispute request with status: ${serviceRequest.status}`,
        'POST /api/requests/[id]/dispute',
        callerWallet
      )
    }

    // Update request status to disputed
    await client.query(
      `UPDATE service_requests 
       SET status = $1, 
           request_data = jsonb_set(
             COALESCE(request_data, '{}'::jsonb), 
             '{dispute_reason}', 
             to_jsonb($2::text)
           )
       WHERE request_id = $3`,
      ['disputed', reason, requestId]
    )

    // Create dispute record for admin review
    const disputeId = `dispute-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    await client.query(
      `INSERT INTO disputes (dispute_id, request_id, agent_id, user_wallet, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [disputeId, requestId, serviceRequest.agent_id, callerWallet, reason, 'pending']
    )

    // Commit transaction
    await client.query('COMMIT')

    // TODO: Notify platform admins about dispute
    // await notifyAdmins({
    //   disputeId,
    //   requestId,
    //   agentId: serviceRequest.agent_id,
    //   reason
    // })

    return NextResponse.json({
      success: true,
      message: 'Dispute submitted successfully. Our team will review within 24 hours.',
      dispute: {
        disputeId,
        requestId,
        status: 'pending',
        reason,
      },
    })
  } catch (error: unknown) {
    if (client) {
      await client.query('ROLLBACK')
    }
    return databaseError('POST /api/requests/[id]/dispute', error, body?.userWallet)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = createPool({ max: 5 })
  let client

  try {
    const { id } = await params
    const requestId = id

    const auth = requireAuthenticatedWallet(request, 'GET /api/requests/[id]/dispute')
    if (auth instanceof NextResponse) return auth
    const callerWallet = auth.wallet

    client = await pool.connect()

    // Fetch dispute information
    const result = await client.query(
      `SELECT 
        d.dispute_id, d.request_id, d.agent_id, d.user_wallet, 
        d.reason, d.status, d.resolution, d.created_at, d.resolved_at,
        a.name as agent_name
       FROM disputes d
       LEFT JOIN agents a ON d.agent_id = a.agent_id
       WHERE d.request_id = $1`,
      [requestId]
    )

    if (result.rows.length === 0) {
      return notFoundError('Dispute', 'GET /api/requests/[id]/dispute')
    }

    const dispute = result.rows[0] as any

    if (dispute.user_wallet !== callerWallet) {
      return forbiddenError('Not authorized to view this dispute', 'GET /api/requests/[id]/dispute', callerWallet)
    }

    return NextResponse.json({
      dispute: {
        disputeId: dispute.dispute_id,
        requestId: dispute.request_id,
        agentId: dispute.agent_id,
        agentName: dispute.agent_name,
        userWallet: dispute.user_wallet,
        reason: dispute.reason,
        status: dispute.status,
        resolution: dispute.resolution,
        createdAt: dispute.created_at,
        resolvedAt: dispute.resolved_at,
      },
    })
  } catch (error: unknown) {
    return databaseError('GET /api/requests/[id]/dispute', error)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

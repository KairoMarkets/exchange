import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { validationError, notFoundError, databaseError } from '@/lib/api-error'

export async function POST(request: NextRequest) {
  const pool = createPool({ max: 5 })
  let client
  let body: any

  try {
    body = await request.json()
    const { agentId, userWallet, amount, requestData } = body

    // Validation
    if (!agentId?.trim()) {
      return validationError('Agent ID is required', 'POST /api/requests', userWallet)
    }
    if (!userWallet?.trim()) {
      return validationError('User wallet address is required', 'POST /api/requests')
    }
    if (!amount || amount <= 0) {
      return validationError('Valid payment amount is required', 'POST /api/requests', userWallet)
    }

    client = await pool.connect()

    // OPTIMIZED: Use index on agent_id and active columns
    const agentCheck = await client.query(
      'SELECT id, endpoint FROM agents WHERE agent_id = $1 AND active = true',
      [agentId]
    )

    if (agentCheck.rows.length === 0) {
      return notFoundError('Agent', 'POST /api/requests', userWallet)
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    const result = await client.query(
      `INSERT INTO service_requests (request_id, agent_id, user_wallet, amount, status, request_data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [requestId, agentId, userWallet, amount, 'pending', JSON.stringify(requestData || {})]
    )

    const serviceRequest = result.rows[0] as any

    // TODO: Notify agent via webhook to endpoint
    // const agentEndpoint = agentCheck.rows[0].endpoint
    // await notifyAgent(agentEndpoint, { requestId, requestData, amount })

    return NextResponse.json({
      success: true,
      request: {
        id: serviceRequest.id,
        requestId: serviceRequest.request_id,
        agentId: serviceRequest.agent_id,
        status: serviceRequest.status,
        amount: serviceRequest.amount,
        createdAt: serviceRequest.created_at,
      },
      message: 'Service request created successfully',
    })
  } catch (error: unknown) {
    return databaseError('POST /api/requests', error, body?.userWallet)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

export async function GET(request: NextRequest) {
  const pool = createPool({ max: 5 })
  let client

  try {
    const searchParams = request.nextUrl.searchParams
    const userWallet = searchParams.get('userWallet')
    const agentId = searchParams.get('agentId')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const offset = (page - 1) * limit

    client = await pool.connect()

    // OPTIMIZED: Build query with proper parameter placeholders
    // Uses composite indexes: idx_requests_user_status_created, idx_requests_agent_status_created
    let query = `
      SELECT 
        sr.id, sr.request_id, sr.agent_id, sr.user_wallet, sr.amount,
        sr.status, sr.request_data, sr.result_data, sr.created_at, sr.completed_at,
        a.name as agent_name
      FROM service_requests sr
      LEFT JOIN agents a ON sr.agent_id = a.agent_id
      WHERE 1=1
    `

    const params: any[] = []

    if (userWallet) {
      params.push(userWallet)
      query += ` AND sr.user_wallet = $${params.length}`
    }

    if (agentId) {
      params.push(agentId)
      query += ` AND sr.agent_id = $${params.length}`
    }

    if (status) {
      params.push(status)
      query += ` AND sr.status = $${params.length}`
    }

    // OPTIMIZED: Fixed parameter placeholders
    params.push(limit, offset)
    query += ` ORDER BY sr.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

    const result = await client.query(query, params)

    // OPTIMIZED: Separate count query with same filters
    let countQuery = 'SELECT COUNT(*) as total FROM service_requests WHERE 1=1'
    const countParams: any[] = []

    if (userWallet) {
      countParams.push(userWallet)
      countQuery += ` AND user_wallet = $${countParams.length}`
    }
    if (agentId) {
      countParams.push(agentId)
      countQuery += ` AND agent_id = $${countParams.length}`
    }
    if (status) {
      countParams.push(status)
      countQuery += ` AND status = $${countParams.length}`
    }

    const countResult = await client.query(countQuery, countParams)
    const total = parseInt((countResult.rows[0] as any).total)

    return NextResponse.json({
      requests: result.rows.map((row: any) => ({
        id: row.id,
        requestId: row.request_id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        userWallet: row.user_wallet,
        amount: row.amount,
        status: row.status,
        requestData: row.request_data,
        resultData: row.result_data,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error: unknown) {
    const userWalletParam = request.nextUrl.searchParams.get('userWallet')
    return databaseError('GET /api/requests', error, userWalletParam || undefined)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

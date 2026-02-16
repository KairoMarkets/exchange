import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { validationError, databaseError } from '@/lib/api-error'
import { CATEGORIES } from '@/lib/data/agents'

function storedCategory(category: unknown, pricing?: Record<string, unknown>): string | undefined {
  const next = typeof category === 'string' ? category : typeof pricing?.category === 'string' ? pricing.category : ''
  return CATEGORIES.includes(next) ? next : undefined
}

function normalizeCategory(category: unknown, pricing?: Record<string, unknown>): string {
  return storedCategory(category, pricing) ?? 'Research'
}

function pricingWithCategory(pricing: unknown, category: string): Record<string, unknown> {
  const base = pricing && typeof pricing === 'object' && !Array.isArray(pricing) ? pricing as Record<string, unknown> : { price: 0, currency: 'SOL', per: 'run' }
  return { ...base, category }
}

export async function GET(request: NextRequest) {
  const pool = createPool()
  let client

  try {
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '10'))
    const search = searchParams.get('search') || ''
    const offset = (page - 1) * limit

    client = await pool.connect()

    // OPTIMIZED: Use materialized view instead of JOIN + GROUP BY
    // This eliminates expensive aggregation on every request
    let query = `
      SELECT 
        id, agent_id, name, description, capabilities, pricing,
        endpoint, creator_wallet, active, created_at,
        avg_rating, rating_count
      FROM agent_stats_mv
      WHERE active = true
    `

    const params: any[] = []
    if (search) {
      // OPTIMIZED: Uses pg_trgm indexes for faster ILIKE searches
      query += ` AND (name ILIKE $1 OR description ILIKE $1)`
      params.push(`%${search}%`)
    }

    // OPTIMIZED: Fixed SQL parameter placeholders
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await client.query(query, params)

    // OPTIMIZED: Count query uses materialized view
    let countQuery = 'SELECT COUNT(*) as total FROM agent_stats_mv WHERE active = true'
    if (search) {
      countQuery += ` AND (name ILIKE $1 OR description ILIKE $1)`
    }
    const countResult = await client.query(countQuery, search ? [`%${search}%`] : [])
    const total = parseInt((countResult.rows[0] as any).total)

    return NextResponse.json({
      agents: result.rows.map((row: any) => ({
        id: row.id,
        agentId: row.agent_id,
        name: row.name,
        category: storedCategory(undefined, row.pricing),
        description: row.description,
        capabilities: row.capabilities || [],
        pricing: row.pricing || {},
        endpoint: row.endpoint,
        creatorWallet: row.creator_wallet,
        rating: {
          average: parseFloat(row.avg_rating) || 0,
          count: parseInt(row.rating_count) || 0,
        },
        createdAt: row.created_at,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error: unknown) {
    return databaseError('GET /api/agents', error)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

export async function POST(request: NextRequest) {
  const pool = createPool({ max: 5 })
  let client

  try {
    const body = await request.json()
    const { name, category, description, capabilities, pricing, endpoint, creatorWallet } = body

    // Validation
    if (!name?.trim()) {
      return validationError('Agent name is required', 'POST /api/agents')
    }
    if (!creatorWallet?.trim()) {
      return validationError('Creator wallet address is required', 'POST /api/agents')
    }

    const agentCategory = normalizeCategory(category, pricing)
    const normalizedPricing = pricingWithCategory(pricing, agentCategory)

    client = await pool.connect()
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    const result = await client.query(
      `INSERT INTO agents (agent_id, name, description, capabilities, pricing, endpoint, creator_wallet, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
      [
        agentId,
        name,
        description || '',
        JSON.stringify(capabilities || []),
        JSON.stringify(normalizedPricing),
        endpoint || '',
        creatorWallet,
      ]
    )

    const agent = result.rows[0] as any

    // OPTIMIZED: Refresh materialized view after insert (async, non-blocking)
    // In production, this should be done via a scheduled job every 5 minutes
    client.query('SELECT refresh_agent_stats()').catch(() => {
      // Ignore errors - MV refresh is not critical for immediate response
    })

    return NextResponse.json({
      success: true,
      agent: { id: agent.id, agentId: agent.agent_id, name: agent.name, createdAt: agent.created_at },
      message: 'Agent registered successfully',
    })
  } catch (error: unknown) {
    return databaseError('POST /api/agents', error)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

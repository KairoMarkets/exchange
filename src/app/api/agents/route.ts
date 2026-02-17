import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { validationError, databaseError } from '@/lib/api-error'
import { CATEGORIES, KAIRO_AGENTS } from '@/lib/data/agents'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { sanitizePublicProductText, sanitizePublicStringArray } from '@/lib/public-copy'

const MIN_AGENT_PRICE_SOL = 0.01

function staticAgentToApi(a: (typeof KAIRO_AGENTS)[number]) {
  return {
    id: a.id,
    agentId: a.id,
    name: sanitizePublicProductText(a.name),
    category: a.category,
    description: sanitizePublicProductText(a.description),
    capabilities: sanitizePublicStringArray(a.capabilities),
    pricing: { price: a.pricePerRun, currency: a.currency, per: 'run' },
    endpoint: '',
    creatorWallet: a.creator,
    rating: { average: a.rating, count: a.totalExecutions },
    createdAt: null,
  }
}

function devnetAgentToApi(a: ReturnType<typeof devnetStore.listAgents>[number]) {
  return {
    id: a.id,
    agentId: a.agent_id,
    name: sanitizePublicProductText(a.name),
    category: storedCategory(a.category, a.pricing),
    description: sanitizePublicProductText(a.description),
    capabilities: sanitizePublicStringArray(a.capabilities),
    pricing: a.pricing,
    endpoint: a.endpoint,
    creatorWallet: a.creator_wallet,
    rating: { average: 0, count: 0 },
    createdAt: a.created_at,
  }
}

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
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '10'))
  const search = searchParams.get('search') || ''
  const creatorWallet = searchParams.get('creatorWallet') || ''

  if (!shouldUsePostgres()) {
    const q = search.toLowerCase().trim()
    const staticAgents = KAIRO_AGENTS.filter(a => {
      if (creatorWallet && a.creator !== creatorWallet) return false
      if (q && !a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false
      return true
    }).map(staticAgentToApi)

    const createdAgents = devnetStore
      .listAgents({ search, creatorWallet })
      .map(devnetAgentToApi)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())

    const agents = [...createdAgents, ...staticAgents]
    const total = agents.length
    const offset = (page - 1) * limit
    const paged = agents.slice(offset, offset + limit)

    return NextResponse.json({
      agents: paged,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  }

  const pool = createPool()
  let client

  try {
    const offset = (page - 1) * limit

    client = await pool.connect()

    let query = `
      SELECT
        a.id, a.agent_id, a.name, a.description, a.capabilities, a.pricing,
        a.endpoint, a.creator_wallet, a.active, a.created_at,
        COALESCE(AVG(r.stars), 0)::float as avg_rating,
        COUNT(r.id) as rating_count
      FROM agents a
      LEFT JOIN ratings r ON a.agent_id = r.agent_id
      WHERE a.active = true
    `

    const params: any[] = []
    if (search) {
      params.push(`%${search}%`)
      query += ` AND (a.name ILIKE $${params.length} OR a.description ILIKE $${params.length})`
    }
    if (creatorWallet) {
      params.push(creatorWallet)
      query += ` AND a.creator_wallet = $${params.length}`
    }

    query += ` GROUP BY a.id ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await client.query(query, params)

    let countQuery = 'SELECT COUNT(*) as total FROM agents WHERE active = true'
    const countParams: any[] = []
    if (search) {
      countParams.push(`%${search}%`)
      countQuery += ` AND (name ILIKE $${countParams.length} OR description ILIKE $${countParams.length})`
    }
    if (creatorWallet) {
      countParams.push(creatorWallet)
      countQuery += ` AND creator_wallet = $${countParams.length}`
    }
    const countResult = await client.query(countQuery, countParams)
    const total = parseInt((countResult.rows[0] as any).total)

    return NextResponse.json({
      agents: result.rows.map((row: any) => ({
        id: row.id,
        agentId: row.agent_id,
        name: sanitizePublicProductText(String(row.name ?? '')),
        category: storedCategory(undefined, row.pricing),
        description: sanitizePublicProductText(String(row.description ?? '')),
        capabilities: sanitizePublicStringArray(row.capabilities),
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
  try {
    const body = await request.json()
    const { name, category, description, capabilities, pricing, endpoint, creatorWallet } = body

    if (!name?.trim()) {
      return validationError('Agent name is required', 'POST /api/agents')
    }
    if (!creatorWallet?.trim()) {
      return validationError('Creator wallet address is required', 'POST /api/agents')
    }

    const agentCategory = normalizeCategory(category, pricing)
    const normalizedPricing = pricingWithCategory(pricing, agentCategory)
    const price = Number(normalizedPricing.price)

    if (!Number.isFinite(price)) {
      return validationError('Valid price is required', 'POST /api/agents')
    }
    if (price < MIN_AGENT_PRICE_SOL) {
      return validationError(`Price per Query must be at least ${MIN_AGENT_PRICE_SOL.toFixed(2)} SOL`, 'POST /api/agents')
    }

    if (!shouldUsePostgres()) {
      const now = new Date().toISOString()
      const agentId = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      const agent = devnetStore.createAgent({
        agent_id: agentId,
        name: name.trim(),
        category: agentCategory,
        description: description || '',
        capabilities: Array.isArray(capabilities) ? capabilities : [],
        pricing: normalizedPricing,
        endpoint: endpoint || '',
        creator_wallet: creatorWallet.trim(),
        active: true,
        created_at: now,
        updated_at: now,
      })

      return NextResponse.json({
        success: true,
        agent: { id: agent.id, agentId: agent.agent_id, name: agent.name, createdAt: agent.created_at },
        message: 'Agent registered successfully',
      })
    }

    const pool = createPool({ max: 5 })
    let client

    try {
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

      return NextResponse.json({
        success: true,
        agent: { id: agent.id, agentId: agent.agent_id, name: agent.name, createdAt: agent.created_at },
        message: 'Agent registered successfully',
      })
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } catch (error: unknown) {
    return databaseError('POST /api/agents', error)
  }
}

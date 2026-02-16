import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { notFoundError, databaseError } from '@/lib/api-error'
import { CATEGORIES, KAIRO_AGENTS } from '@/lib/data/agents'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { sanitizePublicProductText, sanitizePublicStringArray } from '@/lib/public-copy'

function storedCategory(category: unknown, pricing?: unknown): string | undefined {
  const pricingCategory = pricing && typeof pricing === 'object' && !Array.isArray(pricing)
    ? (pricing as Record<string, unknown>).category
    : undefined
  const next = typeof category === 'string' ? category : typeof pricingCategory === 'string' ? pricingCategory : ''
  return CATEGORIES.includes(next) ? next : undefined
}

/**
 * GET /api/agents/[id]
 *
 * Returns a single agent by agent_id (DB) or id (static data fallback).
 * Response: { agent: AgentDetail }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const agentId = id?.trim()
  if (!agentId) {
    return notFoundError('Agent', 'GET /api/agents/[id]')
  }

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const result = await client.query(
        `SELECT
           a.id, a.agent_id, a.name, a.description, a.capabilities, a.pricing,
           a.endpoint, a.creator_wallet, a.active, a.created_at, a.updated_at,
           COALESCE(AVG(r.stars), 0)::float AS avg_rating,
           COUNT(r.id) AS rating_count
         FROM agents a
         LEFT JOIN ratings r ON a.agent_id = r.agent_id
         WHERE a.agent_id = $1
         GROUP BY a.id`,
        [agentId]
      )

      if (result.rows.length === 0) {
        return notFoundError('Agent', 'GET /api/agents/[id]')
      }

      const row = result.rows[0] as Record<string, unknown>
      return NextResponse.json({
        agent: {
          id: row.id,
          agentId: row.agent_id,
          name: sanitizePublicProductText(String(row.name ?? '')),
          category: storedCategory(undefined, row.pricing),
          description: sanitizePublicProductText(String(row.description ?? '')),
          capabilities: sanitizePublicStringArray(row.capabilities),
          pricing: row.pricing ?? {},
          endpoint: row.endpoint,
          creatorWallet: row.creator_wallet,
          active: row.active,
          rating: {
            average: parseFloat(String(row.avg_rating)) || 0,
            count: parseInt(String(row.rating_count)) || 0,
          },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      })
    } catch (error: unknown) {
      return databaseError('GET /api/agents/[id]', error)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const createdAgent = devnetStore.getAgent(agentId)
    if (createdAgent) {
      return NextResponse.json({
        agent: {
          id: createdAgent.id,
          agentId: createdAgent.agent_id,
          name: sanitizePublicProductText(createdAgent.name),
          category: storedCategory(createdAgent.category, createdAgent.pricing),
          description: sanitizePublicProductText(createdAgent.description),
          capabilities: sanitizePublicStringArray(createdAgent.capabilities),
          pricing: createdAgent.pricing,
          endpoint: createdAgent.endpoint,
          creatorWallet: createdAgent.creator_wallet,
          active: createdAgent.active,
          rating: { average: 0, count: 0 },
          createdAt: createdAgent.created_at,
          updatedAt: createdAgent.updated_at,
        },
      })
    }

    const agent = KAIRO_AGENTS.find(a => a.id === agentId)
    if (!agent) {
      return notFoundError('Agent', 'GET /api/agents/[id]')
    }
    return NextResponse.json({
      agent: {
        id: agent.id,
        agentId: agent.id,
        name: sanitizePublicProductText(agent.name),
        category: agent.category,
        description: sanitizePublicProductText(agent.description),
        capabilities: sanitizePublicStringArray(agent.capabilities),
        pricing: { price: agent.pricePerRun, currency: agent.currency, per: 'run' },
        endpoint: '',
        creatorWallet: agent.creator,
        active: true,
        rating: { average: agent.rating, count: agent.totalExecutions },
        createdAt: null,
        updatedAt: null,
      },
    })
  }
}

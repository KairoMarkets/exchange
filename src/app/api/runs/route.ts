import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { validationError, notFoundError, databaseError } from '@/lib/api-error'
import { hashPayload, generateRunId } from '@/lib/receipt'
import { requireAuthenticatedWallet, requireMatchingWalletHint } from '@/lib/auth'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { KAIRO_AGENTS } from '@/lib/data/agents'
import { evaluateSafety } from '@/lib/safety/evaluate'

const DEVNET_CREATOR_FALLBACK = 'DevCreat0r1111111111111111111111111111111111'

/**
 * POST /api/runs
 * Header: Authorization: Bearer <token>
 * Body: { agentId, buyerWallet?, amountSol, payload? }
 *
 * Creates a new run in 'pending' state.
 * Response: { run: RunSummary }
 */
export async function POST(request: NextRequest) {
  let body: {
    agentId?: string
    buyerWallet?: string
    amountSol?: number
    payload?: Record<string, unknown>
  } = {}
  try {
    body = await request.json()
  } catch {
    return validationError('Request body must be valid JSON', 'POST /api/runs')
  }

  const auth = requireAuthenticatedWallet(request, 'POST /api/runs')
  if (auth instanceof NextResponse) return auth

  const walletHintError = requireMatchingWalletHint(
    auth.wallet,
    body.buyerWallet,
    'buyerWallet',
    'POST /api/runs'
  )
  if (walletHintError) return walletHintError

  const buyerWallet = auth.wallet
  const agentId = body.agentId?.trim()
  const amountSol = body.amountSol

  if (!agentId) return validationError('agentId is required', 'POST /api/runs', buyerWallet)
  if (!amountSol || amountSol <= 0) {
    return validationError('amountSol must be a positive number', 'POST /api/runs', buyerWallet)
  }

  const payload = body.payload ?? {}
  const safety = evaluateSafety({
    category: typeof payload.category === 'string' ? payload.category : undefined,
    text: [
      typeof payload.task === 'string' ? payload.task : '',
      typeof payload.description === 'string' ? payload.description : '',
      typeof payload.prompt === 'string' ? payload.prompt : '',
    ].filter(Boolean).join('\n'),
  })
  if (safety.decision === 'block') {
    return validationError(safety.safeLabel, 'POST /api/runs', buyerWallet)
  }
  const storedPayload = {
    ...payload,
    safety: {
      decision: safety.decision,
      category: safety.category,
      reasonCodes: safety.reasonCodes,
      safeLabel: safety.safeLabel,
    },
  }
  const inputHash = hashPayload(storedPayload)
  const runId = generateRunId()
  const now = new Date().toISOString()

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()

      // Resolve agent name and creator wallet from DB. Seeded/static marketplace
      // agents can still be displayed on a Postgres-backed environment before they
      // exist in the agents table, so fall back to the static catalogue instead
      // of failing the buyer approval flow.
      const agentResult = await client.query(
        `SELECT name, creator_wallet FROM agents WHERE agent_id = $1 AND active = true`,
        [agentId]
      )
      const staticAgent = KAIRO_AGENTS.find(a => a.id === agentId)
      if (agentResult.rows.length === 0 && !staticAgent) {
        return notFoundError('Agent', 'POST /api/runs', buyerWallet)
      }
      const agentRow = agentResult.rows[0] as { name: string; creator_wallet: string } | undefined
      const agentName = agentRow?.name ?? staticAgent?.name ?? agentId
      const creatorWallet = agentRow?.creator_wallet ?? DEVNET_CREATOR_FALLBACK

      const result = await client.query(
        `INSERT INTO runs
           (run_id, agent_id, agent_name, buyer_wallet, creator_wallet,
            amount_sol, status, input_hash, payload)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)
         RETURNING run_id, agent_id, agent_name, buyer_wallet, creator_wallet,
                   amount_sol, status, input_hash, created_at`,
        [
          runId,
          agentId,
          agentName,
          buyerWallet,
          creatorWallet,
          amountSol,
          inputHash,
          JSON.stringify(storedPayload),
        ]
      )
      const row = result.rows[0] as Record<string, unknown>
      return NextResponse.json({ run: formatRunRow(row) }, { status: 201 })
    } catch (error: unknown) {
      return databaseError('POST /api/runs', error, buyerWallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    // Devnet fallback — support both seeded static agents and creator-registered agents.
    const storedAgent = devnetStore.getAgent(agentId)
    const staticAgent = KAIRO_AGENTS.find(a => a.id === agentId)
    const agentName = storedAgent?.name ?? staticAgent?.name
    const creatorWallet = storedAgent?.creator_wallet ?? DEVNET_CREATOR_FALLBACK
    if (!agentName) {
      return notFoundError('Agent', 'POST /api/runs', buyerWallet)
    }
    const run = devnetStore.createRun({
      run_id: runId,
      agent_id: agentId,
      agent_name: agentName,
      buyer_wallet: buyerWallet,
      creator_wallet: creatorWallet,
      amount_sol: String(amountSol),
      status: 'pending',
      input_hash: inputHash,
      result_hash: null,
      summary: null,
      payload: storedPayload,
      result: {},
      authorized_at: null,
      started_at: null,
      completed_at: null,
      disputed_at: null,
      created_at: now,
      updated_at: now,
    })
    return NextResponse.json({ run: formatDevnetRun(run) }, { status: 201 })
  }
}

/**
 * GET /api/runs
 * Query: buyerWallet?, creatorWallet?, agentId?, status?, page?, limit?
 *
 * Returns paginated run list.
 * Response: { runs: RunSummary[], pagination }
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const buyerWallet = sp.get('buyerWallet')
  const creatorWallet = sp.get('creatorWallet')
  const agentId = sp.get('agentId')
  const status = sp.get('status')
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') ?? '20')))
  const offset = (page - 1) * limit

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()

      const params: unknown[] = []
      let where = 'WHERE 1=1'
      let p = 0

      if (buyerWallet) { p++; where += ` AND r.buyer_wallet = $${p}`; params.push(buyerWallet) }
      if (creatorWallet) { p++; where += ` AND r.creator_wallet = $${p}`; params.push(creatorWallet) }
      if (agentId) { p++; where += ` AND r.agent_id = $${p}`; params.push(agentId) }
      if (status) { p++; where += ` AND r.status = $${p}`; params.push(status) }

      const dataQuery = `
        SELECT run_id, agent_id, agent_name, buyer_wallet, creator_wallet,
               amount_sol, status, input_hash, result_hash, summary,
               authorized_at, completed_at, disputed_at, created_at, updated_at
        FROM runs r ${where}
        ORDER BY r.created_at DESC
        LIMIT $${p + 1} OFFSET $${p + 2}`
      params.push(limit, offset)

      const countQuery = `SELECT COUNT(*) AS total FROM runs r ${where}`
      const [dataResult, countResult] = await Promise.all([
        client.query(dataQuery, params),
        client.query(countQuery, params.slice(0, p)),
      ])
      const total = parseInt(String((countResult.rows[0] as Record<string, unknown>).total))

      return NextResponse.json({
        runs: dataResult.rows.map(r => formatRunRow(r as Record<string, unknown>)),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (error: unknown) {
      return databaseError('GET /api/runs', error, buyerWallet ?? undefined)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const all = devnetStore.listRuns({
      buyerWallet: buyerWallet ?? undefined,
      creatorWallet: creatorWallet ?? undefined,
      agentId: agentId ?? undefined,
      status: status ?? undefined,
    })
    const sorted = [...all].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const paged = sorted.slice(offset, offset + limit)
    return NextResponse.json({
      runs: paged.map(formatDevnetRun),
      pagination: { page, limit, total: sorted.length, pages: Math.ceil(sorted.length / limit) },
    })
  }
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function formatRunRow(row: Record<string, unknown>) {
  return {
    runId: row.run_id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    buyerWallet: row.buyer_wallet,
    creatorWallet: row.creator_wallet,
    amountSol: row.amount_sol,
    status: row.status,
    inputHash: row.input_hash,
    resultHash: row.result_hash ?? null,
    summary: row.summary ?? null,
    authorizedAt: row.authorized_at ?? null,
    completedAt: row.completed_at ?? null,
    disputedAt: row.disputed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function formatDevnetRun(run: import('@/lib/db/devnet-store').DevnetRun) {
  return {
    runId: run.run_id,
    agentId: run.agent_id,
    agentName: run.agent_name,
    buyerWallet: run.buyer_wallet,
    creatorWallet: run.creator_wallet,
    amountSol: run.amount_sol,
    status: run.status,
    inputHash: run.input_hash,
    resultHash: run.result_hash,
    summary: run.summary,
    authorizedAt: run.authorized_at,
    completedAt: run.completed_at,
    disputedAt: run.disputed_at,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }
}

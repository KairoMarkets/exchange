import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { notFoundError, databaseError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'

/**
 * GET /api/runs/[id]
 *
 * Returns a single run by run_id with full detail.
 * Response: { run: RunDetail }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const runId = id?.trim()
  if (!runId) return notFoundError('Run', 'GET /api/runs/[id]')

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const result = await client.query(
        `SELECT run_id, agent_id, agent_name, buyer_wallet, creator_wallet,
                amount_sol, status, input_hash, result_hash, summary,
                payload, result, authorized_at, started_at, completed_at,
                disputed_at, created_at, updated_at
         FROM runs
         WHERE run_id = $1`,
        [runId]
      )
      if (result.rows.length === 0) return notFoundError('Run', 'GET /api/runs/[id]')
      return NextResponse.json({ run: formatRunDetail(result.rows[0] as Record<string, unknown>) })
    } catch (error: unknown) {
      return databaseError('GET /api/runs/[id]', error)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const run = devnetStore.getRun(runId)
    if (!run) return notFoundError('Run', 'GET /api/runs/[id]')
    return NextResponse.json({ run: formatDevnetRunDetail(run) })
  }
}

function formatRunDetail(row: Record<string, unknown>) {
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
    payload: row.payload ?? {},
    result: row.result ?? {},
    authorizedAt: row.authorized_at ?? null,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    disputedAt: row.disputed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function formatDevnetRunDetail(run: import('@/lib/db/devnet-store').DevnetRun) {
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
    payload: run.payload,
    result: run.result,
    authorizedAt: run.authorized_at,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    disputedAt: run.disputed_at,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { validationError, notFoundError, forbiddenError, databaseError } from '@/lib/api-error'
import { requireAuthenticatedWallet, requireMatchingWalletHint } from '@/lib/auth'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'

/**
 * POST /api/runs/[id]/authorize
 * Header: Authorization: Bearer <token>
 * Body: { buyerWallet? }
 *
 * Transitions a run from 'pending' → 'authorized'.
 * Only the buyer_wallet may authorize their own run.
 *
 * In devnet mode this represents the buyer's off-chain intent to proceed.
 * Response: { run: { runId, status, authorizedAt } }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const runId = id?.trim()
  if (!runId) return notFoundError('Run', 'POST /api/runs/[id]/authorize')

  let body: { buyerWallet?: string } = {}
  try {
    body = await request.json()
  } catch {
    // body optional
  }

  const auth = requireAuthenticatedWallet(request, 'POST /api/runs/[id]/authorize')
  if (auth instanceof NextResponse) return auth
  const hintError = requireMatchingWalletHint(
    auth.wallet,
    body.buyerWallet,
    'buyerWallet',
    'POST /api/runs/[id]/authorize'
  )
  if (hintError) return hintError
  const callerWallet = auth.wallet

  const authorizedAt = new Date().toISOString()

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()

      const runResult = await client.query(
        `SELECT run_id, buyer_wallet, status FROM runs WHERE run_id = $1`,
        [runId]
      )
      if (runResult.rows.length === 0) return notFoundError('Run', 'POST /api/runs/[id]/authorize')

      const run = runResult.rows[0] as { run_id: string; buyer_wallet: string; status: string }

      if (run.buyer_wallet !== callerWallet) {
        return forbiddenError('Only the buyer may authorize this run', 'POST /api/runs/[id]/authorize', callerWallet)
      }
      if (run.status !== 'pending') {
        return validationError(
          `Run cannot be authorized from status '${run.status}'`,
          'POST /api/runs/[id]/authorize',
          callerWallet
        )
      }

      await client.query(
        `UPDATE runs SET status = 'authorized', authorized_at = $1, updated_at = $1 WHERE run_id = $2`,
        [authorizedAt, runId]
      )

      return NextResponse.json({
        run: { runId, status: 'authorized', authorizedAt },
      })
    } catch (error: unknown) {
      return databaseError('POST /api/runs/[id]/authorize', error, callerWallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const run = devnetStore.getRun(runId)
    if (!run && process.env.VERCEL) {
      return NextResponse.json({ run: { runId, status: 'authorized', authorizedAt } })
    }
    if (!run) return notFoundError('Run', 'POST /api/runs/[id]/authorize')

    if (run.buyer_wallet !== callerWallet) {
      return forbiddenError('Only the buyer may authorize this run', 'POST /api/runs/[id]/authorize', callerWallet)
    }
    if (run.status !== 'pending') {
      return validationError(
        `Run cannot be authorized from status '${run.status}'`,
        'POST /api/runs/[id]/authorize',
        callerWallet
      )
    }

    devnetStore.updateRun(runId, { status: 'authorized', authorized_at: authorizedAt })
    return NextResponse.json({ run: { runId, status: 'authorized', authorizedAt } })
  }
}

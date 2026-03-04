import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { validationError, notFoundError, forbiddenError, databaseError } from '@/lib/api-error'
import { requireAuthenticatedWallet, requireMatchingWalletHint } from '@/lib/auth'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'

/**
 * POST /api/runs/[id]/dispute
 * Header: Authorization: Bearer <token>
 * Body: { buyerWallet?, reason }
 *
 * Transitions a run from 'completed' or 'authorized' → 'disputed'.
 * Only the buyer_wallet may raise a dispute.
 * If a receipt exists for the run, its status is updated to 'disputed'.
 *
 * Response: { run: { runId, status, disputedAt }, reason: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const runId = id?.trim()
  if (!runId) return notFoundError('Run', 'POST /api/runs/[id]/dispute')

  let body: { buyerWallet?: string; reason?: string } = {}
  try {
    body = await request.json()
  } catch {
    // body optional for wallet, but reason required
  }

  const auth = requireAuthenticatedWallet(request, 'POST /api/runs/[id]/dispute')
  if (auth instanceof NextResponse) return auth

  const walletHintError = requireMatchingWalletHint(
    auth.wallet,
    body.buyerWallet,
    'buyerWallet',
    'POST /api/runs/[id]/dispute'
  )
  if (walletHintError) return walletHintError

  const callerWallet = auth.wallet
  const reason = body.reason?.trim()
  if (!reason) {
    return validationError('reason is required', 'POST /api/runs/[id]/dispute', callerWallet)
  }

  const disputedAt = new Date().toISOString()

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      await client.query('BEGIN')

      const runResult = await client.query(
        `SELECT run_id, buyer_wallet, status FROM runs WHERE run_id = $1 FOR UPDATE`,
        [runId]
      )
      if (runResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return notFoundError('Run', 'POST /api/runs/[id]/dispute')
      }

      const run = runResult.rows[0] as { run_id: string; buyer_wallet: string; status: string }

      if (run.buyer_wallet !== callerWallet) {
        await client.query('ROLLBACK')
        return forbiddenError('Only the buyer may dispute this run', 'POST /api/runs/[id]/dispute', callerWallet)
      }
      if (!['authorized', 'running', 'completed'].includes(run.status)) {
        await client.query('ROLLBACK')
        return validationError(
          `Run cannot be disputed from status '${run.status}'`,
          'POST /api/runs/[id]/dispute',
          callerWallet
        )
      }

      await client.query(
        `UPDATE runs
         SET status = 'disputed', disputed_at = $1, updated_at = $1
         WHERE run_id = $2`,
        [disputedAt, runId]
      )

      // If a receipt exists for this run, mark it disputed as well
      await client.query(
        `UPDATE receipts SET status = 'disputed' WHERE run_id = $1`,
        [runId]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        run: { runId, status: 'disputed', disputedAt },
        reason,
      })
    } catch (error: unknown) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      return databaseError('POST /api/runs/[id]/dispute', error, callerWallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const run = devnetStore.getRun(runId)
    if (!run) return notFoundError('Run', 'POST /api/runs/[id]/dispute')

    if (run.buyer_wallet !== callerWallet) {
      return forbiddenError('Only the buyer may dispute this run', 'POST /api/runs/[id]/dispute', callerWallet)
    }
    if (!['authorized', 'running', 'completed'].includes(run.status)) {
      return validationError(
        `Run cannot be disputed from status '${run.status}'`,
        'POST /api/runs/[id]/dispute',
        callerWallet
      )
    }

    devnetStore.updateRun(runId, { status: 'disputed', disputed_at: disputedAt })

    // Update receipt status if one exists
    const receipt = devnetStore.getReceiptByRunId(runId)
    if (receipt) {
      devnetStore.updateReceipt(receipt.receipt_id, { status: 'disputed' })
    }

    return NextResponse.json({
      run: { runId, status: 'disputed', disputedAt },
      reason,
    })
  }
}

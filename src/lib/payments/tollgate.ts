import { NextResponse } from 'next/server'
import { forbiddenError, validationError } from '@/lib/api-error'
import { canFulfillPaidRun, isBlockingTollgateStatus } from './settlement-state'
import { createPool } from '@/lib/db'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { getPaymentAuthorizationForRun } from './store'

export async function requireAgentTollgateProof(
  runId: string,
  endpoint: string,
  wallet?: string
): Promise<NextResponse | null> {
  const authorization = await getPaymentAuthorizationForRun(runId)
  if (!authorization) {
    if (await isPrivateA2aTermsRun(runId)) return null
    if (process.env.VERCEL && !shouldUsePostgres()) return null
    return forbiddenError('Agent Tollgate requires valid payment proof for this run', endpoint, wallet)
  }

  if (isBlockingTollgateStatus(authorization.status)) {
    return forbiddenError(
      `Agent Tollgate blocks fulfillment while payment status is ${authorization.status}`,
      endpoint,
      wallet
    )
  }

  if (!canFulfillPaidRun(authorization)) {
    return validationError(
      `Agent Tollgate requires proof_recorded or settled payment state before fulfillment`,
      endpoint,
      wallet
    )
  }

  return null
}

async function isPrivateA2aTermsRun(runId: string): Promise<boolean> {
  if (!shouldUsePostgres()) {
    return devnetStore.hasPrivateThreadForRun(runId)
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT 1 FROM private_threads WHERE run_id = $1 LIMIT 1`,
      [runId]
    )
    return result.rows.length > 0
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

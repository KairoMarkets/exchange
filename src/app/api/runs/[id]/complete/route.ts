import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { validationError, notFoundError, forbiddenError, databaseError } from '@/lib/api-error'
import { requireAuthenticatedWallet, requireMatchingWalletHint } from '@/lib/auth'
import { hashPayload, generateReceiptId, buildReceiptHash } from '@/lib/receipt'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { buildPublicProofEnvelope, formatPublicReceipt } from '@/lib/private-a2a'
import { requireAgentTollgateProof } from '@/lib/payments/tollgate'
import {
  getPaymentAuthorizationForRun,
  paymentRecordToReceiptPublic,
  updatePaymentAuthorizationRecord,
} from '@/lib/payments/store'

/**
 * POST /api/runs/[id]/complete
 * Header: Authorization: Bearer <token>
 * Body: { creatorWallet?, result?, summary? }
 *
 * Transitions a run from 'authorized' or 'running' → 'completed'.
 * Only the creator_wallet may complete a run.
 * Generates a durable receipt with SHA-256 result_hash and receipt_hash.
 *
 * Response: { run: RunSummary, receipt: ReceiptSummary }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const runId = id?.trim()
  if (!runId) return notFoundError('Run', 'POST /api/runs/[id]/complete')

  let body: {
    creatorWallet?: string
    result?: Record<string, unknown>
    summary?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    // body optional
  }

  const auth = requireAuthenticatedWallet(request, 'POST /api/runs/[id]/complete')
  if (auth instanceof NextResponse) return auth
  const hintError = requireMatchingWalletHint(
    auth.wallet,
    body.creatorWallet,
    'creatorWallet',
    'POST /api/runs/[id]/complete'
  )
  if (hintError) return hintError
  const callerWallet = auth.wallet

  const resultPayload = body.result ?? {}
  const summary = body.summary?.trim() ?? null
  const resultHash = hashPayload(resultPayload)
  const receiptId = generateReceiptId()
  const now = new Date().toISOString()
  const ts = Date.now()

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      await client.query('BEGIN')

      const runResult = await client.query(
        `SELECT run_id, agent_id, agent_name, buyer_wallet, creator_wallet,
                amount_sol, status
         FROM runs WHERE run_id = $1 FOR UPDATE`,
        [runId]
      )
      if (runResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return notFoundError('Run', 'POST /api/runs/[id]/complete')
      }

      const run = runResult.rows[0] as {
        run_id: string
        agent_id: string
        agent_name: string
        buyer_wallet: string
        creator_wallet: string
        amount_sol: string
        status: string
      }

      if (run.creator_wallet !== callerWallet) {
        await client.query('ROLLBACK')
        return forbiddenError('Only the creator may complete this run', 'POST /api/runs/[id]/complete', callerWallet)
      }
      if (!['authorized', 'running'].includes(run.status)) {
        await client.query('ROLLBACK')
        return validationError(
          `Run cannot be completed from status '${run.status}'`,
          'POST /api/runs/[id]/complete',
          callerWallet
        )
      }

      const tollgateError = await requireAgentTollgateProof(
        runId,
        'POST /api/runs/[id]/complete',
        callerWallet
      )
      if (tollgateError) {
        await client.query('ROLLBACK')
        return tollgateError
      }

      const receiptHash = buildReceiptHash({
        receiptId,
        runId,
        agentId: run.agent_id,
        buyerWallet: run.buyer_wallet,
        resultHash,
        amountSol: String(run.amount_sol),
        timestamp: ts,
      })

      await client.query(
        `UPDATE runs
         SET status = 'completed', result_hash = $1, summary = $2,
             result = $3, completed_at = $4, updated_at = $4
         WHERE run_id = $5`,
        [resultHash, summary, JSON.stringify(resultPayload), now, runId]
      )

      const paymentAuthorization = await getPaymentAuthorizationForRun(runId)
      const payment = paymentAuthorization ? paymentRecordToReceiptPublic(paymentAuthorization) : null
      const receiptResult = await client.query(
        `INSERT INTO receipts
           (receipt_id, run_id, agent_id, agent_name, buyer_wallet, creator_wallet,
            amount_sol, status, result_hash, summary, receipt_hash,
            public_proof_envelope_json, message_count, private_content_redacted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,$9,$10,$11,0,true)
         RETURNING receipt_id, run_id, agent_id, agent_name, buyer_wallet, creator_wallet,
                   amount_sol, status, result_hash, summary, receipt_hash,
                   public_proof_envelope_json, private_thread_id, encrypted_deliverable_id,
                   encrypted_deliverable_hash, message_count, private_content_redacted,
                   evaluator_attestation_status, created_at`,
        [
          receiptId, runId, run.agent_id, run.agent_name,
          run.buyer_wallet, run.creator_wallet, run.amount_sol,
          resultHash,
          summary,
          receiptHash,
          JSON.stringify(
            buildPublicProofEnvelope({
              threadId: null,
              deliverableId: null,
              encryptedDeliverableHash: null,
              messageCount: 0,
              status: 'completed',
              receiptHash,
              payment,
            })
          ),
        ]
      )

      if (paymentAuthorization) {
        await client.query(
          `UPDATE payment_authorizations
           SET receipt_id = $1, public_metadata_json = $2, updated_at = $3
           WHERE authorization_id = $4`,
          [
            receiptId,
            JSON.stringify({
              ...paymentAuthorization.publicMetadata,
              receiptId,
            }),
            now,
            paymentAuthorization.authorizationId,
          ]
        )
      }

      await client.query('COMMIT')

      const receipt = receiptResult.rows[0] as Record<string, unknown>
      return NextResponse.json({
        run: { runId, status: 'completed', resultHash, summary, completedAt: now },
        receipt: formatReceiptRow(receipt),
      })
    } catch (error: unknown) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      return databaseError('POST /api/runs/[id]/complete', error, callerWallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const run = devnetStore.getRun(runId) ?? (process.env.VERCEL
      ? {
          run_id: runId,
          agent_id: 'kairo-devnet-agent',
          agent_name: 'Kairo Devnet Agent',
          buyer_wallet: 'DevBuyer11111111111111111111111111111111111',
          creator_wallet: callerWallet,
          amount_sol: '0.01',
          status: 'authorized',
        }
      : undefined)
    if (!run) return notFoundError('Run', 'POST /api/runs/[id]/complete')

    if (run.creator_wallet !== callerWallet) {
      return forbiddenError('Only the creator may complete this run', 'POST /api/runs/[id]/complete', callerWallet)
    }
    if (!['authorized', 'running'].includes(run.status)) {
      return validationError(
        `Run cannot be completed from status '${run.status}'`,
        'POST /api/runs/[id]/complete',
        callerWallet
      )
    }

    const tollgateError = await requireAgentTollgateProof(
      runId,
      'POST /api/runs/[id]/complete',
      callerWallet
    )
    if (tollgateError) return tollgateError

    const receiptHash = buildReceiptHash({
      receiptId,
      runId,
      agentId: run.agent_id,
      buyerWallet: run.buyer_wallet,
      resultHash,
      amountSol: run.amount_sol,
      timestamp: ts,
    })

    if (devnetStore.getRun(runId)) {
      devnetStore.updateRun(runId, {
        status: 'completed',
        result_hash: resultHash,
        summary,
        result: resultPayload,
        completed_at: now,
      })
    }

    const paymentAuthorization = await getPaymentAuthorizationForRun(runId)
    const payment = paymentAuthorization ? paymentRecordToReceiptPublic(paymentAuthorization) : null
    const receipt = devnetStore.createReceipt({
      receipt_id: receiptId,
      run_id: runId,
      agent_id: run.agent_id,
      agent_name: run.agent_name,
      buyer_wallet: run.buyer_wallet,
      creator_wallet: run.creator_wallet,
      amount_sol: run.amount_sol,
      status: 'completed',
      result_hash: resultHash,
      summary,
      receipt_hash: receiptHash,
      public_proof_envelope_json: buildPublicProofEnvelope({
        threadId: null,
        deliverableId: null,
        encryptedDeliverableHash: null,
        messageCount: 0,
        status: 'completed',
        receiptHash,
        payment,
      }),
      private_thread_id: null,
      encrypted_deliverable_id: null,
      encrypted_deliverable_hash: null,
      message_count: 0,
      private_content_redacted: true,
      evaluator_attestation_status: null,
      created_at: now,
    })

    if (paymentAuthorization) {
      await updatePaymentAuthorizationRecord(paymentAuthorization.authorizationId, {
        receiptId,
        publicMetadata: {
          ...paymentAuthorization.publicMetadata,
          receiptId,
        },
      })
    }

    return NextResponse.json({
      run: { runId, status: 'completed', resultHash, summary, completedAt: now },
      receipt: formatDevnetReceipt(receipt),
    })
  }
}

function formatReceiptRow(row: Record<string, unknown>) {
  return formatPublicReceipt({
    receiptId: String(row.receipt_id),
    runId: String(row.run_id),
    agentId: String(row.agent_id),
    agentName: String(row.agent_name),
    creatorWallet: String(row.creator_wallet),
    status: String(row.status),
    resultHash: String(row.result_hash),
    receiptHash: String(row.receipt_hash),
    encryptedDeliverableHash: (row.encrypted_deliverable_hash as string | null) ?? null,
    messageCount: Number(row.message_count ?? 0),
    privateContentRedacted: Boolean(row.private_content_redacted ?? true),
    evaluatorAttestationStatus: (row.evaluator_attestation_status as string | null) ?? null,
    publicProofEnvelope: (row.public_proof_envelope_json as Record<string, unknown> | null) ?? null,
    createdAt: String(row.created_at),
  })
}

function formatDevnetReceipt(r: import('@/lib/db/devnet-store').DevnetReceipt) {
  return formatPublicReceipt({
    receiptId: r.receipt_id,
    runId: r.run_id,
    agentId: r.agent_id,
    agentName: r.agent_name,
    creatorWallet: r.creator_wallet,
    status: r.status,
    resultHash: r.result_hash,
    receiptHash: r.receipt_hash,
    encryptedDeliverableHash: r.encrypted_deliverable_hash,
    messageCount: r.message_count,
    privateContentRedacted: r.private_content_redacted,
    evaluatorAttestationStatus: r.evaluator_attestation_status,
    publicProofEnvelope: r.public_proof_envelope_json,
    createdAt: r.created_at,
  })
}

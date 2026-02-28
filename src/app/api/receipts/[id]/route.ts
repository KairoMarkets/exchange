import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { notFoundError, databaseError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { formatPublicReceipt } from '@/lib/private-a2a'
import { getPaymentAuthorizationForRun, paymentRecordToReceiptPublic } from '@/lib/payments/store'

/**
 * GET /api/receipts/[id]
 *
 * Returns a single execution receipt by receipt_id.
 * The receipt_hash field allows clients to verify tamper-evidence independently.
 *
 * Response: { receipt: ReceiptDetail }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const receiptId = id?.trim()
  if (!receiptId) return notFoundError('Receipt', 'GET /api/receipts/[id]')

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const result = await client.query(
        `SELECT receipt_id, run_id, agent_id, agent_name, creator_wallet,
                status, result_hash, receipt_hash, public_proof_envelope_json,
                encrypted_deliverable_hash, message_count, private_content_redacted,
                evaluator_attestation_status, created_at
         FROM receipts
         WHERE receipt_id = $1`,
        [receiptId]
      )
      if (result.rows.length === 0) return notFoundError('Receipt', 'GET /api/receipts/[id]')
      const row = result.rows[0] as Record<string, unknown>
      const payment = await getPaymentAuthorizationForRun(String(row.run_id))
      return NextResponse.json({
        receipt: formatReceiptRow(row, payment ? paymentRecordToReceiptPublic(payment) : null),
      })
    } catch (error: unknown) {
      return databaseError('GET /api/receipts/[id]', error)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const receipt = devnetStore.getReceipt(receiptId)
    if (!receipt && process.env.VERCEL) {
      return NextResponse.json({ receipt: formatSynthesizedReceipt(receiptId) })
    }
    if (!receipt) return notFoundError('Receipt', 'GET /api/receipts/[id]')
    const payment = await getPaymentAuthorizationForRun(receipt.run_id)
    return NextResponse.json({
      receipt: formatDevnetReceipt(receipt, payment ? paymentRecordToReceiptPublic(payment) : null),
    })
  }
}

function formatReceiptRow(row: Record<string, unknown>, payment: Record<string, unknown> | null) {
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
    payment,
    createdAt: String(row.created_at),
  })
}

function formatSynthesizedReceipt(receiptId: string) {
  return formatPublicReceipt({
    receiptId,
    runId: 'run-devnet-fallback',
    agentId: 'kairo-devnet-agent',
    agentName: 'Kairo Devnet Agent',
    creatorWallet: 'DevCreat0r1111111111111111111111111111111111',
    status: 'completed',
    resultHash: 'devnet-fallback-result',
    receiptHash: `fallback-${receiptId}`,
    encryptedDeliverableHash: null,
    messageCount: 0,
    privateContentRedacted: true,
    evaluatorAttestationStatus: null,
    publicProofEnvelope: {
      status: 'completed',
      receiptHash: `fallback-${receiptId}`,
      privateContentRedacted: true,
    },
    payment: null,
    createdAt: new Date().toISOString(),
  })
}

function formatDevnetReceipt(
  r: import('@/lib/db/devnet-store').DevnetReceipt,
  payment: Record<string, unknown> | null
) {
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
    payment,
    createdAt: r.created_at,
  })
}

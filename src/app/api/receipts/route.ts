import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { databaseError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { formatPublicReceipt } from '@/lib/private-a2a'
import { getPaymentAuthorizationForRun, paymentRecordToReceiptPublic } from '@/lib/payments/store'

/**
 * GET /api/receipts
 * Query: buyerWallet?, creatorWallet?, agentId?, page?, limit?
 *
 * Returns paginated execution receipts.
 * Response: { receipts: ReceiptSummary[], pagination }
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const buyerWallet = sp.get('buyerWallet')
  const creatorWallet = sp.get('creatorWallet')
  const agentId = sp.get('agentId')
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

      if (buyerWallet) { p++; where += ` AND buyer_wallet = $${p}`; params.push(buyerWallet) }
      if (creatorWallet) { p++; where += ` AND creator_wallet = $${p}`; params.push(creatorWallet) }
      if (agentId) { p++; where += ` AND agent_id = $${p}`; params.push(agentId) }

      const dataQuery = `
        SELECT receipt_id, run_id, agent_id, agent_name, creator_wallet,
               status, result_hash, receipt_hash, public_proof_envelope_json,
               encrypted_deliverable_hash, message_count, private_content_redacted,
               evaluator_attestation_status, created_at
        FROM receipts ${where}
        ORDER BY created_at DESC
        LIMIT $${p + 1} OFFSET $${p + 2}`
      params.push(limit, offset)

      const countQuery = `SELECT COUNT(*) AS total FROM receipts ${where}`
      const [dataResult, countResult] = await Promise.all([
        client.query(dataQuery, params),
        client.query(countQuery, params.slice(0, p)),
      ])
      const total = parseInt(String((countResult.rows[0] as Record<string, unknown>).total))

      const receipts = await Promise.all(
        dataResult.rows.map(async r => {
          const row = r as Record<string, unknown>
          const payment = await getPaymentAuthorizationForRun(String(row.run_id))
          return formatReceiptRow(row, payment ? paymentRecordToReceiptPublic(payment) : null)
        })
      )

      return NextResponse.json({
        receipts,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (error: unknown) {
      return databaseError('GET /api/receipts', error, buyerWallet ?? undefined)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const all = devnetStore.listReceipts({
      buyerWallet: buyerWallet ?? undefined,
      creatorWallet: creatorWallet ?? undefined,
      agentId: agentId ?? undefined,
    })
    const sorted = [...all].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const paged = sorted.slice(offset, offset + limit)
    const receipts = await Promise.all(
      paged.map(async receipt => {
        const payment = await getPaymentAuthorizationForRun(receipt.run_id)
        return formatDevnetReceipt(receipt, payment ? paymentRecordToReceiptPublic(payment) : null)
      })
    )
    return NextResponse.json({
      receipts,
      pagination: { page, limit, total: sorted.length, pages: Math.ceil(sorted.length / limit) },
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

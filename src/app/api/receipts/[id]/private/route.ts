import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { databaseError, notFoundError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { assertViewerRole, requirePrivateViewer } from '@/lib/private-a2a'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePrivateViewer(request, 'GET /api/receipts/[id]/private')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const receiptId = id?.trim()
  if (!receiptId) {
    return notFoundError('Receipt', 'GET /api/receipts/[id]/private', auth.wallet)
  }

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const result = await client.query(
        `SELECT r.receipt_id, r.run_id, r.agent_id, r.agent_name, r.buyer_wallet, r.creator_wallet,
                r.status, result_hash, receipt_hash, private_thread_id,
                encrypted_deliverable_id, encrypted_deliverable_hash, message_count,
                private_content_redacted, evaluator_attestation_status, public_proof_envelope_json,
                r.created_at, d.evaluator_wallet
         FROM receipts r
         LEFT JOIN encrypted_deliverables d ON d.receipt_id = r.receipt_id
         WHERE r.receipt_id = $1`,
        [receiptId]
      )
      if (result.rows.length === 0) {
        return notFoundError('Receipt', 'GET /api/receipts/[id]/private', auth.wallet)
      }

      const row = result.rows[0] as Record<string, unknown>
      const viewerRole = assertViewerRole(
        auth.wallet,
        {
          buyerWallet: String(row.buyer_wallet),
          creatorWallet: String(row.creator_wallet),
          evaluatorWallet: (row.evaluator_wallet as string | null) ?? null,
        },
        'GET /api/receipts/[id]/private'
      )
      if (viewerRole instanceof NextResponse) return viewerRole

      return NextResponse.json({
        receipt: {
          receiptId: String(row.receipt_id),
          runId: String(row.run_id),
          agentId: String(row.agent_id),
          agentName: String(row.agent_name),
          buyerWallet: String(row.buyer_wallet),
          creatorWallet: String(row.creator_wallet),
          status: String(row.status),
          resultHash: String(row.result_hash),
          receiptHash: String(row.receipt_hash),
          privateThreadId: (row.private_thread_id as string | null) ?? null,
          encryptedDeliverableId: (row.encrypted_deliverable_id as string | null) ?? null,
          encryptedDeliverableHash: (row.encrypted_deliverable_hash as string | null) ?? null,
          messageCount: Number(row.message_count ?? 0),
          privateContentRedacted: Boolean(row.private_content_redacted ?? true),
          evaluatorAttestationStatus: (row.evaluator_attestation_status as string | null) ?? null,
          publicProofEnvelope: (row.public_proof_envelope_json as Record<string, unknown> | null) ?? null,
          viewerRole,
          createdAt: String(row.created_at),
        },
      })
    } catch (error: unknown) {
      return databaseError('GET /api/receipts/[id]/private', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const receipt = devnetStore.getReceipt(receiptId)
  if (!receipt) {
    return notFoundError('Receipt', 'GET /api/receipts/[id]/private', auth.wallet)
  }
  const deliverable = devnetStore.getDeliverableByReceiptId(receiptId)
  const viewerRole = assertViewerRole(
    auth.wallet,
    {
      buyerWallet: receipt.buyer_wallet,
      creatorWallet: receipt.creator_wallet,
      evaluatorWallet: deliverable?.evaluator_wallet ?? null,
    },
    'GET /api/receipts/[id]/private'
  )
  if (viewerRole instanceof NextResponse) return viewerRole

  return NextResponse.json({
    receipt: {
      receiptId: receipt.receipt_id,
      runId: receipt.run_id,
      agentId: receipt.agent_id,
      agentName: receipt.agent_name,
      buyerWallet: receipt.buyer_wallet,
      creatorWallet: receipt.creator_wallet,
      status: receipt.status,
      resultHash: receipt.result_hash,
      receiptHash: receipt.receipt_hash,
      privateThreadId: receipt.private_thread_id,
      encryptedDeliverableId: receipt.encrypted_deliverable_id,
      encryptedDeliverableHash: receipt.encrypted_deliverable_hash,
      messageCount: receipt.message_count,
      privateContentRedacted: receipt.private_content_redacted,
      evaluatorAttestationStatus: receipt.evaluator_attestation_status,
      publicProofEnvelope: receipt.public_proof_envelope_json,
      viewerRole,
      createdAt: receipt.created_at,
    },
  })
}

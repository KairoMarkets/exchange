import { createPool } from '@/lib/db'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { paymentRecordToReceiptPublic } from '@/lib/payments/store'
import { PaymentAuthorizationRecord } from '@/lib/payments/types'

export async function linkPaymentProofToReceipt(record: PaymentAuthorizationRecord): Promise<void> {
  if (!record.receiptId) return
  const safePayment = paymentRecordToReceiptPublic(record)

  if (!shouldUsePostgres()) {
    const receipt = devnetStore.getReceipt(record.receiptId)
    if (!receipt) return
    devnetStore.updateReceipt(record.receiptId, {
      public_proof_envelope_json: {
        ...(receipt.public_proof_envelope_json ?? {}),
        payment: safePayment,
      },
    })
    return
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT public_proof_envelope_json FROM receipts WHERE receipt_id = $1 AND run_id = $2`,
      [record.receiptId, record.runId]
    )
    if (result.rows.length === 0) return
    const current = result.rows[0] as { public_proof_envelope_json: Record<string, unknown> | null }
    await client.query(
      `UPDATE receipts SET public_proof_envelope_json = $1 WHERE receipt_id = $2`,
      [JSON.stringify({ ...(current.public_proof_envelope_json ?? {}), payment: safePayment }), record.receiptId]
    )
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

import { createHash, randomBytes } from 'crypto'

/** SHA-256 of a JSON-serialized object or raw string — used for result payload hashing. */
export function hashPayload(data: Record<string, unknown> | string): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data)
  return createHash('sha256').update(content).digest('hex')
}

export function generateRunId(): string {
  return `run-${Date.now()}-${randomBytes(6).toString('hex')}`
}

export function generateReceiptId(): string {
  return `rcpt-${Date.now()}-${randomBytes(6).toString('hex')}`
}

/**
 * Build a tamper-evidence receipt hash over the key fields of a completed run.
 * Stored as receipt_hash in the receipts table — changes if any field is mutated.
 */
export function buildReceiptHash(params: {
  receiptId: string
  runId: string
  agentId: string
  buyerWallet: string
  resultHash: string
  amountSol: string
  timestamp: number
}): string {
  const content = [
    params.receiptId,
    params.runId,
    params.agentId,
    params.buyerWallet,
    params.resultHash,
    params.amountSol,
    params.timestamp.toString(),
  ].join('|')
  return createHash('sha256').update(content).digest('hex')
}

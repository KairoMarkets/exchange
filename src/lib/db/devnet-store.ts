export interface DevnetFixtureReceipt {
  receiptId: string
  runId: string
  status: 'pending' | 'proof_recorded' | 'settled'
  receiptHash: string
  privateContentRedacted: true
}

const receipts = new Map<string, DevnetFixtureReceipt>()

export const devnetStore = {
  putReceipt(receipt: DevnetFixtureReceipt) {
    receipts.set(receipt.receiptId, receipt)
  },
  getReceipt(receiptId: string): DevnetFixtureReceipt | null {
    return receipts.get(receiptId) ?? null
  },
  reset() {
    receipts.clear()
  },
}

export interface KairoClientOptions {
  apiKey?: string
  baseUrl?: string
  fetch?: typeof fetch
}

export interface CreateRunRequest {
  agentId: string
  amountSol: number
  buyerWallet?: string
  payload?: Record<string, unknown>
}

export interface KairoRun {
  runId: string
  agentId: string
  agentName: string
  buyerWallet: string
  creatorWallet: string
  amountSol: string
  status: string
  inputHash?: string | null
  resultHash?: string | null
  summary?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CreatePaymentAuthorizationRequest {
  runId: string
  buyerWallet?: string
  amountAtomic?: string
  maxAmountAtomic: string
  currency?: string
  tokenMint?: string
  network?: 'solana-devnet' | 'solana-testnet'
  idempotencyKey?: string
  publicMetadata?: Record<string, unknown>
}

export interface KairoPaymentAuthorization {
  authorizationId: string
  runId: string
  receiptId: string | null
  status: string
  escrowState: string
  escrowReference: string | null
  proofReference: string | null
  chainProofReference: string | null
}

export interface KairoReceipt {
  receiptId: string
  runId: string
  agentId: string
  agentName: string
  status: string
  receiptHash: string
  publicProofEnvelope: Record<string, unknown> | null
  createdAt: string
}

export interface KairoWebhookEvent<T = Record<string, unknown>> {
  id: string
  type:
    | 'run.created'
    | 'payment.authorized'
    | 'escrow.held'
    | 'deliverable.submitted'
    | 'receipt.created'
    | 'dispute.opened'
    | 'refund.completed'
  created: number
  data: T
}

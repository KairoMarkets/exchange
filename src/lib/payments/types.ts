export const PAYMENT_AUTHORIZATION_STATUSES = [
  'quoted',
  'authorization_requested',
  'wallet_approved',
  'proof_pending',
  'proof_recorded',
  'settled',
  'failed',
  'refunded',
  'disputed',
  'expired',
] as const

export const PAYMENT_PROVIDERS = ['payai'] as const
export const PAYMENT_NETWORKS = ['solana-Solana mainnet', 'solana-devnet'] as const
export const CREATOR_PAYOUT_STATUSES = ['pending', 'eligible', 'paid', 'blocked'] as const
export const EVALUATOR_ATTESTATION_STATUSES = ['not_required', 'pending', 'approved', 'rejected'] as const
export const ESCROW_ADAPTER_STATUSES = ['none', 'held', 'released', 'refunded', 'disputed'] as const

export type PaymentAuthorizationStatus = (typeof PAYMENT_AUTHORIZATION_STATUSES)[number]
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]
export type PaymentNetwork = (typeof PAYMENT_NETWORKS)[number]
export type CreatorPayoutStatus = (typeof CREATOR_PAYOUT_STATUSES)[number]
export type EvaluatorAttestationStatus = (typeof EVALUATOR_ATTESTATION_STATUSES)[number]
export type EscrowAdapterStatus = (typeof ESCROW_ADAPTER_STATUSES)[number]

export interface PaymentStateEvent {
  status: PaymentAuthorizationStatus
  at: string
  note: string
}

export interface ProviderMetadata {
  mode: 'manual_sol_proof'
  providerReferenceId: string | null
  paymentRequirement: Record<string, unknown>
  sanitized: Record<string, unknown>
}

export interface PaymentAuthorizationRecord {
  id: string
  authorizationId: string
  runId: string
  receiptId: string | null
  buyerWallet: string
  creatorWallet: string
  agentId: string
  agentName: string
  amountAtomic: string
  amountSol: string
  maxAmountAtomic: string
  currency: string
  tokenMint: string
  network: PaymentNetwork
  provider: PaymentProvider
  providerPaymentReferenceId: string | null
  nonce: string
  idempotencyKey: string
  status: PaymentAuthorizationStatus
  signedAuthorizationPayloadHash: string | null
  proofPayloadHash: string | null
  proofReference: string | null
  proofRecordedAt: string | null
  settledAt: string | null
  expiresAt: string
  platformFeeAtomic: string
  creatorPayoutAtomic: string
  creatorPayoutStatus: CreatorPayoutStatus
  evaluatorAttestationStatus: EvaluatorAttestationStatus
  chainProofReference: string | null
  escrowAdapter: 'payai_manual_devnet' | 'solana_escrow'
  escrowState: EscrowAdapterStatus
  escrowReference: string | null
  publicMetadata: Record<string, unknown>
  privateMetadata: Record<string, unknown>
  providerMetadata: ProviderMetadata
  stateEvents: PaymentStateEvent[]
  createdAt: string
  updatedAt: string
}

export interface CreatePaymentAuthorizationInput {
  runId: string
  buyerWallet: string
  maxAmountAtomic: string
  amountAtomic?: string
  currency?: string
  tokenMint?: string
  network?: string
  idempotencyKey?: string
  expiresAt?: string
  publicMetadata?: Record<string, unknown>
  privateMetadata?: Record<string, unknown>
  providerMetadata?: Record<string, unknown>
  evaluatorRequired?: boolean
}

export interface ApprovePaymentAuthorizationInput {
  authorizationId: string
  buyerWallet: string
  walletApprovalSignature: string
  signedAuthorizationPayload?: string
  providerPaymentReferenceId?: string
}

export interface RecordPaymentProofInput {
  authorizationId: string
  buyerWallet: string
  transactionSignature: string
  providerProofId?: string
  receiptId?: string
  settlementStatus?: 'proof_recorded' | 'settled'
  proofMetadata?: Record<string, unknown>
}

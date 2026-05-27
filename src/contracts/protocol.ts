export type KairoProtocolSurface = 'run' | 'payment_authorization' | 'receipt' | 'private_thread' | 'webhook'

export interface KairoContractEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  surface: KairoProtocolSurface
  version: '2026-05-public-interface'
  id: string
  createdAt: string
  payload: TPayload
}

export interface ReceiptProjectionPayload extends Record<string, unknown> {
  runId: string
  receiptHash: string
  proofReference?: string
  privateContentRedacted: true
}

export interface PaymentAuthorizationPayload extends Record<string, unknown> {
  runId: string
  maxAmountAtomic: string
  network: 'solana-mainnet' | 'solana-devnet'
  walletApproved: boolean
}

export function buildContractEnvelope<TPayload extends Record<string, unknown>>(
  surface: KairoProtocolSurface,
  id: string,
  payload: TPayload,
  createdAt = '2026-01-01T00:00:00.000Z'
): KairoContractEnvelope<TPayload> {
  return { surface, version: '2026-05-public-interface', id, createdAt, payload }
}

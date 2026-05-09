import { createHash, randomBytes } from 'crypto'
import {
  PaymentNetwork,
  PAYMENT_NETWORKS,
  ProviderMetadata,
} from './types'
import {
  assertSolAmountWithinCap,
  paymentNetworkForCluster,
  resolveServerEscrowWallet,
} from '@/lib/solana/escrow'

const SENSITIVE_KEYS = [
  'PAYMENT-SIGNATURE',
  'X-PAYMENT',
  'paymentSignature',
  'signedTransaction',
  'signedPayload',
  'authorization',
  'apiKey',
  'apiKeySecret',
  'bearer',
  'privateKey',
  'seedPhrase',
]

export function generatePaymentAuthorizationId(): string {
  return `pauth-${Date.now()}-${randomBytes(6).toString('hex')}`
}

export function generatePaymentNonce(): string {
  return randomBytes(16).toString('hex')
}

export function hashSensitivePayload(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function assertRailGuard(input: {
  network: string
  maxAmountAtomic: string
  amountAtomic: string
  currency?: string
  providerMetadata?: Record<string, unknown>
}): PaymentNetwork {
  if (!PAYMENT_NETWORKS.includes(input.network as PaymentNetwork)) {
    throw new Error('RailGuard allows only solana-Solana mainnet or solana-devnet')
  }
  if (input.network === 'solana-Solana mainnet' && paymentNetworkForCluster() !== 'solana-Solana mainnet') {
    throw new Error('RailGuard allows mainnet payment authorization only when Kairo mainnet Solana cluster is configured')
  }
  if (input.network === 'solana-Solana mainnet' && !resolveServerEscrowWallet(input.network)) {
    throw new Error('Kairo escrow recipient is not configured')
  }
  if ((input.currency ?? 'SOL').toUpperCase() !== 'SOL') {
    throw new Error('RailGuard allows only SOL payment authorization')
  }

  const maxAmount = BigInt(input.maxAmountAtomic)
  const amount = BigInt(input.amountAtomic)
  if (maxAmount <= BigInt(0)) throw new Error('RailGuard requires a non-zero max amount')
  if (amount <= BigInt(0)) throw new Error('Payment amount must be non-zero')
  if (amount > maxAmount) throw new Error('Payment amount exceeds max amount')
  assertSolAmountWithinCap(amount.toString())

  const metadata = input.providerMetadata ?? {}
  for (const key of Object.keys(metadata)) {
    if (SENSITIVE_KEYS.some(sensitive => sensitive.toLowerCase() === key.toLowerCase())) {
      throw new Error(`RailGuard rejects sensitive provider metadata key: ${key}`)
    }
  }

  return input.network as PaymentNetwork
}

export function sanitizeProviderMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const source = metadata ?? {}
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (SENSITIVE_KEYS.some(sensitive => sensitive.toLowerCase() === key.toLowerCase())) {
      sanitized[key] = '[redacted]'
      continue
    }
    if (typeof value === 'string' && value.length > 180) {
      sanitized[key] = `${value.slice(0, 64)}...[redacted]`
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' || value === null) {
      sanitized[key] = value
    }
  }
  return sanitized
}

export function buildProviderMetadata(input: {
  providerReferenceId: string | null
  paymentRequirement: Record<string, unknown>
  rawMetadata?: Record<string, unknown>
}): ProviderMetadata {
  return {
    mode: 'manual_sol_proof',
    providerReferenceId: input.providerReferenceId,
    paymentRequirement: input.paymentRequirement,
    sanitized: sanitizeProviderMetadata(input.rawMetadata),
  }
}

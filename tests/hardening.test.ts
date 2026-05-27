import { afterEach, describe, expect, it } from 'vitest'
import {
  paymentNetworkForCluster,
  normalizePaymentNetwork,
  normalizeSolanaCluster,
  buildSolanaExplorerUrl,
} from '@/lib/solana/escrow'
import { resolvePrivateA2aEncryptionSecret, requirePrivateA2aEncryptionConfigured } from '@/lib/private-a2a'
import { getPaymentAuthorizationForRun, getPaymentAuthorizationRecord } from '@/lib/payments/store'

const envKeys = [
  'KAIRO_PRIVATE_A2A_ENCRYPTION_KEY',
  'KAIRO_ENCRYPTION_KEY',
  'DATABASE_URL',
  'DATABASE_POSTGRES_URL',
  'POSTGRES_URL',
  'VERCEL',
]

afterEach(() => {
  for (const key of envKeys) delete process.env[key]
})

describe('protocol interface hardening', () => {
  it('uses the documented private A2A encryption variable and keeps a legacy alias', () => {
    process.env.KAIRO_PRIVATE_A2A_ENCRYPTION_KEY = 'documented-secret'
    process.env.KAIRO_ENCRYPTION_KEY = 'legacy-secret'
    expect(resolvePrivateA2aEncryptionSecret()).toBe('documented-secret')
    expect(() => requirePrivateA2aEncryptionConfigured()).not.toThrow()

    delete process.env.KAIRO_PRIVATE_A2A_ENCRYPTION_KEY
    expect(resolvePrivateA2aEncryptionSecret()).toBe('legacy-secret')
  })

  it('fails closed when private A2A encryption is not configured', () => {
    expect(resolvePrivateA2aEncryptionSecret()).toBeNull()
    expect(() => requirePrivateA2aEncryptionConfigured()).toThrow('Private A2A encryption is not configured')
  })

  it('normalizes Solana network labels into code-safe values', () => {
    expect(normalizeSolanaCluster('Solana mainnet')).toBe('mainnet')
    expect(normalizeSolanaCluster('mainnet-beta')).toBe('mainnet')
    expect(normalizeSolanaCluster('solana-devnet')).toBe('devnet')
    expect(paymentNetworkForCluster('mainnet')).toBe('solana-mainnet')
    expect(paymentNetworkForCluster('devnet')).toBe('solana-devnet')
    expect(normalizePaymentNetwork('solana-mainnet')).toBe('mainnet')
    expect(normalizePaymentNetwork('Solana mainnet')).toBe('mainnet')
    expect(normalizePaymentNetwork('solana-devnet')).toBe('devnet')
    expect(() => normalizePaymentNetwork('mainnet-like')).toThrow('Solana mainnet or devnet')
  })

  it('renders explorer URLs with public Solana labels only where needed', () => {
    expect(buildSolanaExplorerUrl('abc123', 'solana-mainnet')).toBe('https://explorer.solana.com/tx/abc123')
    expect(buildSolanaExplorerUrl('abc123', 'solana-devnet')).toBe('https://explorer.solana.com/tx/abc123?cluster=devnet')
  })

  it('does not synthesize payment authorization records without backing state', async () => {
    process.env.VERCEL = '1'
    await expect(getPaymentAuthorizationRecord('pauth-arbitrary')).resolves.toBeNull()
    await expect(getPaymentAuthorizationForRun('run-arbitrary')).resolves.toBeNull()
  })
})

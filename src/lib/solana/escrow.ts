import { PublicKey, SystemProgram, Transaction, clusterApiUrl } from '@solana/web3.js'

export type KairoSolanaCluster = 'mainnet' | 'devnet'
export type KairoPaymentNetwork = 'solana-mainnet' | 'solana-devnet'

export const SOL_LAMPORTS = BigInt(1_000_000_000)
export const KAIRO_MAINNET_SOL_PAYMENT_CAP = BigInt(10) * SOL_LAMPORTS

export function normalizeSolanaCluster(value: string): KairoSolanaCluster {
  const normalized = value.trim().toLowerCase()
  if (['mainnet', 'mainnet-beta', 'solana-mainnet', 'solana mainnet'].includes(normalized)) return 'mainnet'
  if (['devnet', 'solana-devnet', 'solana devnet'].includes(normalized)) return 'devnet'
  throw new Error('Kairo Solana cluster must be Solana mainnet or devnet')
}

export function normalizePaymentNetwork(network: string): KairoSolanaCluster {
  const normalized = network.trim().toLowerCase()
  if (['solana-mainnet', 'mainnet', 'mainnet-beta', 'solana mainnet', 'solana'].includes(normalized)) return 'mainnet'
  if (['solana-devnet', 'devnet', 'solana devnet'].includes(normalized)) return 'devnet'
  throw new Error('Escrow deposits are only available on Solana mainnet or devnet')
}

export function paymentNetworkForCluster(cluster = resolveConfiguredSolanaCluster()): KairoPaymentNetwork {
  return normalizeSolanaCluster(cluster) === 'mainnet' ? 'solana-mainnet' : 'solana-devnet'
}

export function resolveConfiguredSolanaCluster(): KairoSolanaCluster {
  return normalizeSolanaCluster(process.env.NEXT_PUBLIC_KAIRO_SOLANA_CLUSTER || process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet')
}

export function resolveSolanaRpcEndpoint(network = paymentNetworkForCluster()): string {
  const configured = process.env.NEXT_PUBLIC_KAIRO_SOLANA_RPC_ENDPOINT?.trim() || process.env.NEXT_PUBLIC_RPC_ENDPOINT?.trim()
  if (configured) return configured
  return clusterApiUrl(normalizePaymentNetwork(network) === 'mainnet' ? 'mainnet-beta' : 'devnet')
}

export function buildSolanaExplorerUrl(signature: string, network: string): string {
  const cluster = normalizePaymentNetwork(network)
  const base = `https://explorer.solana.com/tx/${signature}`
  return cluster === 'mainnet' ? base : `${base}?cluster=devnet`
}

export function buildReferenceTransfer(input: { from: string; to: string; lamports: number }): Transaction {
  const fromPubkey = new PublicKey(input.from)
  const toPubkey = new PublicKey(input.to)
  return new Transaction().add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports: input.lamports }))
}

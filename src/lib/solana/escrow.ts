import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  type Cluster,
  type ParsedInstruction,
  type PartiallyDecodedInstruction,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js'

export const KAIRO_ESCROW_MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
)

export const SOL_LAMPORTS = BigInt(1_000_000_000)
export const KAIRO_MAINNET_SOL_PAYMENT_CAP = BigInt(10) * SOL_LAMPORTS
export const DEFAULT_KAIRO_MAINNET_ESCROW_WALLET =
  'zCu4ZQKr3o3UW2EccVLuE9YxLYx98f7q6phjmkywhkQ'

export type KairoSolanaCluster = 'Solana mainnet' | 'devnet'
export type KairoPaymentNetwork = 'solana-Solana mainnet' | 'solana-devnet'

interface EscrowTransferInput {
  buyerWallet: string
  escrowWallet: string
  amountAtomic: string
  authorizationId: string
  runId: string
}

export interface EscrowTransferVerificationInput extends EscrowTransferInput {
  transactionSignature: string
  network: string
  rpcEndpoint?: string
}

export interface EscrowTransferVerification {
  transactionSignature: string
  explorerUrl: string
  memo: string
  recipientWallet: string
  buyerWallet: string
  lamportsTransferred: string
}

export function buildKairoEscrowMemo(input: {
  authorizationId: string
  runId: string
}): string {
  return `KAIRO:${input.authorizationId}:${input.runId}`
}

export function resolveConfiguredSolanaCluster(): KairoSolanaCluster {
  return normalizeSolanaCluster(
    process.env.NEXT_PUBLIC_KAIRO_SOLANA_CLUSTER ||
      process.env.NEXT_PUBLIC_SOLANA_NETWORK ||
      'devnet'
  )
}

export function paymentNetworkForCluster(cluster = resolveConfiguredSolanaCluster()): KairoPaymentNetwork {
  return cluster === 'Solana mainnet' ? 'solana-Solana mainnet' : 'solana-devnet'
}

export function resolveClientEscrowWallet(network = paymentNetworkForCluster()): string | null {
  if (normalizePaymentNetwork(network) === 'Solana mainnet') {
    return normalizeEscrowWallet(
      process.env.NEXT_PUBLIC_KAIRO_MAINNET_ESCROW_WALLET
    )
  }
  return normalizeEscrowWallet(process.env.NEXT_PUBLIC_KAIRO_DEVNET_ESCROW_WALLET)
}

export function resolveServerEscrowWallet(network = paymentNetworkForCluster()): string | null {
  if (normalizePaymentNetwork(network) === 'Solana mainnet') {
    return normalizeEscrowWallet(
      process.env.KAIRO_MAINNET_ESCROW_WALLET ||
        process.env.NEXT_PUBLIC_KAIRO_MAINNET_ESCROW_WALLET
    )
  }
  return normalizeEscrowWallet(
    process.env.KAIRO_DEVNET_ESCROW_WALLET ||
      process.env.NEXT_PUBLIC_KAIRO_DEVNET_ESCROW_WALLET
  )
}

export function normalizeEscrowWallet(value: string | undefined): string | null {
  const wallet = value?.trim()
  if (!wallet) return null
  try {
    return new PublicKey(wallet).toBase58()
  } catch {
    return null
  }
}

export function normalizeSolanaCluster(value: string): KairoSolanaCluster {
  const cluster = value.trim().toLowerCase()
  if (cluster === 'Solana mainnet' || cluster === 'mainnet' || cluster === 'solana-Solana mainnet') {
    return 'Solana mainnet'
  }
  if (cluster === 'devnet' || cluster === 'solana-devnet') return 'devnet'
  throw new Error('Kairo Solana cluster must be Solana mainnet or devnet')
}

export function normalizePaymentNetwork(network: string): KairoSolanaCluster {
  const value = network.trim().toLowerCase()
  if (value === 'solana-Solana mainnet' || value === 'Solana mainnet' || value === 'solana') {
    return 'Solana mainnet'
  }
  if (value === 'solana-devnet' || value === 'devnet') return 'devnet'
  throw new Error('Escrow deposits are only available on Solana Solana mainnet or devnet')
}

export function resolveSolanaRpcEndpoint(network: string): string {
  const configured =
    process.env.NEXT_PUBLIC_KAIRO_SOLANA_RPC_ENDPOINT?.trim() ||
    process.env.NEXT_PUBLIC_RPC_ENDPOINT?.trim()
  if (configured) return configured
  const cluster = normalizePaymentNetwork(network)
  return clusterApiUrl(cluster as Cluster)
}

export function buildSolanaExplorerUrl(signature: string, network: string): string {
  const cluster = normalizePaymentNetwork(network)
  const base = `https://explorer.solana.com/tx/${signature}`
  return cluster === 'Solana mainnet' ? base : `${base}?cluster=${cluster}`
}

export function resolveMaxSolPerRunLamports(): bigint {
  const configured = process.env.KAIRO_MAX_SOL_PER_RUN || process.env.NEXT_PUBLIC_KAIRO_MAX_SOL_PER_RUN
  if (!configured?.trim()) return KAIRO_MAINNET_SOL_PAYMENT_CAP
  const parsed = solDecimalToLamports(configured)
  if (parsed <= BigInt(0)) return KAIRO_MAINNET_SOL_PAYMENT_CAP
  return parsed > KAIRO_MAINNET_SOL_PAYMENT_CAP ? KAIRO_MAINNET_SOL_PAYMENT_CAP : parsed
}

export function assertSolAmountWithinCap(amountAtomic: string): void {
  const amount = BigInt(amountAtomic)
  if (amount <= BigInt(0)) throw new Error('Payment amount must be greater than zero')
  if (amount > resolveMaxSolPerRunLamports()) {
    throw new Error('Kairo SOL payments are limited to 10 SOL per run')
  }
}

export function buildEscrowTransferTransaction(input: EscrowTransferInput): Transaction {
  const buyer = new PublicKey(input.buyerWallet)
  const escrow = new PublicKey(input.escrowWallet)
  const lamports = parseLamports(input.amountAtomic)
  const memo = buildKairoEscrowMemo(input)

  return new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: buyer,
      toPubkey: escrow,
      lamports,
    }),
    new TransactionInstruction({
      keys: [],
      programId: KAIRO_ESCROW_MEMO_PROGRAM_ID,
      data: new TextEncoder().encode(memo) as Buffer,
    })
  )
}

export async function verifyEscrowTransfer(
  input: EscrowTransferVerificationInput
): Promise<EscrowTransferVerification> {
  const signature = input.transactionSignature.trim()
  if (!signature) throw new Error('transactionSignature is required')
  if (signature.startsWith('smoke-deposit-') || signature.startsWith('local-')) {
    throw new Error('Escrow deposit requires a real Solana transaction signature')
  }

  const expectedMemo = buildKairoEscrowMemo(input)
  const buyer = new PublicKey(input.buyerWallet).toBase58()
  const escrow = new PublicKey(input.escrowWallet).toBase58()
  const expectedLamports = BigInt(parseLamports(input.amountAtomic))
  const connection = new Connection(
    input.rpcEndpoint?.trim() || resolveSolanaRpcEndpoint(input.network),
    'confirmed'
  )

  const transaction = await connection.getParsedTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })
  if (!transaction) throw new Error('Solana transaction was not found on the configured cluster')
  if (transaction.meta?.err) throw new Error('Solana transaction failed on-chain')

  const signerKeys = transaction.transaction.message.accountKeys
    .filter(account => account.signer)
    .map(account => account.pubkey.toBase58())
  if (!signerKeys.includes(buyer)) {
    throw new Error('Solana transaction was not signed by the buyer wallet')
  }

  const lamportsTransferred = findSystemTransferLamports(transaction, buyer, escrow)
  if (lamportsTransferred < expectedLamports) {
    throw new Error('Solana transaction amount is below the authorized payment amount')
  }
  if (lamportsTransferred > expectedLamports) {
    throw new Error('Solana transaction amount is above the authorized payment amount')
  }

  const memo = findMemo(transaction)
  if (memo !== expectedMemo) {
    throw new Error('Solana transaction memo does not match this payment authorization')
  }

  return {
    transactionSignature: signature,
    explorerUrl: buildSolanaExplorerUrl(signature, input.network),
    memo,
    recipientWallet: escrow,
    buyerWallet: buyer,
    lamportsTransferred: lamportsTransferred.toString(),
  }
}

export const verifyDevnetEscrowTransfer = verifyEscrowTransfer

function parseLamports(value: string): number {
  const lamports = BigInt(value)
  if (lamports <= BigInt(0)) throw new Error('Escrow transfer amount must be greater than zero')
  if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Escrow transfer amount exceeds supported wallet transaction range')
  }
  return Number(lamports)
}

function solDecimalToLamports(value: string): bigint {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,9})?$/.test(trimmed)) {
    throw new Error('Kairo max SOL cap must be a positive decimal with up to 9 decimals')
  }
  const [wholeRaw, fractionRaw = ''] = trimmed.split('.')
  return BigInt(wholeRaw || '0') * SOL_LAMPORTS + BigInt(fractionRaw.padEnd(9, '0'))
}

function findSystemTransferLamports(
  transaction: ParsedTransactionWithMeta,
  buyerWallet: string,
  escrowWallet: string
): bigint {
  let total = BigInt(0)
  for (const instruction of transaction.transaction.message.instructions) {
    if (!isParsedInstruction(instruction)) continue
    if (instruction.program !== 'system') continue
    const parsed = instruction.parsed as
      | { type?: string; info?: { source?: string; destination?: string; lamports?: number | string } }
      | undefined
    if (
      parsed?.type === 'transfer' &&
      parsed.info?.source === buyerWallet &&
      parsed.info.destination === escrowWallet &&
      parsed.info.lamports !== undefined
    ) {
      total += BigInt(parsed.info.lamports)
    }
  }
  return total
}

function findMemo(transaction: ParsedTransactionWithMeta): string | null {
  for (const instruction of transaction.transaction.message.instructions) {
    if (
      isParsedInstruction(instruction) &&
      (instruction.program === 'spl-memo' ||
        instruction.programId.equals(KAIRO_ESCROW_MEMO_PROGRAM_ID))
    ) {
      return typeof instruction.parsed === 'string' ? instruction.parsed : null
    }
  }
  return null
}

function isParsedInstruction(
  instruction: ParsedInstruction | PartiallyDecodedInstruction
): instruction is ParsedInstruction {
  return 'parsed' in instruction
}

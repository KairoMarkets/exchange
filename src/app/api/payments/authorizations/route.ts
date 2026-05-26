import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { databaseError, notFoundError, validationError, forbiddenError } from '@/lib/api-error'
import { requireAuthenticatedWallet, requireMatchingWalletHint } from '@/lib/auth'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { createPayAiManualDevnetAdapter } from '@/lib/payments/providers/payai/adapter'
import { buildStateEvent } from '@/lib/payments/settlement-state'
import { generatePaymentAuthorizationId } from '@/lib/payments/proof-adapter'
import { createPaymentAuthorizationRecord, paymentRecordToPublic } from '@/lib/payments/store'
import { PaymentAuthorizationRecord } from '@/lib/payments/types'
import { paymentNetworkForCluster } from '@/lib/solana/escrow'

const PLATFORM_FEE_BPS = BigInt(250)
const ATOMIC_UNITS_PER_SOL = BigInt(1_000_000_000)

interface CreateAuthorizationBody {
  runId?: string
  buyerWallet?: string
  amountAtomic?: string
  maxAmountAtomic?: string
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

interface RunPaymentContext {
  runId: string
  agentId: string
  agentName: string
  buyerWallet: string
  creatorWallet: string
  amountSol: string
  status: string
}

export async function POST(request: NextRequest) {
  let body: CreateAuthorizationBody = {}
  try {
    body = await request.json()
  } catch {
    return validationError('Request body must be valid JSON', 'POST /api/payments/authorizations')
  }

  const auth = requireAuthenticatedWallet(request, 'POST /api/payments/authorizations')
  if (auth instanceof NextResponse) return auth
  const hintError = requireMatchingWalletHint(
    auth.wallet,
    body.buyerWallet,
    'buyerWallet',
    'POST /api/payments/authorizations'
  )
  if (hintError) return hintError

  const runId = body.runId?.trim()
  if (!runId) return validationError('runId is required', 'POST /api/payments/authorizations', auth.wallet)
  if (!body.maxAmountAtomic?.trim()) {
    return validationError('maxAmountAtomic is required', 'POST /api/payments/authorizations', auth.wallet)
  }

  try {
    const run = await loadRunPaymentContext(runId)
    if (!run) return notFoundError('Run', 'POST /api/payments/authorizations', auth.wallet)
    if (run.buyerWallet !== auth.wallet) {
      return forbiddenError('Only the buyer may create payment authorization', 'POST /api/payments/authorizations', auth.wallet)
    }

    const amountAtomic = body.amountAtomic?.trim() || solToAtomic(run.amountSol)
    const maxAmountAtomic = body.maxAmountAtomic.trim()
    const authorizationId = generatePaymentAuthorizationId()
    const now = new Date().toISOString()
    const expiresAt =
      body.expiresAt?.trim() ||
      new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const adapter = createPayAiManualDevnetAdapter()
    const quote = adapter.prepareAuthorization({
      authorizationId,
      runId,
      buyerWallet: auth.wallet,
      creatorWallet: run.creatorWallet,
      amountAtomic,
      maxAmountAtomic,
      currency: body.currency?.trim() || 'SOL',
      tokenMint: body.tokenMint,
      network: body.network?.trim() || paymentNetworkForCluster(),
      providerMetadata: body.providerMetadata,
      expiresAt,
    })

    const platformFeeAtomic = (BigInt(amountAtomic) * PLATFORM_FEE_BPS / BigInt(10_000)).toString()
    const creatorPayoutAtomic = (BigInt(amountAtomic) - BigInt(platformFeeAtomic)).toString()
    const record: Omit<PaymentAuthorizationRecord, 'id'> = {
      authorizationId,
      runId,
      receiptId: null,
      buyerWallet: auth.wallet,
      creatorWallet: run.creatorWallet,
      agentId: run.agentId,
      agentName: run.agentName,
      amountAtomic,
      amountSol: run.amountSol,
      maxAmountAtomic,
      currency: body.currency?.trim() || 'SOL',
      tokenMint: quote.tokenMint,
      network: quote.network,
      provider: 'payai',
      providerPaymentReferenceId: null,
      nonce: quote.nonce,
      idempotencyKey: body.idempotencyKey?.trim() || authorizationId,
      status: 'authorization_requested',
      signedAuthorizationPayloadHash: null,
      proofPayloadHash: null,
      proofReference: null,
      proofRecordedAt: null,
      settledAt: null,
      expiresAt,
      platformFeeAtomic,
      creatorPayoutAtomic,
      creatorPayoutStatus: 'pending',
      evaluatorAttestationStatus: body.evaluatorRequired ? 'pending' : 'not_required',
      chainProofReference: null,
      escrowAdapter: 'payai_manual_devnet',
      escrowState: 'none',
      escrowReference: null,
      publicMetadata: {
        ...(body.publicMetadata ?? {}),
        ...quote.publicMetadata,
      },
      privateMetadata: body.privateMetadata ?? {},
      providerMetadata: quote.providerMetadata,
      stateEvents: [
        buildStateEvent('quoted', 'CipherSpend Intent quoted', now),
        buildStateEvent('authorization_requested', 'Wallet approval requested', now),
      ],
      createdAt: now,
      updatedAt: now,
    }

    const created = await createPaymentAuthorizationRecord(record)
    return NextResponse.json({ authorization: paymentRecordToPublic(created) }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof SyntaxError || error instanceof RangeError || error instanceof Error) {
      return validationError(error.message, 'POST /api/payments/authorizations', auth.wallet)
    }
    return databaseError('POST /api/payments/authorizations', error, auth.wallet)
  }
}

async function loadRunPaymentContext(runId: string): Promise<RunPaymentContext | null> {
  if (!shouldUsePostgres()) {
    const run = devnetStore.getRun(runId)
    if (!run) return null
    return {
      runId: run.run_id,
      agentId: run.agent_id,
      agentName: run.agent_name,
      buyerWallet: run.buyer_wallet,
      creatorWallet: run.creator_wallet,
      amountSol: run.amount_sol,
      status: run.status,
    }
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT run_id, agent_id, agent_name, buyer_wallet, creator_wallet, amount_sol, status
       FROM runs WHERE run_id = $1`,
      [runId]
    )
    if (result.rows.length === 0) return null
    const row = result.rows[0] as Record<string, unknown>
    return {
      runId: String(row.run_id),
      agentId: String(row.agent_id),
      agentName: String(row.agent_name),
      buyerWallet: String(row.buyer_wallet),
      creatorWallet: String(row.creator_wallet),
      amountSol: String(row.amount_sol),
      status: String(row.status),
    }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

function solToAtomic(amountSol: string): string {
  const [wholeRaw, fractionRaw = ''] = amountSol.split('.')
  const whole = BigInt(wholeRaw || '0') * ATOMIC_UNITS_PER_SOL
  const fraction = BigInt((fractionRaw.padEnd(9, '0').slice(0, 9)) || '0')
  return (whole + fraction).toString()
}

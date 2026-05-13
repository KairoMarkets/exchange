import { createPool } from '@/lib/db'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { PaymentAuthorizationRecord } from './types'

export async function createPaymentAuthorizationRecord(
  record: Omit<PaymentAuthorizationRecord, 'id'>
): Promise<PaymentAuthorizationRecord> {
  if (!shouldUsePostgres()) {
    return toPaymentRecord(devnetStore.createPaymentAuthorization(fromPaymentRecord(record)))
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `INSERT INTO payment_authorizations
        (authorization_id, run_id, receipt_id, buyer_wallet, creator_wallet, agent_id, agent_name,
         amount_atomic, amount_sol, max_amount_atomic, currency, token_mint, network, provider,
         provider_payment_reference_id, nonce, idempotency_key, status,
         signed_authorization_payload_hash, proof_payload_hash, proof_reference, proof_recorded_at,
         settled_at, expires_at, platform_fee_atomic, creator_payout_atomic, creator_payout_status,
         evaluator_attestation_status, chain_proof_reference, escrow_adapter, escrow_state,
         escrow_reference, public_metadata_json, private_metadata_json, provider_metadata_json,
         state_events_json, created_at, updated_at)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
         $25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
       RETURNING *`,
      toSqlParams(record)
    )
    return rowToPaymentRecord(result.rows[0] as Record<string, unknown>)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

export async function getPaymentAuthorizationRecord(
  authorizationId: string
): Promise<PaymentAuthorizationRecord | null> {
  if (!shouldUsePostgres()) {
    const record = devnetStore.getPaymentAuthorization(authorizationId)
    if (record) return toPaymentRecord(record)
    return process.env.VERCEL ? synthesizePaymentAuthorizationRecord(authorizationId) : null
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM payment_authorizations WHERE authorization_id = $1`,
      [authorizationId]
    )
    if (result.rows.length === 0) return null
    return rowToPaymentRecord(result.rows[0] as Record<string, unknown>)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

export async function getPaymentAuthorizationForRun(
  runId: string
): Promise<PaymentAuthorizationRecord | null> {
  if (!shouldUsePostgres()) {
    const record = devnetStore.getPaymentAuthorizationByRunId(runId)
    if (record) return toPaymentRecord(record)
    return process.env.VERCEL ? synthesizePaymentAuthorizationRecord(`auth-${runId}`, { runId, status: 'settled' }) : null
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM payment_authorizations WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [runId]
    )
    if (result.rows.length === 0) return null
    return rowToPaymentRecord(result.rows[0] as Record<string, unknown>)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

export async function updatePaymentAuthorizationRecord(
  authorizationId: string,
  patch: Partial<PaymentAuthorizationRecord>
): Promise<PaymentAuthorizationRecord | null> {
  if (!shouldUsePostgres()) {
    const updated = devnetStore.updatePaymentAuthorization(
      authorizationId,
      fromPaymentRecordPatch(patch)
    )
    if (updated) return toPaymentRecord(updated)
    return process.env.VERCEL
      ? { ...synthesizePaymentAuthorizationRecord(authorizationId), ...patch, updatedAt: new Date().toISOString() }
      : null
  }

  const existing = await getPaymentAuthorizationRecord(authorizationId)
  if (!existing) return null
  const merged: PaymentAuthorizationRecord = { ...existing, ...patch, updatedAt: new Date().toISOString() }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `UPDATE payment_authorizations SET
         receipt_id = $3, provider_payment_reference_id = $15, status = $18,
         signed_authorization_payload_hash = $19, proof_payload_hash = $20,
         proof_reference = $21, proof_recorded_at = $22, settled_at = $23,
         creator_payout_status = $27, evaluator_attestation_status = $28,
         chain_proof_reference = $29, escrow_adapter = $30, escrow_state = $31, escrow_reference = $32,
         public_metadata_json = $33, private_metadata_json = $34,
         provider_metadata_json = $35, state_events_json = $36, updated_at = $38
       WHERE authorization_id = $1
       RETURNING *`,
      toSqlParams(merged)
    )
    return rowToPaymentRecord(result.rows[0] as Record<string, unknown>)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

export function paymentRecordToPublic(record: PaymentAuthorizationRecord) {
  return {
    authorizationId: record.authorizationId,
    runId: record.runId,
    receiptId: record.receiptId,
    buyerWalletRedacted: redactWallet(record.buyerWallet),
    creatorWallet: record.creatorWallet,
    agentId: record.agentId,
    agentName: record.agentName,
    amountAtomic: record.amountAtomic,
    maxAmountAtomic: record.maxAmountAtomic,
    amountSol: record.amountSol,
    currency: record.currency,
    tokenMint: record.tokenMint,
    network: record.network,
    provider: record.provider,
    providerPaymentReferenceId: record.providerPaymentReferenceId,
    status: record.status,
    proofReference: record.proofReference,
    proofRecordedAt: record.proofRecordedAt,
    settledAt: record.settledAt,
    expiresAt: record.expiresAt,
    platformFeeAtomic: record.platformFeeAtomic,
    creatorPayoutAtomic: record.creatorPayoutAtomic,
    creatorPayoutStatus: record.creatorPayoutStatus,
    evaluatorAttestationStatus: record.evaluatorAttestationStatus,
    chainProofReference: record.chainProofReference,
    escrowAdapter: record.escrowAdapter,
    escrowState: record.escrowState,
    publicMetadata: record.publicMetadata,
    providerMetadata: record.providerMetadata,
    stateEvents: record.stateEvents,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export function paymentRecordToReceiptPublic(record: PaymentAuthorizationRecord) {
  return {
    authorizationId: record.authorizationId,
    runId: record.runId,
    receiptId: record.receiptId,
    buyerWalletRedacted: redactWallet(record.buyerWallet),
    creatorWallet: record.creatorWallet,
    agentId: record.agentId,
    agentName: record.agentName,
    amountAtomic: record.amountAtomic,
    maxAmountAtomic: record.maxAmountAtomic,
    amountSol: record.amountSol,
    currency: record.currency,
    tokenMint: record.tokenMint,
    network: record.network,
    status: record.status,
    proofReference: record.proofReference,
    proofPayloadHash: record.proofPayloadHash,
    proofRecordedAt: record.proofRecordedAt,
    settledAt: record.settledAt,
    expiresAt: record.expiresAt,
    platformFeeAtomic: record.platformFeeAtomic,
    creatorPayoutAtomic: record.creatorPayoutAtomic,
    creatorPayoutStatus: record.creatorPayoutStatus,
    evaluatorAttestationStatus: record.evaluatorAttestationStatus,
    chainProofReference: record.chainProofReference,
    escrowAdapter: record.escrowAdapter,
    escrowState: record.escrowState,
    escrowReference: record.escrowReference,
    paymentProof: safeRecordObject(record.publicMetadata.paymentProof),
    escrowProof: safeRecordObject(record.publicMetadata.escrowProof),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function safeRecordObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function redactWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

function synthesizePaymentAuthorizationRecord(
  authorizationId: string,
  overrides: Partial<PaymentAuthorizationRecord> = {}
): PaymentAuthorizationRecord {
  const now = new Date().toISOString()
  return {
    id: authorizationId,
    authorizationId,
    runId: authorizationId.replace(/^auth-/, '') || 'run-devnet-fallback',
    receiptId: null,
    buyerWallet: '',
    creatorWallet: 'DevCreat0r1111111111111111111111111111111111',
    agentId: 'kairo-devnet-agent',
    agentName: 'Kairo Devnet Agent',
    amountAtomic: '10000000',
    amountSol: '0.01',
    maxAmountAtomic: '10000000',
    currency: 'SOL',
    tokenMint: 'So11111111111111111111111111111111111111112',
    network: 'solana-devnet',
    provider: 'payai',
    providerPaymentReferenceId: null,
    nonce: authorizationId,
    idempotencyKey: authorizationId,
    status: 'authorization_requested',
    signedAuthorizationPayloadHash: null,
    proofPayloadHash: null,
    proofReference: null,
    proofRecordedAt: null,
    settledAt: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    platformFeeAtomic: '250000',
    creatorPayoutAtomic: '9750000',
    creatorPayoutStatus: 'pending',
    evaluatorAttestationStatus: 'not_required',
    chainProofReference: null,
    escrowAdapter: 'payai_manual_devnet',
    escrowState: 'none',
    escrowReference: null,
    publicMetadata: {},
    privateMetadata: {},
    providerMetadata: {
      mode: 'manual_sol_proof',
      providerReferenceId: null,
      paymentRequirement: {},
      sanitized: {},
    },
    stateEvents: [{ status: 'authorization_requested', at: now, note: 'Devnet fallback authorization synthesized' }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

type DevnetPaymentAuthorization = Parameters<typeof devnetStore.createPaymentAuthorization>[0] & { id: string }

function fromPaymentRecord(record: Omit<PaymentAuthorizationRecord, 'id'>) {
  return {
    authorization_id: record.authorizationId,
    run_id: record.runId,
    receipt_id: record.receiptId,
    buyer_wallet: record.buyerWallet,
    creator_wallet: record.creatorWallet,
    agent_id: record.agentId,
    agent_name: record.agentName,
    amount_atomic: record.amountAtomic,
    amount_sol: record.amountSol,
    max_amount_atomic: record.maxAmountAtomic,
    currency: record.currency,
    token_mint: record.tokenMint,
    network: record.network,
    provider: record.provider,
    provider_payment_reference_id: record.providerPaymentReferenceId,
    nonce: record.nonce,
    idempotency_key: record.idempotencyKey,
    status: record.status,
    signed_authorization_payload_hash: record.signedAuthorizationPayloadHash,
    proof_payload_hash: record.proofPayloadHash,
    proof_reference: record.proofReference,
    proof_recorded_at: record.proofRecordedAt,
    settled_at: record.settledAt,
    expires_at: record.expiresAt,
    platform_fee_atomic: record.platformFeeAtomic,
    creator_payout_atomic: record.creatorPayoutAtomic,
    creator_payout_status: record.creatorPayoutStatus,
    evaluator_attestation_status: record.evaluatorAttestationStatus,
    chain_proof_reference: record.chainProofReference,
    escrow_adapter: record.escrowAdapter,
    escrow_state: record.escrowState,
    escrow_reference: record.escrowReference,
    public_metadata_json: record.publicMetadata,
    private_metadata_json: record.privateMetadata,
    provider_metadata_json: record.providerMetadata,
    state_events_json: record.stateEvents,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  }
}

function fromPaymentRecordPatch(patch: Partial<PaymentAuthorizationRecord>) {
  const output: Partial<ReturnType<typeof fromPaymentRecord>> = {}
  if (patch.receiptId !== undefined) output.receipt_id = patch.receiptId
  if (patch.providerPaymentReferenceId !== undefined) output.provider_payment_reference_id = patch.providerPaymentReferenceId
  if (patch.status !== undefined) output.status = patch.status
  if (patch.signedAuthorizationPayloadHash !== undefined) output.signed_authorization_payload_hash = patch.signedAuthorizationPayloadHash
  if (patch.proofPayloadHash !== undefined) output.proof_payload_hash = patch.proofPayloadHash
  if (patch.proofReference !== undefined) output.proof_reference = patch.proofReference
  if (patch.proofRecordedAt !== undefined) output.proof_recorded_at = patch.proofRecordedAt
  if (patch.settledAt !== undefined) output.settled_at = patch.settledAt
  if (patch.creatorPayoutStatus !== undefined) output.creator_payout_status = patch.creatorPayoutStatus
  if (patch.evaluatorAttestationStatus !== undefined) output.evaluator_attestation_status = patch.evaluatorAttestationStatus
  if (patch.chainProofReference !== undefined) output.chain_proof_reference = patch.chainProofReference
  if (patch.escrowAdapter !== undefined) output.escrow_adapter = patch.escrowAdapter
  if (patch.escrowState !== undefined) output.escrow_state = patch.escrowState
  if (patch.escrowReference !== undefined) output.escrow_reference = patch.escrowReference
  if (patch.publicMetadata !== undefined) output.public_metadata_json = patch.publicMetadata
  if (patch.privateMetadata !== undefined) output.private_metadata_json = patch.privateMetadata
  if (patch.providerMetadata !== undefined) output.provider_metadata_json = patch.providerMetadata
  if (patch.stateEvents !== undefined) output.state_events_json = patch.stateEvents
  output.updated_at = new Date().toISOString()
  return output
}

function toPaymentRecord(record: DevnetPaymentAuthorization): PaymentAuthorizationRecord {
  return {
    id: record.id,
    authorizationId: record.authorization_id,
    runId: record.run_id,
    receiptId: record.receipt_id,
    buyerWallet: record.buyer_wallet,
    creatorWallet: record.creator_wallet,
    agentId: record.agent_id,
    agentName: record.agent_name,
    amountAtomic: record.amount_atomic,
    amountSol: record.amount_sol,
    maxAmountAtomic: record.max_amount_atomic,
    currency: record.currency,
    tokenMint: record.token_mint,
    network: record.network,
    provider: record.provider,
    providerPaymentReferenceId: record.provider_payment_reference_id,
    nonce: record.nonce,
    idempotencyKey: record.idempotency_key,
    status: record.status,
    signedAuthorizationPayloadHash: record.signed_authorization_payload_hash,
    proofPayloadHash: record.proof_payload_hash,
    proofReference: record.proof_reference,
    proofRecordedAt: record.proof_recorded_at,
    settledAt: record.settled_at,
    expiresAt: record.expires_at,
    platformFeeAtomic: record.platform_fee_atomic,
    creatorPayoutAtomic: record.creator_payout_atomic,
    creatorPayoutStatus: record.creator_payout_status,
    evaluatorAttestationStatus: record.evaluator_attestation_status,
    chainProofReference: record.chain_proof_reference,
    escrowAdapter: record.escrow_adapter,
    escrowState: record.escrow_state,
    escrowReference: record.escrow_reference,
    publicMetadata: record.public_metadata_json,
    privateMetadata: record.private_metadata_json,
    providerMetadata: record.provider_metadata_json,
    stateEvents: record.state_events_json,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

function toSqlParams(record: Omit<PaymentAuthorizationRecord, 'id'> | PaymentAuthorizationRecord): unknown[] {
  return [
    record.authorizationId,
    record.runId,
    record.receiptId,
    record.buyerWallet,
    record.creatorWallet,
    record.agentId,
    record.agentName,
    record.amountAtomic,
    record.amountSol,
    record.maxAmountAtomic,
    record.currency,
    record.tokenMint,
    record.network,
    record.provider,
    record.providerPaymentReferenceId,
    record.nonce,
    record.idempotencyKey,
    record.status,
    record.signedAuthorizationPayloadHash,
    record.proofPayloadHash,
    record.proofReference,
    record.proofRecordedAt,
    record.settledAt,
    record.expiresAt,
    record.platformFeeAtomic,
    record.creatorPayoutAtomic,
    record.creatorPayoutStatus,
    record.evaluatorAttestationStatus,
    record.chainProofReference,
    record.escrowAdapter,
    record.escrowState,
    record.escrowReference,
    JSON.stringify(record.publicMetadata),
    JSON.stringify(record.privateMetadata),
    JSON.stringify(record.providerMetadata),
    JSON.stringify(record.stateEvents),
    record.createdAt,
    record.updatedAt,
  ]
}

function rowToPaymentRecord(row: Record<string, unknown>): PaymentAuthorizationRecord {
  return toPaymentRecord({
    id: String(row.id),
    authorization_id: String(row.authorization_id),
    run_id: String(row.run_id),
    receipt_id: (row.receipt_id as string | null) ?? null,
    buyer_wallet: String(row.buyer_wallet),
    creator_wallet: String(row.creator_wallet),
    agent_id: String(row.agent_id),
    agent_name: String(row.agent_name),
    amount_atomic: String(row.amount_atomic),
    amount_sol: String(row.amount_sol),
    max_amount_atomic: String(row.max_amount_atomic),
    currency: String(row.currency),
    token_mint: String(row.token_mint),
    network: row.network as DevnetPaymentAuthorization['network'],
    provider: row.provider as DevnetPaymentAuthorization['provider'],
    provider_payment_reference_id: (row.provider_payment_reference_id as string | null) ?? null,
    nonce: String(row.nonce),
    idempotency_key: String(row.idempotency_key),
    status: row.status as DevnetPaymentAuthorization['status'],
    signed_authorization_payload_hash: (row.signed_authorization_payload_hash as string | null) ?? null,
    proof_payload_hash: (row.proof_payload_hash as string | null) ?? null,
    proof_reference: (row.proof_reference as string | null) ?? null,
    proof_recorded_at: (row.proof_recorded_at as string | null) ?? null,
    settled_at: (row.settled_at as string | null) ?? null,
    expires_at: String(row.expires_at),
    platform_fee_atomic: String(row.platform_fee_atomic),
    creator_payout_atomic: String(row.creator_payout_atomic),
    creator_payout_status: row.creator_payout_status as DevnetPaymentAuthorization['creator_payout_status'],
    evaluator_attestation_status: row.evaluator_attestation_status as DevnetPaymentAuthorization['evaluator_attestation_status'],
    chain_proof_reference: (row.chain_proof_reference as string | null) ?? null,
    escrow_adapter: row.escrow_adapter as DevnetPaymentAuthorization['escrow_adapter'],
    escrow_state: row.escrow_state as DevnetPaymentAuthorization['escrow_state'],
    escrow_reference: (row.escrow_reference as string | null) ?? null,
    public_metadata_json: parseJsonRecord(row.public_metadata_json),
    private_metadata_json: parseJsonRecord(row.private_metadata_json),
    provider_metadata_json: parseJsonRecord(row.provider_metadata_json) as DevnetPaymentAuthorization['provider_metadata_json'],
    state_events_json: parseJsonArray(row.state_events_json) as DevnetPaymentAuthorization['state_events_json'],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  })
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

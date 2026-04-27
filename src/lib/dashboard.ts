/**
 * Role-gated dashboard data layer.
 *
 * Assembles buyer, creator, and operator dashboard payloads from persisted
 * devnet-store or Postgres records. No static scores, no fake metrics.
 *
 * Public-surface safety: provider adapter names, escrow adapter internals,
 * raw signed payloads, and private metadata are stripped before return.
 */
import { createPool } from '@/lib/db'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { deriveAgentReputation, ReputationSummary } from '@/lib/reputation'

// ─── Payment summary types (service field names stripped) ────────────────────

export interface DashboardPaymentSummary {
  authorizationId: string
  runId: string
  receiptId: string | null
  agentId: string
  agentName: string
  amountSol: string
  status: string
  proofReference: string | null
  proofRecordedAt: string | null
  settledAt: string | null
  expiresAt: string
  creatorPayoutStatus: string
  evaluatorAttestationStatus: string
  escrowState: string
  escrowReference: string | null
  stateEvents: Array<{ status: string; at: string; note: string }>
  createdAt: string
  updatedAt: string
}

// ─── Buyer Intelligence Desk ──────────────────────────────────────────────────

export interface BuyerRunSummary {
  runId: string
  agentId: string
  agentName: string
  amountSol: string
  status: string
  hasPrivateThread: boolean
  hasSealedOutput: boolean
  receiptId: string | null
  paymentStatus: string | null
  createdAt: string
  updatedAt: string
}

export interface BuyerThreadSummary {
  threadId: string
  agentId: string
  creatorWallet: string
  status: string
  hasSealedOutput: boolean
  runId: string | null
  createdAt: string
  updatedAt: string
}

export interface BuyerDashboard {
  role: 'buyer'
  walletAddress: string
  summary: {
    activeRuns: number
    privateThreads: number
    sealedOutputsAvailable: number
    openDisputes: number
  }
  runs: BuyerRunSummary[]
  privateThreads: BuyerThreadSummary[]
  recentPayments: DashboardPaymentSummary[]
  nextActions: string[]
}

// ─── Creator Signal Desk ──────────────────────────────────────────────────────

export interface CreatorAgentSummary {
  agentId: string
  name: string
  description: string
  active: boolean
  reputation: ReputationSummary
  createdAt: string
}

export interface CreatorRunSummary {
  runId: string
  agentId: string
  agentName: string
  amountSol: string
  status: string
  hasPrivateThread: boolean
  deliverableStatus: string | null
  paymentStatus: string | null
  creatorPayoutStatus: string | null
  createdAt: string
  updatedAt: string
}

export interface CreatorDashboard {
  role: 'creator'
  walletAddress: string
  summary: {
    ownedAgents: number
    inboundRuns: number
    pendingDeliverables: number
    eligiblePayouts: number
    activeDisputes: number
  }
  agents: CreatorAgentSummary[]
  recentRuns: CreatorRunSummary[]
  recentPayments: DashboardPaymentSummary[]
  nextActions: string[]
}

// ─── Operator Market Control ──────────────────────────────────────────────────

export interface OperatorAnomalyItem {
  type:
    | 'failed_payment'
    | 'expired_authorization'
    | 'disputed_run'
    | 'disputed_payment'
    | 'refund_recorded'
    | 'missing_receipt'
    | 'settlement_mismatch'
  runId: string
  agentId: string
  agentName: string
  status: string
  createdAt: string
  description: string
}

export interface OperatorDashboard {
  role: 'operator'
  walletAddress: string
  marketHealth: {
    totalRuns: number
    completedRuns: number
    disputedRuns: number
    activeAuthorizations: number
    failedOrExpiredAuthorizations: number
    disputedPayments: number
    refundedPayments: number
    settledPayments: number
    receiptsIssued: number
    runsWithoutReceipts: number
  }
  anomalies: OperatorAnomalyItem[]
  nextActions: string[]
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sanitizePayment(p: {
  authorization_id: string
  run_id: string
  receipt_id: string | null
  agent_id: string
  agent_name: string
  amount_sol: string
  status: string
  proof_reference: string | null
  proof_recorded_at: string | null
  settled_at: string | null
  expires_at: string
  creator_payout_status: string
  evaluator_attestation_status: string
  escrow_state: string
  escrow_reference: string | null
  state_events_json: Array<{ status: string; at: string; note: string }> | string
  created_at: string
  updated_at: string
}): DashboardPaymentSummary {
  let stateEvents: Array<{ status: string; at: string; note: string }> = []
  if (Array.isArray(p.state_events_json)) {
    stateEvents = p.state_events_json
  } else if (typeof p.state_events_json === 'string') {
    try {
      const parsed = JSON.parse(p.state_events_json) as unknown
      stateEvents = Array.isArray(parsed)
        ? (parsed as Array<{ status: string; at: string; note: string }>)
        : []
    } catch {
      stateEvents = []
    }
  }

  return {
    authorizationId: p.authorization_id,
    runId: p.run_id,
    receiptId: p.receipt_id,
    agentId: p.agent_id,
    agentName: p.agent_name,
    amountSol: p.amount_sol,
    status: p.status,
    proofReference: p.proof_reference,
    proofRecordedAt: p.proof_recorded_at,
    settledAt: p.settled_at,
    expiresAt: p.expires_at,
    creatorPayoutStatus: p.creator_payout_status,
    evaluatorAttestationStatus: p.evaluator_attestation_status,
    escrowState: p.escrow_state,
    escrowReference: p.escrow_reference,
    stateEvents,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }
}

function deriveBuyerNextActions(
  runs: BuyerRunSummary[],
  payments: DashboardPaymentSummary[]
): string[] {
  const actions: string[] = []

  if (runs.some(r => r.status === 'pending')) {
    actions.push('Authorize payment to start your run')
  }
  if (payments.some(p => p.status === 'authorization_requested')) {
    actions.push('Approve payment in your wallet')
  }
  if (payments.some(p => p.status === 'disputed')) {
    actions.push('Review open dispute with creator')
  }
  if (runs.some(r => r.hasSealedOutput)) {
    actions.push('Retrieve your sealed output')
  }
  if (payments.some(p => p.status === 'proof_pending')) {
    actions.push('Proof recording in progress — no action required')
  }

  return actions
}

function deriveCreatorNextActions(
  runs: CreatorRunSummary[],
  payments: DashboardPaymentSummary[]
): string[] {
  const actions: string[] = []

  if (runs.some(r => r.deliverableStatus === 'draft')) {
    actions.push('Submit your sealed deliverable')
  }
  if (runs.some(r => r.status === 'running')) {
    actions.push('Deliver output and close your active run')
  }
  if (payments.some(p => p.creatorPayoutStatus === 'eligible')) {
    actions.push('Payout eligible — settlement rail active')
  }
  if (payments.some(p => p.status === 'disputed')) {
    actions.push('Dispute requires your response')
  }

  return actions
}

function deriveOperatorNextActions(anomalies: OperatorAnomalyItem[]): string[] {
  const actions: string[] = []
  const types = new Set(anomalies.map(a => a.type))

  if (types.has('failed_payment') || types.has('expired_authorization')) {
    actions.push('Review failed or expired payment authorizations')
  }
  if (types.has('disputed_payment') || types.has('disputed_run')) {
    actions.push('Triage disputes in the queue')
  }
  if (types.has('missing_receipt')) {
    actions.push('Investigate completed runs missing receipts')
  }
  if (types.has('settlement_mismatch')) {
    actions.push('Review settlement anomalies')
  }
  if (anomalies.length === 0) {
    actions.push('Market is clear — no anomalies require review')
  }

  return actions
}

// ─── Buyer dashboard ──────────────────────────────────────────────────────────

export async function getBuyerDashboard(wallet: string): Promise<BuyerDashboard> {
  if (!shouldUsePostgres()) {
    return getBuyerDashboardDevnet(wallet)
  }
  return getBuyerDashboardPostgres(wallet)
}

function getBuyerDashboardDevnet(wallet: string): BuyerDashboard {
  const runs = devnetStore.listRuns({ buyerWallet: wallet })
  const receipts = devnetStore.listReceipts({ buyerWallet: wallet })
  const threads = devnetStore.listPrivateThreads({ wallet, role: 'buyer' })
  const payments = devnetStore.listPaymentAuthorizations({ buyerWallet: wallet })

  const receiptByRunId = new Map(receipts.map(r => [r.run_id, r]))
  const paymentByRunId = new Map(payments.map(p => [p.run_id, p]))
  const deliverableByRunId = new Map(
    runs
      .map(r => [r.run_id, devnetStore.getDeliverableByRunId(r.run_id)] as const)
      .filter(([, d]) => d !== undefined)
  )
  const threadByRunId = new Map(threads.map(t => [t.run_id ?? '', t]))

  const runSummaries: BuyerRunSummary[] = [...runs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 25)
    .map(r => ({
      runId: r.run_id,
      agentId: r.agent_id,
      agentName: r.agent_name,
      amountSol: r.amount_sol,
      status: r.status,
      hasPrivateThread: threadByRunId.has(r.run_id),
      hasSealedOutput: (() => {
        const d = deliverableByRunId.get(r.run_id)
        return d ? ['submitted', 'buyer_retrieved', 'evaluator_reviewed', 'sealed'].includes(d.status) : false
      })(),
      receiptId: receiptByRunId.get(r.run_id)?.receipt_id ?? null,
      paymentStatus: paymentByRunId.get(r.run_id)?.status ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))

  const threadSummaries: BuyerThreadSummary[] = [...threads]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map(t => {
      const deliverable = t.run_id ? devnetStore.getDeliverableByRunId(t.run_id) : undefined
      return {
        threadId: t.thread_id,
        agentId: t.agent_id,
        creatorWallet: t.creator_wallet,
        status: t.status,
        hasSealedOutput: deliverable
          ? ['submitted', 'buyer_retrieved', 'evaluator_reviewed', 'sealed'].includes(deliverable.status)
          : false,
        runId: t.run_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }
    })

  const recentPayments: DashboardPaymentSummary[] = [...payments]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map(p => sanitizePayment({
      authorization_id: p.authorization_id,
      run_id: p.run_id,
      receipt_id: p.receipt_id,
      agent_id: p.agent_id,
      agent_name: p.agent_name,
      amount_sol: p.amount_sol,
      status: p.status,
      proof_reference: p.proof_reference,
      proof_recorded_at: p.proof_recorded_at,
      settled_at: p.settled_at,
      expires_at: p.expires_at,
      creator_payout_status: p.creator_payout_status,
      evaluator_attestation_status: p.evaluator_attestation_status,
      escrow_state: p.escrow_state,
      escrow_reference: p.escrow_reference,
      state_events_json: p.state_events_json,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }))

  const sealedOutputsAvailable = runSummaries.filter(r => r.hasSealedOutput).length
  const openDisputes = payments.filter(p => p.status === 'disputed').length
    + runs.filter(r => r.status === 'disputed').length

  return {
    role: 'buyer',
    walletAddress: wallet,
    summary: {
      activeRuns: runs.filter(r => ['pending', 'authorized', 'running'].includes(r.status)).length,
      privateThreads: threads.length,
      sealedOutputsAvailable,
      openDisputes,
    },
    runs: runSummaries,
    privateThreads: threadSummaries,
    recentPayments,
    nextActions: deriveBuyerNextActions(runSummaries, recentPayments),
  }
}

async function getBuyerDashboardPostgres(wallet: string): Promise<BuyerDashboard> {
  const pool = createPool()
  let client
  try {
    client = await pool.connect()

    const [runsRes, receiptsRes, threadsRes, paymentsRes, deliverablesRes] = await Promise.all([
      client.query(
        `SELECT run_id, agent_id, agent_name, amount_sol, status, created_at, updated_at
         FROM runs WHERE buyer_wallet = $1 ORDER BY created_at DESC LIMIT 25`,
        [wallet]
      ),
      client.query(
        `SELECT receipt_id, run_id FROM receipts WHERE buyer_wallet = $1`,
        [wallet]
      ),
      client.query(
        `SELECT thread_id, agent_id, creator_wallet, status, run_id, created_at, updated_at
         FROM private_threads WHERE buyer_wallet = $1 ORDER BY created_at DESC LIMIT 20`,
        [wallet]
      ),
      client.query(
        `SELECT authorization_id, run_id, receipt_id, agent_id, agent_name, amount_sol,
                status, proof_reference, proof_recorded_at, settled_at, expires_at,
                creator_payout_status, evaluator_attestation_status, escrow_state,
                escrow_reference, state_events_json,
                created_at, updated_at
         FROM payment_authorizations WHERE buyer_wallet = $1
         ORDER BY created_at DESC LIMIT 10`,
        [wallet]
      ),
      client.query(
        `SELECT run_id, status
         FROM encrypted_deliverables
         WHERE buyer_wallet = $1`,
        [wallet]
      ),
    ])

    const receiptByRunId = new Map(
      (runsRes.rows as Array<{ run_id: string }>).map(r => r.run_id)
        .map(runId => {
          const receipt = receiptsRes.rows.find(
            (rc: Record<string, unknown>) => rc.run_id === runId
          ) as Record<string, unknown> | undefined
          return [runId, receipt]
        })
    )

    const paymentByRunId = new Map(
      (paymentsRes.rows as Array<Record<string, unknown>>).map(p => [
        String(p.run_id),
        p,
      ])
    )

    const sealedDeliverableRunIds = new Set(
      (deliverablesRes.rows as Array<Record<string, unknown>>)
        .filter(d => ['submitted', 'buyer_retrieved', 'evaluator_reviewed', 'sealed'].includes(String(d.status)))
        .map(d => String(d.run_id))
    )

    const runSummaries: BuyerRunSummary[] = (
      runsRes.rows as Array<Record<string, unknown>>
    ).map(r => ({
      runId: String(r.run_id),
      agentId: String(r.agent_id),
      agentName: String(r.agent_name),
      amountSol: String(r.amount_sol),
      status: String(r.status),
      hasPrivateThread: (threadsRes.rows as Array<Record<string, unknown>>).some(
        t => t.run_id === r.run_id
      ),
      hasSealedOutput: sealedDeliverableRunIds.has(String(r.run_id)),
      receiptId: (receiptByRunId.get(String(r.run_id)) as Record<string, unknown> | undefined)
        ?.receipt_id
        ? String(
            (receiptByRunId.get(String(r.run_id)) as Record<string, unknown>).receipt_id
          )
        : null,
      paymentStatus: (paymentByRunId.get(String(r.run_id)) as Record<string, unknown> | undefined)
        ?.status
        ? String((paymentByRunId.get(String(r.run_id)) as Record<string, unknown>).status)
        : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }))

    const threadSummaries: BuyerThreadSummary[] = (
      threadsRes.rows as Array<Record<string, unknown>>
    ).map(t => ({
      threadId: String(t.thread_id),
      agentId: String(t.agent_id),
      creatorWallet: String(t.creator_wallet),
      status: String(t.status),
      hasSealedOutput: t.run_id ? sealedDeliverableRunIds.has(String(t.run_id)) : false,
      runId: t.run_id ? String(t.run_id) : null,
      createdAt: String(t.created_at),
      updatedAt: String(t.updated_at),
    }))

    type RawPaymentRow = {
      authorization_id: string
      run_id: string
      receipt_id: string | null
      agent_id: string
      agent_name: string
      amount_sol: string
      status: string
      proof_reference: string | null
      proof_recorded_at: string | null
      settled_at: string | null
      expires_at: string
      creator_payout_status: string
      evaluator_attestation_status: string
      escrow_state: string
      escrow_reference: string | null
      state_events_json: Array<{ status: string; at: string; note: string }> | string
      created_at: string
      updated_at: string
    }

    const recentPayments = (paymentsRes.rows as RawPaymentRow[]).map(p => sanitizePayment(p))

    const openDisputes = (runsRes.rows as Array<{ status: string }>).filter(
      r => r.status === 'disputed'
    ).length + recentPayments.filter(p => p.status === 'disputed').length

    return {
      role: 'buyer',
      walletAddress: wallet,
      summary: {
        activeRuns: (runsRes.rows as Array<{ status: string }>).filter(r =>
          ['pending', 'authorized', 'running'].includes(r.status)
        ).length,
        privateThreads: threadsRes.rowCount ?? 0,
        sealedOutputsAvailable: runSummaries.filter(r => r.hasSealedOutput).length,
        openDisputes,
      },
      runs: runSummaries,
      privateThreads: threadSummaries,
      recentPayments,
      nextActions: deriveBuyerNextActions(runSummaries, recentPayments),
    }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

// ─── Creator dashboard ────────────────────────────────────────────────────────

export async function getCreatorDashboard(wallet: string): Promise<CreatorDashboard> {
  if (!shouldUsePostgres()) {
    return getCreatorDashboardDevnet(wallet)
  }
  return getCreatorDashboardPostgres(wallet)
}

async function getCreatorDashboardDevnet(wallet: string): Promise<CreatorDashboard> {
  const agents = devnetStore.listAgents({ creatorWallet: wallet })
  const runs = devnetStore.listRuns({ creatorWallet: wallet })
  const payments = devnetStore.listPaymentAuthorizations({ creatorWallet: wallet })

  const agentSummaries: CreatorAgentSummary[] = await Promise.all(
    agents.map(async a => ({
      agentId: a.agent_id,
      name: a.name,
      description: a.description,
      active: a.active,
      reputation: await deriveAgentReputation(a.agent_id),
      createdAt: a.created_at,
    }))
  )

  const paymentByRunId = new Map(payments.map(p => [p.run_id, p]))

  const recentRuns: CreatorRunSummary[] = [...runs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 25)
    .map(r => {
      const deliverable = devnetStore.getDeliverableByRunId(r.run_id)
      const payment = paymentByRunId.get(r.run_id)
      const hasThread = devnetStore.hasPrivateThreadForRun(r.run_id)
      return {
        runId: r.run_id,
        agentId: r.agent_id,
        agentName: r.agent_name,
        amountSol: r.amount_sol,
        status: r.status,
        hasPrivateThread: hasThread,
        deliverableStatus: deliverable?.status ?? null,
        paymentStatus: payment?.status ?? null,
        creatorPayoutStatus: payment?.creator_payout_status ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    })

  const recentPayments: DashboardPaymentSummary[] = [...payments]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map(p => sanitizePayment({
      authorization_id: p.authorization_id,
      run_id: p.run_id,
      receipt_id: p.receipt_id,
      agent_id: p.agent_id,
      agent_name: p.agent_name,
      amount_sol: p.amount_sol,
      status: p.status,
      proof_reference: p.proof_reference,
      proof_recorded_at: p.proof_recorded_at,
      settled_at: p.settled_at,
      expires_at: p.expires_at,
      creator_payout_status: p.creator_payout_status,
      evaluator_attestation_status: p.evaluator_attestation_status,
      escrow_state: p.escrow_state,
      escrow_reference: p.escrow_reference,
      state_events_json: p.state_events_json,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }))

  const pendingDeliverables = recentRuns.filter(
    r => r.deliverableStatus === 'draft' || (r.status === 'running' && !r.deliverableStatus)
  ).length
  const eligiblePayouts = payments.filter(p => p.creator_payout_status === 'eligible').length
  const activeDisputes = payments.filter(p => p.status === 'disputed').length
    + runs.filter(r => r.status === 'disputed').length

  return {
    role: 'creator',
    walletAddress: wallet,
    summary: {
      ownedAgents: agents.length,
      inboundRuns: runs.length,
      pendingDeliverables,
      eligiblePayouts,
      activeDisputes,
    },
    agents: agentSummaries,
    recentRuns,
    recentPayments,
    nextActions: deriveCreatorNextActions(recentRuns, recentPayments),
  }
}

async function getCreatorDashboardPostgres(wallet: string): Promise<CreatorDashboard> {
  const pool = createPool()
  let client
  try {
    client = await pool.connect()

    const [agentsRes, runsRes, paymentsRes] = await Promise.all([
      client.query(
        `SELECT agent_id, name, description, active, created_at
         FROM agents WHERE creator_wallet = $1 AND active = true ORDER BY created_at DESC`,
        [wallet]
      ),
      client.query(
        `SELECT r.run_id, r.agent_id, r.agent_name, r.amount_sol, r.status, r.created_at, r.updated_at,
                ed.status AS deliverable_status
         FROM runs r
         LEFT JOIN encrypted_deliverables ed ON ed.run_id = r.run_id
         WHERE r.creator_wallet = $1
         ORDER BY r.created_at DESC LIMIT 25`,
        [wallet]
      ),
      client.query(
        `SELECT authorization_id, run_id, receipt_id, agent_id, agent_name, amount_sol,
                status, proof_reference, proof_recorded_at, settled_at, expires_at,
                creator_payout_status, evaluator_attestation_status, escrow_state,
                escrow_reference, state_events_json,
                created_at, updated_at
         FROM payment_authorizations WHERE creator_wallet = $1
         ORDER BY created_at DESC LIMIT 10`,
        [wallet]
      ),
    ])

    const agentSummaries: CreatorAgentSummary[] = await Promise.all(
      (agentsRes.rows as Array<Record<string, unknown>>).map(async a => ({
        agentId: String(a.agent_id),
        name: String(a.name),
        description: String(a.description),
        active: Boolean(a.active),
        reputation: await deriveAgentReputation(String(a.agent_id)),
        createdAt: String(a.created_at),
      }))
    )

    type RawPaymentRow = {
      authorization_id: string
      run_id: string
      receipt_id: string | null
      agent_id: string
      agent_name: string
      amount_sol: string
      status: string
      proof_reference: string | null
      proof_recorded_at: string | null
      settled_at: string | null
      expires_at: string
      creator_payout_status: string
      evaluator_attestation_status: string
      escrow_state: string
      escrow_reference: string | null
      state_events_json: Array<{ status: string; at: string; note: string }> | string
      created_at: string
      updated_at: string
    }

    const paymentByRunId = new Map(
      (paymentsRes.rows as RawPaymentRow[]).map(p => [p.run_id, p])
    )

    const recentRuns: CreatorRunSummary[] = (
      runsRes.rows as Array<Record<string, unknown>>
    ).map(r => {
      const payment = paymentByRunId.get(String(r.run_id))
      return {
        runId: String(r.run_id),
        agentId: String(r.agent_id),
        agentName: String(r.agent_name),
        amountSol: String(r.amount_sol),
        status: String(r.status),
        hasPrivateThread: false,
        deliverableStatus: r.deliverable_status ? String(r.deliverable_status) : null,
        paymentStatus: payment?.status ?? null,
        creatorPayoutStatus: payment?.creator_payout_status ?? null,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }
    })

    const recentPayments = (paymentsRes.rows as RawPaymentRow[]).map(p => sanitizePayment(p))

    const eligiblePayouts = (paymentsRes.rows as Array<{ creator_payout_status: string }>).filter(
      p => p.creator_payout_status === 'eligible'
    ).length

    const activeDisputes = recentPayments.filter(p => p.status === 'disputed').length
      + recentRuns.filter(r => r.status === 'disputed').length

    return {
      role: 'creator',
      walletAddress: wallet,
      summary: {
        ownedAgents: agentsRes.rowCount ?? 0,
        inboundRuns: runsRes.rowCount ?? 0,
        pendingDeliverables: recentRuns.filter(r => r.deliverableStatus === 'draft').length,
        eligiblePayouts,
        activeDisputes,
      },
      agents: agentSummaries,
      recentRuns,
      recentPayments,
      nextActions: deriveCreatorNextActions(recentRuns, recentPayments),
    }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

// ─── Operator dashboard ───────────────────────────────────────────────────────

export async function getOperatorDashboard(wallet: string): Promise<OperatorDashboard> {
  if (!shouldUsePostgres()) {
    return getOperatorDashboardDevnet(wallet)
  }
  return getOperatorDashboardPostgres(wallet)
}

function getOperatorDashboardDevnet(wallet: string): OperatorDashboard {
  const allRuns = devnetStore.listRuns({})
  const allReceipts = devnetStore.listReceipts({})
  const allPayments = devnetStore.listPaymentAuthorizations({})

  const receiptRunIds = new Set(allReceipts.map(r => r.run_id))

  const completedRuns = allRuns.filter(r => r.status === 'completed')
  const disputedRuns = allRuns.filter(r => r.status === 'disputed')

  const failedPayments = allPayments.filter(p => p.status === 'failed')
  const expiredPayments = allPayments.filter(p => p.status === 'expired')
  const disputedPayments = allPayments.filter(p => p.status === 'disputed')
  const refundedPayments = allPayments.filter(p => p.status === 'refunded')
  const settledPayments = allPayments.filter(p => p.status === 'settled')

  const activePayments = allPayments.filter(p =>
    ['quoted', 'authorization_requested', 'wallet_approved', 'proof_pending', 'proof_recorded'].includes(
      p.status
    )
  )

  const runsWithoutReceipts = completedRuns.filter(r => !receiptRunIds.has(r.run_id))

  const anomalies: OperatorAnomalyItem[] = []

  for (const p of failedPayments) {
    anomalies.push({
      type: 'failed_payment',
      runId: p.run_id,
      agentId: p.agent_id,
      agentName: p.agent_name,
      status: p.status,
      createdAt: p.updated_at,
      description: 'Payment authorization failed — run may be blocked.',
    })
  }

  for (const p of expiredPayments) {
    anomalies.push({
      type: 'expired_authorization',
      runId: p.run_id,
      agentId: p.agent_id,
      agentName: p.agent_name,
      status: p.status,
      createdAt: p.updated_at,
      description: 'Authorization expired before proof was recorded.',
    })
  }

  for (const p of disputedPayments) {
    anomalies.push({
      type: 'disputed_payment',
      runId: p.run_id,
      agentId: p.agent_id,
      agentName: p.agent_name,
      status: p.status,
      createdAt: p.updated_at,
      description: 'Payment authorization is disputed — receipt may be affected.',
    })
  }

  for (const r of disputedRuns) {
    anomalies.push({
      type: 'disputed_run',
      runId: r.run_id,
      agentId: r.agent_id,
      agentName: r.agent_name,
      status: r.status,
      createdAt: r.disputed_at ?? r.updated_at,
      description: 'Run entered disputed state.',
    })
  }

  for (const r of runsWithoutReceipts) {
    anomalies.push({
      type: 'missing_receipt',
      runId: r.run_id,
      agentId: r.agent_id,
      agentName: r.agent_name,
      status: r.status,
      createdAt: r.completed_at ?? r.updated_at,
      description: 'Completed run has no receipt on file.',
    })
  }

  // Settlement mismatch: settled payment but no receipt
  for (const p of settledPayments) {
    if (!receiptRunIds.has(p.run_id)) {
      anomalies.push({
        type: 'settlement_mismatch',
        runId: p.run_id,
        agentId: p.agent_id,
        agentName: p.agent_name,
        status: p.status,
        createdAt: p.settled_at ?? p.updated_at,
        description: 'Payment settled but no receipt recorded — settlement mismatch.',
      })
    }
  }

  anomalies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    role: 'operator',
    walletAddress: wallet,
    marketHealth: {
      totalRuns: allRuns.length,
      completedRuns: completedRuns.length,
      disputedRuns: disputedRuns.length,
      activeAuthorizations: activePayments.length,
      failedOrExpiredAuthorizations: failedPayments.length + expiredPayments.length,
      disputedPayments: disputedPayments.length,
      refundedPayments: refundedPayments.length,
      settledPayments: settledPayments.length,
      receiptsIssued: allReceipts.length,
      runsWithoutReceipts: runsWithoutReceipts.length,
    },
    anomalies,
    nextActions: deriveOperatorNextActions(anomalies),
  }
}

async function getOperatorDashboardPostgres(wallet: string): Promise<OperatorDashboard> {
  const pool = createPool()
  let client
  try {
    client = await pool.connect()

    const [runsRes, receiptsRes, paymentsRes] = await Promise.all([
      client.query(
        `SELECT run_id, agent_id, agent_name, status, completed_at, disputed_at, updated_at
         FROM runs ORDER BY created_at DESC`
      ),
      client.query(`SELECT run_id FROM receipts`),
      client.query(
        `SELECT authorization_id, run_id, agent_id, agent_name, status, settled_at,
                proof_recorded_at, updated_at, receipt_id, creator_payout_status
         FROM payment_authorizations ORDER BY created_at DESC`
      ),
    ])

    type RunRow = {
      run_id: string; agent_id: string; agent_name: string;
      status: string; completed_at: string | null; disputed_at: string | null; updated_at: string
    }
    type PaymentRow = {
      authorization_id: string; run_id: string; agent_id: string; agent_name: string;
      status: string; settled_at: string | null; proof_recorded_at: string | null;
      updated_at: string; receipt_id: string | null; creator_payout_status: string
    }

    const runs = runsRes.rows as RunRow[]
    const payments = paymentsRes.rows as PaymentRow[]
    const receiptRunIds = new Set((receiptsRes.rows as Array<{ run_id: string }>).map(r => r.run_id))

    const completedRuns = runs.filter(r => r.status === 'completed')
    const disputedRuns = runs.filter(r => r.status === 'disputed')
    const failedPayments = payments.filter(p => p.status === 'failed')
    const expiredPayments = payments.filter(p => p.status === 'expired')
    const disputedPayments = payments.filter(p => p.status === 'disputed')
    const refundedPayments = payments.filter(p => p.status === 'refunded')
    const settledPayments = payments.filter(p => p.status === 'settled')
    const activePayments = payments.filter(p =>
      ['quoted', 'authorization_requested', 'wallet_approved', 'proof_pending', 'proof_recorded'].includes(p.status)
    )
    const runsWithoutReceipts = completedRuns.filter(r => !receiptRunIds.has(r.run_id))

    const anomalies: OperatorAnomalyItem[] = []

    for (const p of failedPayments) {
      anomalies.push({ type: 'failed_payment', runId: p.run_id, agentId: p.agent_id, agentName: p.agent_name, status: p.status, createdAt: p.updated_at, description: 'Payment authorization failed — run may be blocked.' })
    }
    for (const p of expiredPayments) {
      anomalies.push({ type: 'expired_authorization', runId: p.run_id, agentId: p.agent_id, agentName: p.agent_name, status: p.status, createdAt: p.updated_at, description: 'Authorization expired before proof was recorded.' })
    }
    for (const p of disputedPayments) {
      anomalies.push({ type: 'disputed_payment', runId: p.run_id, agentId: p.agent_id, agentName: p.agent_name, status: p.status, createdAt: p.updated_at, description: 'Payment authorization is disputed — receipt may be affected.' })
    }
    for (const r of disputedRuns) {
      anomalies.push({ type: 'disputed_run', runId: r.run_id, agentId: r.agent_id, agentName: r.agent_name, status: r.status, createdAt: r.disputed_at ?? r.updated_at, description: 'Run entered disputed state.' })
    }
    for (const r of runsWithoutReceipts) {
      anomalies.push({ type: 'missing_receipt', runId: r.run_id, agentId: r.agent_id, agentName: r.agent_name, status: r.status, createdAt: r.completed_at ?? r.updated_at, description: 'Completed run has no receipt on file.' })
    }
    for (const p of settledPayments) {
      if (!receiptRunIds.has(p.run_id)) {
        anomalies.push({ type: 'settlement_mismatch', runId: p.run_id, agentId: p.agent_id, agentName: p.agent_name, status: p.status, createdAt: p.settled_at ?? p.updated_at, description: 'Payment settled but no receipt recorded.' })
      }
    }

    anomalies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return {
      role: 'operator',
      walletAddress: wallet,
      marketHealth: {
        totalRuns: runs.length,
        completedRuns: completedRuns.length,
        disputedRuns: disputedRuns.length,
        activeAuthorizations: activePayments.length,
        failedOrExpiredAuthorizations: failedPayments.length + expiredPayments.length,
        disputedPayments: disputedPayments.length,
        refundedPayments: refundedPayments.length,
        settledPayments: settledPayments.length,
        receiptsIssued: receiptsRes.rowCount ?? 0,
        runsWithoutReceipts: runsWithoutReceipts.length,
      },
      anomalies,
      nextActions: deriveOperatorNextActions(anomalies),
    }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

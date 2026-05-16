import { randomBytes } from 'crypto'
import { createPool } from '@/lib/db'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'

// ─── Types ────────────────────────────────────────────────────────────────────

export const REPUTATION_EVENT_TYPES = [
  'run_completed',
  'receipt_created',
  'sealed_output_delivered',
  'settlement_completed',
  'dispute_opened',
  'dispute_resolved',
  'refund_recorded',
  'authorization_failed_or_expired',
] as const

export type ReputationEventType = (typeof REPUTATION_EVENT_TYPES)[number]

export const REPUTATION_IMPACTS = ['positive', 'neutral', 'watch', 'negative'] as const
export type ReputationImpact = (typeof REPUTATION_IMPACTS)[number]

export const REPUTATION_VISIBILITIES = ['public', 'buyer_creator', 'operator'] as const
export type ReputationVisibility = (typeof REPUTATION_VISIBILITIES)[number]

export const REPUTATION_LABELS = [
  'Receipt-backed',
  'Reliability Building',
  'Verified Delivery',
  'Settlement Clean',
  'Dispute Watch',
  'Proof Pending',
] as const
export type ReputationLabel = (typeof REPUTATION_LABELS)[number]

export const VERIFICATION_STATES = ['receipt_backed', 'building', 'watch', 'unverified'] as const
export type VerificationState = (typeof VERIFICATION_STATES)[number]

export interface ReputationEvent {
  id: string
  agentId: string
  creatorWallet: string
  runId: string
  receiptId: string | null
  paymentAuthorizationId: string | null
  eventType: ReputationEventType
  impact: ReputationImpact
  visibility: ReputationVisibility
  reason: string
  createdAt: string
}

export interface ReputationSummary {
  agentId: string
  creatorWallet: string
  completedReceiptCount: number
  settlementHealthLabel: string
  disputeCount: number
  refundCount: number
  recentEvents: ReputationEvent[]
  reliabilityLabel: ReputationLabel
  verificationState: VerificationState
}

// Minimal row shapes used by both devnet store and Postgres result rows
interface RunSource {
  run_id: string
  agent_id: string
  creator_wallet: string
  status: string
  completed_at: string | null
  disputed_at: string | null
  updated_at: string
}

interface ReceiptSource {
  receipt_id: string
  run_id: string
  created_at: string
}

interface PaymentSource {
  authorization_id: string
  run_id: string
  status: string
  settled_at: string | null
  updated_at: string
  state_events_json: Array<{ status: string; at: string; note: string }> | string
}

interface DeliverableSource {
  run_id: string
  status: string
  updated_at: string
}

// ─── Event Derivation ─────────────────────────────────────────────────────────

function makeEventId(): string {
  return `rep-${Date.now()}-${randomBytes(4).toString('hex')}`
}

function parseStateEvents(
  raw: Array<{ status: string; at: string; note: string }> | string
): Array<{ status: string; at: string; note: string }> {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as Array<{ status: string; at: string; note: string }>) : []
    } catch {
      return []
    }
  }
  return []
}

function deriveEventsFromRun(
  run: RunSource,
  receipt: ReceiptSource | undefined,
  payment: PaymentSource | undefined,
  deliverable: DeliverableSource | undefined
): ReputationEvent[] {
  const events: ReputationEvent[] = []

  if (run.status === 'completed') {
    events.push({
      id: makeEventId(),
      agentId: run.agent_id,
      creatorWallet: run.creator_wallet,
      runId: run.run_id,
      receiptId: receipt?.receipt_id ?? null,
      paymentAuthorizationId: payment?.authorization_id ?? null,
      eventType: 'run_completed',
      impact: 'positive',
      visibility: 'public',
      reason: 'Run completed and result recorded.',
      createdAt: run.completed_at ?? run.updated_at,
    })
  }

  if (run.status === 'disputed' || run.disputed_at) {
    events.push({
      id: makeEventId(),
      agentId: run.agent_id,
      creatorWallet: run.creator_wallet,
      runId: run.run_id,
      receiptId: receipt?.receipt_id ?? null,
      paymentAuthorizationId: payment?.authorization_id ?? null,
      eventType: 'dispute_opened',
      impact: 'watch',
      visibility: 'operator',
      reason: 'Run entered disputed state.',
      createdAt: run.disputed_at ?? run.updated_at,
    })
  }

  if (receipt) {
    events.push({
      id: makeEventId(),
      agentId: run.agent_id,
      creatorWallet: run.creator_wallet,
      runId: run.run_id,
      receiptId: receipt.receipt_id,
      paymentAuthorizationId: payment?.authorization_id ?? null,
      eventType: 'receipt_created',
      impact: 'positive',
      visibility: 'public',
      reason: 'ProofSplit Receipt created and anchored to run.',
      createdAt: receipt.created_at,
    })
  }

  if (deliverable && (deliverable.status === 'submitted' || deliverable.status === 'buyer_retrieved')) {
    events.push({
      id: makeEventId(),
      agentId: run.agent_id,
      creatorWallet: run.creator_wallet,
      runId: run.run_id,
      receiptId: receipt?.receipt_id ?? null,
      paymentAuthorizationId: payment?.authorization_id ?? null,
      eventType: 'sealed_output_delivered',
      impact: 'positive',
      visibility: 'buyer_creator',
      reason: 'Sealed output delivered to buyer.',
      createdAt: deliverable.updated_at,
    })
  }

  if (payment) {
    const stateEvents = parseStateEvents(payment.state_events_json)
    const hadDispute = stateEvents.some(e => e.status === 'disputed')

    if (payment.status === 'settled') {
      events.push({
        id: makeEventId(),
        agentId: run.agent_id,
        creatorWallet: run.creator_wallet,
        runId: run.run_id,
        receiptId: receipt?.receipt_id ?? null,
        paymentAuthorizationId: payment.authorization_id,
        eventType: 'settlement_completed',
        impact: 'positive',
        visibility: 'buyer_creator',
        reason: 'Settlement recorded on the payment rail.',
        createdAt: payment.settled_at ?? payment.updated_at,
      })

      if (hadDispute) {
        events.push({
          id: makeEventId(),
          agentId: run.agent_id,
          creatorWallet: run.creator_wallet,
          runId: run.run_id,
          receiptId: receipt?.receipt_id ?? null,
          paymentAuthorizationId: payment.authorization_id,
          eventType: 'dispute_resolved',
          impact: 'positive',
          visibility: 'buyer_creator',
          reason: 'Dispute resolved — settlement completed.',
          createdAt: payment.updated_at,
        })
      }
    } else if (payment.status === 'refunded') {
      events.push({
        id: makeEventId(),
        agentId: run.agent_id,
        creatorWallet: run.creator_wallet,
        runId: run.run_id,
        receiptId: receipt?.receipt_id ?? null,
        paymentAuthorizationId: payment.authorization_id,
        eventType: 'refund_recorded',
        impact: 'neutral',
        visibility: 'operator',
        reason: 'Refund recorded on the settlement rail.',
        createdAt: payment.updated_at,
      })

      if (hadDispute) {
        events.push({
          id: makeEventId(),
          agentId: run.agent_id,
          creatorWallet: run.creator_wallet,
          runId: run.run_id,
          receiptId: receipt?.receipt_id ?? null,
          paymentAuthorizationId: payment.authorization_id,
          eventType: 'dispute_resolved',
          impact: 'neutral',
          visibility: 'buyer_creator',
          reason: 'Dispute resolved — refund recorded.',
          createdAt: payment.updated_at,
        })
      }
    } else if (payment.status === 'disputed') {
      events.push({
        id: makeEventId(),
        agentId: run.agent_id,
        creatorWallet: run.creator_wallet,
        runId: run.run_id,
        receiptId: receipt?.receipt_id ?? null,
        paymentAuthorizationId: payment.authorization_id,
        eventType: 'dispute_opened',
        impact: 'watch',
        visibility: 'operator',
        reason: 'Payment authorization entered dispute.',
        createdAt: payment.updated_at,
      })
    } else if (payment.status === 'failed' || payment.status === 'expired') {
      events.push({
        id: makeEventId(),
        agentId: run.agent_id,
        creatorWallet: run.creator_wallet,
        runId: run.run_id,
        receiptId: receipt?.receipt_id ?? null,
        paymentAuthorizationId: payment.authorization_id,
        eventType: 'authorization_failed_or_expired',
        impact: 'negative',
        visibility: 'operator',
        reason: `Payment authorization ${payment.status}.`,
        createdAt: payment.updated_at,
      })
    }
  }

  return events
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeReliabilityLabel(
  events: ReputationEvent[],
  receiptCount: number
): ReputationLabel {
  const disputeOpenCount = events.filter(e => e.eventType === 'dispute_opened').length
  const disputeResolvedCount = events.filter(e => e.eventType === 'dispute_resolved').length
  const authFailedCount = events.filter(e => e.eventType === 'authorization_failed_or_expired').length
  const settlementCount = events.filter(e => e.eventType === 'settlement_completed').length
  const runCount = events.filter(e => e.eventType === 'run_completed').length

  // Active unresolved disputes take precedence
  const activeDisputes = disputeOpenCount - disputeResolvedCount
  if (activeDisputes > 0) return 'Dispute Watch'

  if (receiptCount === 0 && runCount === 0) return 'Reliability Building'
  if (authFailedCount > 0 && settlementCount === 0) return 'Proof Pending'
  if (settlementCount > 0 && activeDisputes === 0) return 'Settlement Clean'
  if (receiptCount > 0 && runCount > 0) return 'Receipt-backed'
  return 'Reliability Building'
}

function computeVerificationState(
  events: ReputationEvent[],
  receiptCount: number
): VerificationState {
  const disputeOpenCount = events.filter(e => e.eventType === 'dispute_opened').length
  const disputeResolvedCount = events.filter(e => e.eventType === 'dispute_resolved').length
  const runCount = events.filter(e => e.eventType === 'run_completed').length
  const activeDisputes = disputeOpenCount - disputeResolvedCount

  if (activeDisputes > 0) return 'watch'
  if (receiptCount > 0) return 'receipt_backed'
  if (runCount > 0) return 'building'
  return 'unverified'
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function deriveAgentReputation(agentId: string): Promise<ReputationSummary> {
  if (!shouldUsePostgres()) {
    return deriveAgentReputationDevnet(agentId)
  }
  return deriveAgentReputationPostgres(agentId)
}

function deriveAgentReputationDevnet(agentId: string): ReputationSummary {
  const runs = devnetStore.listRuns({ agentId })
  const receipts = devnetStore.listReceipts({ agentId })
  const receiptByRunId = new Map(receipts.map(r => [r.run_id, r]))

  const allEvents: ReputationEvent[] = []

  for (const run of runs) {
    const receipt = receiptByRunId.get(run.run_id)
    const payment = devnetStore.getPaymentAuthorizationByRunId(run.run_id)
    const deliverable = devnetStore.getDeliverableByRunId(run.run_id)
    const events = deriveEventsFromRun(run, receipt, payment, deliverable)
    allEvents.push(...events)
  }

  allEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const creatorWallet = runs[0]?.creator_wallet ?? ''
  const receiptCount = receipts.length
  const disputeCount = allEvents.filter(e => e.eventType === 'dispute_opened').length
  const refundCount = allEvents.filter(e => e.eventType === 'refund_recorded').length
  const reliabilityLabel = computeReliabilityLabel(allEvents, receiptCount)
  const verificationState = computeVerificationState(allEvents, receiptCount)

  return {
    agentId,
    creatorWallet,
    completedReceiptCount: receiptCount,
    settlementHealthLabel: reliabilityLabel,
    disputeCount,
    refundCount,
    recentEvents: allEvents.slice(0, 20),
    reliabilityLabel,
    verificationState,
  }
}

async function deriveAgentReputationPostgres(agentId: string): Promise<ReputationSummary> {
  const pool = createPool()
  let client
  try {
    client = await pool.connect()

    const [runsRes, receiptsRes, paymentsRes, deliverablesRes] = await Promise.all([
      client.query<RunSource>(
        `SELECT run_id, agent_id, creator_wallet, status, completed_at, disputed_at, updated_at
         FROM runs WHERE agent_id = $1 ORDER BY created_at DESC`,
        [agentId]
      ),
      client.query<ReceiptSource>(
        `SELECT receipt_id, run_id, created_at FROM receipts WHERE agent_id = $1`,
        [agentId]
      ),
      client.query<PaymentSource>(
        `SELECT authorization_id, run_id, status, settled_at, updated_at, state_events_json
         FROM payment_authorizations WHERE agent_id = $1`,
        [agentId]
      ),
      client.query<DeliverableSource>(
        `SELECT ed.run_id, ed.status, ed.updated_at
         FROM encrypted_deliverables ed
         INNER JOIN runs r ON r.run_id = ed.run_id
         WHERE r.agent_id = $1`,
        [agentId]
      ),
    ])

    const receiptByRunId = new Map(runsRes.rows.length > 0
      ? receiptsRes.rows.map(r => [r.run_id, r])
      : [])
    const paymentByRunId = new Map(paymentsRes.rows.map(p => [p.run_id, p]))
    const deliverableByRunId = new Map(deliverablesRes.rows.map(d => [d.run_id, d]))

    const allEvents: ReputationEvent[] = []
    for (const run of runsRes.rows) {
      const events = deriveEventsFromRun(
        run,
        receiptByRunId.get(run.run_id),
        paymentByRunId.get(run.run_id),
        deliverableByRunId.get(run.run_id)
      )
      allEvents.push(...events)
    }

    allEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const creatorWallet = runsRes.rows[0]?.creator_wallet ?? ''
    const receiptCount = receiptsRes.rows.length
    const disputeCount = allEvents.filter(e => e.eventType === 'dispute_opened').length
    const refundCount = allEvents.filter(e => e.eventType === 'refund_recorded').length
    const reliabilityLabel = computeReliabilityLabel(allEvents, receiptCount)
    const verificationState = computeVerificationState(allEvents, receiptCount)

    return {
      agentId,
      creatorWallet,
      completedReceiptCount: receiptCount,
      settlementHealthLabel: reliabilityLabel,
      disputeCount,
      refundCount,
      recentEvents: allEvents.slice(0, 20),
      reliabilityLabel,
      verificationState,
    }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

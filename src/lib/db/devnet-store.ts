/**
 * Local file-based persistence store.
 *
 * Used when DATABASE_URL is not set. Persists all state to
 * .devnet-data/store.json at the project root so data survives
 * dev server restarts. Module-level cache avoids redundant disk reads
 * within a single process lifetime.
 *
 * This store is for local non-production environment only.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const DATA_DIR = process.env.VERCEL
  ? join(tmpdir(), 'kairo-devnet-data')
  : join(process.cwd(), '.devnet-data')
const STORE_FILE = join(DATA_DIR, 'store.json')

export interface DevnetNonce {
  id: string
  wallet_address: string
  nonce: string
  message: string
  used: boolean
  expires_at: string // ISO date string
  created_at: string
}

export interface DevnetProfile {
  id: string
  wallet_address: string
  username: string | null
  bio: string | null
  avatar_url: string | null
  roles: string[]
  created_at: string
  updated_at: string
}

export interface DevnetRun {
  id: string
  run_id: string
  agent_id: string
  agent_name: string
  buyer_wallet: string
  creator_wallet: string
  amount_sol: string
  status: string // pending | authorized | running | completed | disputed | cancelled
  input_hash: string | null
  result_hash: string | null
  summary: string | null
  payload: Record<string, unknown>
  result: Record<string, unknown>
  authorized_at: string | null
  started_at: string | null
  completed_at: string | null
  disputed_at: string | null
  created_at: string
  updated_at: string
}

export interface DevnetReceipt {
  id: string
  receipt_id: string
  run_id: string
  agent_id: string
  agent_name: string
  buyer_wallet: string
  creator_wallet: string
  amount_sol: string
  status: string
  result_hash: string
  summary: string | null
  receipt_hash: string
  public_proof_envelope_json: Record<string, unknown> | null
  private_thread_id: string | null
  encrypted_deliverable_id: string | null
  encrypted_deliverable_hash: string | null
  message_count: number
  private_content_redacted: boolean
  evaluator_attestation_status: string | null
  created_at: string
}

export interface DevnetPrivateThread {
  id: string
  thread_id: string
  agent_id: string
  run_id: string | null
  buyer_wallet: string
  creator_wallet: string
  evaluator_wallet: string | null
  status: string
  public_subject_hash: string
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface DevnetPrivateMessage {
  id: string
  message_id: string
  thread_id: string
  sender_wallet: string
  recipient_wallet: string
  message_type: string
  envelope_version: string
  ciphertext: string
  ciphertext_hash: string
  plaintext_hash: string
  nonce: string
  reply_to_message_id: string | null
  encryption_scheme: string
  created_at: string
}

export interface DevnetDeliverable {
  id: string
  deliverable_id: string
  run_id: string
  thread_id: string
  receipt_id: string
  creator_wallet: string
  buyer_wallet: string
  evaluator_wallet: string | null
  storage_kind: string
  ciphertext: string
  ciphertext_hash: string
  plaintext_hash: string
  nonce: string
  encryption_scheme: string
  access_policy_json: Record<string, unknown>
  status: string
  created_at: string
  updated_at: string
}

export interface DevnetDeliverableRetrievalEvent {
  id: string
  event_id: string
  deliverable_id: string
  run_id: string
  actor_wallet: string
  actor_role: string
  event_type: string
  created_at: string
}

export interface DevnetAgent {
  id: string
  agent_id: string
  name: string
  category?: string
  description: string
  capabilities: string[]
  pricing: Record<string, unknown>
  endpoint: string
  creator_wallet: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface DevnetPaymentAuthorization {
  id: string
  authorization_id: string
  run_id: string
  receipt_id: string | null
  buyer_wallet: string
  creator_wallet: string
  agent_id: string
  agent_name: string
  amount_atomic: string
  amount_sol: string
  max_amount_atomic: string
  currency: string
  token_mint: string
  network: 'solana-Solana mainnet' | 'solana-devnet'
  provider: 'payai'
  provider_payment_reference_id: string | null
  nonce: string
  idempotency_key: string
  status:
    | 'quoted'
    | 'authorization_requested'
    | 'wallet_approved'
    | 'proof_pending'
    | 'proof_recorded'
    | 'settled'
    | 'failed'
    | 'refunded'
    | 'disputed'
    | 'expired'
  signed_authorization_payload_hash: string | null
  proof_payload_hash: string | null
  proof_reference: string | null
  proof_recorded_at: string | null
  settled_at: string | null
  expires_at: string
  platform_fee_atomic: string
  creator_payout_atomic: string
  creator_payout_status: 'pending' | 'eligible' | 'paid' | 'blocked'
  evaluator_attestation_status: 'not_required' | 'pending' | 'approved' | 'rejected'
  chain_proof_reference: string | null
  escrow_adapter: 'payai_manual_devnet' | 'solana_escrow'
  escrow_state: 'none' | 'held' | 'released' | 'refunded' | 'disputed'
  escrow_reference: string | null
  public_metadata_json: Record<string, unknown>
  private_metadata_json: Record<string, unknown>
  provider_metadata_json: {
    mode: 'manual_sol_proof'
    providerReferenceId: string | null
    paymentRequirement: Record<string, unknown>
    sanitized: Record<string, unknown>
  }
  state_events_json: Array<{
    status: DevnetPaymentAuthorization['status']
    at: string
    note: string
  }>
  created_at: string
  updated_at: string
}

export interface DevnetWebhookDelivery {
  id: string
  delivery_id: string
  event_id: string
  event_type: string
  target_url: string
  status: 'pending' | 'delivered' | 'failed'
  response_status: number | null
  retry_count: number
  last_error: string | null
  created_at: string
  updated_at: string
}

interface StoreData {
  auth_nonces: DevnetNonce[]
  profiles: DevnetProfile[]
  agents: DevnetAgent[]
  runs: DevnetRun[]
  receipts: DevnetReceipt[]
  private_threads: DevnetPrivateThread[]
  private_messages: DevnetPrivateMessage[]
  encrypted_deliverables: DevnetDeliverable[]
  deliverable_retrieval_events: DevnetDeliverableRetrievalEvent[]
  payment_authorizations: DevnetPaymentAuthorization[]
  webhook_deliveries: DevnetWebhookDelivery[]
  _seq: number
}

function emptyStore(): StoreData {
  return {
    auth_nonces: [],
    profiles: [],
    agents: [],
    runs: [],
    receipts: [],
    private_threads: [],
    private_messages: [],
    encrypted_deliverables: [],
    deliverable_retrieval_events: [],
    payment_authorizations: [],
    webhook_deliveries: [],
    _seq: 1,
  }
}

function normalizeStore(s: Partial<StoreData>): StoreData {
  return {
    auth_nonces: s.auth_nonces ?? [],
    profiles: s.profiles ?? [],
    agents: s.agents ?? [],
    runs: s.runs ?? [],
    receipts: s.receipts ?? [],
    private_threads: s.private_threads ?? [],
    private_messages: s.private_messages ?? [],
    encrypted_deliverables: s.encrypted_deliverables ?? [],
    deliverable_retrieval_events: s.deliverable_retrieval_events ?? [],
    payment_authorizations: s.payment_authorizations ?? [],
    webhook_deliveries: s.webhook_deliveries ?? [],
    _seq: s._seq ?? 1,
  }
}

let _cache: StoreData | null = null

function load(): StoreData {
  if (_cache) return _cache
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(STORE_FILE)) {
    try {
      _cache = normalizeStore(JSON.parse(readFileSync(STORE_FILE, 'utf8')) as Partial<StoreData>)
    } catch {
      _cache = emptyStore()
    }
  } else {
    _cache = emptyStore()
  }
  return _cache
}

function save(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(STORE_FILE, JSON.stringify(_cache, null, 2), 'utf8')
}

function nextId(): string {
  const s = load()
  const id = String(s._seq)
  s._seq++
  return id
}

export const devnetStore = {
  // ─── AUTH NONCES ───────────────────────────────────────────────────────────

  createNonce(nonce: Omit<DevnetNonce, 'id'>): DevnetNonce {
    const s = load()
    const record: DevnetNonce = { id: nextId(), ...nonce }
    s.auth_nonces.push(record)
    save()
    return record
  },

  findNonce(wallet: string, nonce: string): DevnetNonce | undefined {
    return load().auth_nonces.find(
      n =>
        n.wallet_address === wallet &&
        n.nonce === nonce &&
        !n.used &&
        new Date(n.expires_at) > new Date()
    )
  },

  markNonceUsed(id: string): void {
    const s = load()
    const n = s.auth_nonces.find(x => x.id === id)
    if (n) {
      n.used = true
      save()
    }
  },

  // ─── PROFILES ──────────────────────────────────────────────────────────────

  upsertProfile(
    wallet: string,
    data: Partial<Omit<DevnetProfile, 'id' | 'wallet_address' | 'created_at'>>
  ): DevnetProfile {
    const s = load()
    const now = new Date().toISOString()
    let profile = s.profiles.find(p => p.wallet_address === wallet)
    if (!profile) {
      profile = {
        id: nextId(),
        wallet_address: wallet,
        username: data.username ?? null,
        bio: data.bio ?? null,
        avatar_url: data.avatar_url ?? null,
        roles: data.roles ?? ['buyer'],
        created_at: now,
        updated_at: now,
      }
      s.profiles.push(profile)
    } else {
      Object.assign(profile, { ...data, updated_at: now })
    }
    save()
    return profile
  },

  getProfile(wallet: string): DevnetProfile | undefined {
    return load().profiles.find(p => p.wallet_address === wallet)
  },

  // ─── AGENTS ────────────────────────────────────────────────────────────────

  createAgent(agent: Omit<DevnetAgent, 'id'>): DevnetAgent {
    const s = load()
    const record: DevnetAgent = { id: nextId(), ...agent }
    s.agents.push(record)
    save()
    return record
  },

  getAgent(agentId: string): DevnetAgent | undefined {
    return load().agents.find(a => a.agent_id === agentId)
  },

  listAgents(filter: { search?: string; creatorWallet?: string }): DevnetAgent[] {
    const q = filter.search?.toLowerCase().trim()
    return load().agents.filter(a => {
      if (filter.creatorWallet && a.creator_wallet !== filter.creatorWallet) return false
      if (q && !a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false
      return a.active
    })
  },

  // ─── RUNS ──────────────────────────────────────────────────────────────────

  createRun(run: Omit<DevnetRun, 'id'>): DevnetRun {
    const s = load()
    const record: DevnetRun = { id: nextId(), ...run }
    s.runs.push(record)
    save()
    return record
  },

  getRun(runId: string): DevnetRun | undefined {
    return load().runs.find(r => r.run_id === runId)
  },

  updateRun(runId: string, patch: Partial<DevnetRun>): DevnetRun | undefined {
    const s = load()
    const run = s.runs.find(r => r.run_id === runId)
    if (!run) return undefined
    Object.assign(run, { ...patch, updated_at: new Date().toISOString() })
    save()
    return run
  },

  listRuns(filter: {
    buyerWallet?: string
    creatorWallet?: string
    agentId?: string
    status?: string
  }): DevnetRun[] {
    return load().runs.filter(r => {
      if (filter.buyerWallet && r.buyer_wallet !== filter.buyerWallet) return false
      if (filter.creatorWallet && r.creator_wallet !== filter.creatorWallet) return false
      if (filter.agentId && r.agent_id !== filter.agentId) return false
      if (filter.status && r.status !== filter.status) return false
      return true
    })
  },

  // ─── RECEIPTS ──────────────────────────────────────────────────────────────

  createReceipt(receipt: Omit<DevnetReceipt, 'id'>): DevnetReceipt {
    const s = load()
    const record: DevnetReceipt = { id: nextId(), ...receipt }
    s.receipts.push(record)
    save()
    return record
  },

  getReceipt(receiptId: string): DevnetReceipt | undefined {
    return load().receipts.find(r => r.receipt_id === receiptId)
  },

  getReceiptByRunId(runId: string): DevnetReceipt | undefined {
    return load().receipts.find(r => r.run_id === runId)
  },

  updateReceipt(receiptId: string, patch: Partial<DevnetReceipt>): DevnetReceipt | undefined {
    const s = load()
    const receipt = s.receipts.find(r => r.receipt_id === receiptId)
    if (!receipt) return undefined
    Object.assign(receipt, patch)
    save()
    return receipt
  },

  listReceipts(filter: {
    buyerWallet?: string
    creatorWallet?: string
    agentId?: string
  }): DevnetReceipt[] {
    return load().receipts.filter(r => {
      if (filter.buyerWallet && r.buyer_wallet !== filter.buyerWallet) return false
      if (filter.creatorWallet && r.creator_wallet !== filter.creatorWallet) return false
      if (filter.agentId && r.agent_id !== filter.agentId) return false
      return true
    })
  },

  // ─── PRIVATE THREADS ──────────────────────────────────────────────────────

  createPrivateThread(thread: Omit<DevnetPrivateThread, 'id'>): DevnetPrivateThread {
    const s = load()
    const record: DevnetPrivateThread = { id: nextId(), ...thread }
    s.private_threads.push(record)
    save()
    return record
  },

  getPrivateThread(threadId: string): DevnetPrivateThread | undefined {
    return load().private_threads.find(t => t.thread_id === threadId)
  },

  findPrivateThreadByParticipants(filter: {
    agentId: string
    buyerWallet: string
    creatorWallet: string
    runId?: string | null
  }): DevnetPrivateThread | undefined {
    return load().private_threads.find(t => {
      if (t.agent_id !== filter.agentId) return false
      if (t.buyer_wallet !== filter.buyerWallet) return false
      if (t.creator_wallet !== filter.creatorWallet) return false
      if (filter.runId !== undefined && t.run_id !== filter.runId) return false
      return true
    })
  },

  updatePrivateThread(
    threadId: string,
    patch: Partial<DevnetPrivateThread>
  ): DevnetPrivateThread | undefined {
    const s = load()
    const thread = s.private_threads.find(t => t.thread_id === threadId)
    if (!thread) return undefined
    Object.assign(thread, { ...patch, updated_at: new Date().toISOString() })
    save()
    return thread
  },

  hasPrivateThreadForRun(runId: string): boolean {
    return load().private_threads.some(thread => thread.run_id === runId)
  },

  listPrivateThreads(filter: {
    wallet: string
    role?: string
    status?: string
  }): DevnetPrivateThread[] {
    return load().private_threads.filter(thread => {
      const matchesWallet =
        thread.buyer_wallet === filter.wallet ||
        thread.creator_wallet === filter.wallet ||
        thread.evaluator_wallet === filter.wallet

      if (!matchesWallet) return false
      if (filter.status && thread.status !== filter.status) return false
      if (filter.role === 'buyer' && thread.buyer_wallet !== filter.wallet) return false
      if (filter.role === 'creator' && thread.creator_wallet !== filter.wallet) return false
      if (filter.role === 'evaluator' && thread.evaluator_wallet !== filter.wallet) return false
      return true
    })
  },

  createPrivateMessage(message: Omit<DevnetPrivateMessage, 'id'>): DevnetPrivateMessage {
    const s = load()
    const record: DevnetPrivateMessage = { id: nextId(), ...message }
    s.private_messages.push(record)
    save()
    return record
  },

  listPrivateMessages(threadId: string): DevnetPrivateMessage[] {
    return load().private_messages.filter(message => message.thread_id === threadId)
  },

  countPrivateMessages(threadId: string): number {
    return load().private_messages.filter(message => message.thread_id === threadId).length
  },

  // ─── DELIVERABLES ─────────────────────────────────────────────────────────

  createDeliverable(deliverable: Omit<DevnetDeliverable, 'id'>): DevnetDeliverable {
    const s = load()
    const record: DevnetDeliverable = { id: nextId(), ...deliverable }
    s.encrypted_deliverables.push(record)
    save()
    return record
  },

  getDeliverable(deliverableId: string): DevnetDeliverable | undefined {
    return load().encrypted_deliverables.find(d => d.deliverable_id === deliverableId)
  },

  getDeliverableByRunId(runId: string): DevnetDeliverable | undefined {
    return load().encrypted_deliverables.find(d => d.run_id === runId)
  },

  getDeliverableByReceiptId(receiptId: string): DevnetDeliverable | undefined {
    return load().encrypted_deliverables.find(d => d.receipt_id === receiptId)
  },

  updateDeliverable(
    deliverableId: string,
    patch: Partial<DevnetDeliverable>
  ): DevnetDeliverable | undefined {
    const s = load()
    const deliverable = s.encrypted_deliverables.find(d => d.deliverable_id === deliverableId)
    if (!deliverable) return undefined
    Object.assign(deliverable, { ...patch, updated_at: new Date().toISOString() })
    save()
    return deliverable
  },

  createDeliverableRetrievalEvent(
    event: Omit<DevnetDeliverableRetrievalEvent, 'id'>
  ): DevnetDeliverableRetrievalEvent {
    const s = load()
    const record: DevnetDeliverableRetrievalEvent = { id: nextId(), ...event }
    s.deliverable_retrieval_events.push(record)
    save()
    return record
  },

  listDeliverableRetrievalEvents(deliverableId: string): DevnetDeliverableRetrievalEvent[] {
    return load().deliverable_retrieval_events.filter(event => event.deliverable_id === deliverableId)
  },

  // ─── PAYMENT AUTHORIZATIONS ──────────────────────────────────────────────

  listPaymentAuthorizations(filter: {
    buyerWallet?: string
    creatorWallet?: string
    agentId?: string
    status?: string
  }): DevnetPaymentAuthorization[] {
    return load().payment_authorizations.filter(a => {
      if (filter.buyerWallet && a.buyer_wallet !== filter.buyerWallet) return false
      if (filter.creatorWallet && a.creator_wallet !== filter.creatorWallet) return false
      if (filter.agentId && a.agent_id !== filter.agentId) return false
      if (filter.status && a.status !== filter.status) return false
      return true
    })
  },

  createPaymentAuthorization(
    authorization: Omit<DevnetPaymentAuthorization, 'id'>
  ): DevnetPaymentAuthorization {
    const s = load()
    const record: DevnetPaymentAuthorization = { id: nextId(), ...authorization }
    s.payment_authorizations.push(record)
    save()
    return record
  },

  getPaymentAuthorization(authorizationId: string): DevnetPaymentAuthorization | undefined {
    return load().payment_authorizations.find(a => a.authorization_id === authorizationId)
  },

  getPaymentAuthorizationByRunId(runId: string): DevnetPaymentAuthorization | undefined {
    return [...load().payment_authorizations]
      .reverse()
      .find(a => a.run_id === runId)
  },

  updatePaymentAuthorization(
    authorizationId: string,
    patch: Partial<DevnetPaymentAuthorization>
  ): DevnetPaymentAuthorization | undefined {
    const s = load()
    const authorization = s.payment_authorizations.find(a => a.authorization_id === authorizationId)
    if (!authorization) return undefined
    Object.assign(authorization, { ...patch, updated_at: new Date().toISOString() })
    save()
    return authorization
  },

  createWebhookDelivery(delivery: Omit<DevnetWebhookDelivery, 'id'>): DevnetWebhookDelivery {
    const s = load()
    const record: DevnetWebhookDelivery = { id: nextId(), ...delivery }
    s.webhook_deliveries.push(record)
    save()
    return record
  },

  updateWebhookDelivery(
    deliveryId: string,
    patch: Partial<DevnetWebhookDelivery>
  ): DevnetWebhookDelivery | undefined {
    const s = load()
    const delivery = s.webhook_deliveries.find(item => item.delivery_id === deliveryId)
    if (!delivery) return undefined
    Object.assign(delivery, { ...patch, updated_at: new Date().toISOString() })
    save()
    return delivery
  },

  listWebhookDeliveries(filter: { eventId?: string; status?: string }): DevnetWebhookDelivery[] {
    return load().webhook_deliveries.filter(delivery => {
      if (filter.eventId && delivery.event_id !== filter.eventId) return false
      if (filter.status && delivery.status !== filter.status) return false
      return true
    })
  },
}

/** Returns true when the production Postgres database is configured. */
export function shouldUsePostgres(): boolean {
  return !!process.env.DATABASE_URL
}

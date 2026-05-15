import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedWallet, ServerConfigError, isServerConfigError } from '@/lib/auth'
import { serverConfigError, validationError, forbiddenError } from '@/lib/api-error'

export const PRIVATE_THREAD_STATUSES = [
  'open',
  'quoted',
  'terms_accepted',
  'delivered',
  'disputed',
  'closed',
] as const

export const PRIVATE_MESSAGE_TYPES = [
  'quote_request',
  'quote_response',
  'task_terms',
  'terms_acceptance',
  'delivery_notice',
  'dispute_note',
  'evaluator_note',
  'system',
] as const

export const DELIVERABLE_STATUSES = [
  'draft',
  'submitted',
  'buyer_retrieved',
  'evaluator_reviewed',
  'disputed',
  'sealed',
] as const

export const RETRIEVAL_EVENT_TYPES = ['buyer_retrieved', 'evaluator_reviewed'] as const

export type PrivateThreadStatus = (typeof PRIVATE_THREAD_STATUSES)[number]
export type PrivateMessageType = (typeof PRIVATE_MESSAGE_TYPES)[number]
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number]
export type RetrievalEventType = (typeof RETRIEVAL_EVENT_TYPES)[number]
export type PrivateViewerRole = 'buyer' | 'creator' | 'evaluator'
export type PrivateDecryptRole = 'buyer' | 'evaluator'

export interface PrivateParticipants {
  buyerWallet: string
  creatorWallet: string
  evaluatorWallet: string | null
}

export interface EnvelopeRecord {
  envelopeVersion: string
  ciphertext: string
  nonce: string
  ciphertextHash: string
  plaintextHash: string
  encryptionScheme: string
  timestamp: string
}

export interface MessageEnvelopeInput {
  threadId: string
  senderWallet: string
  recipientWallet: string
  messageType: PrivateMessageType
  content: string
  timestamp?: string
}

const ENVELOPE_VERSION = 'kairo-cipher-envelope-v1'
const ENCRYPTION_SCHEME = 'kairo-local-aes-gcm-v1'

function getEncryptionKey(): Buffer {
  const seed = process.env.KAIRO_ENCRYPTION_KEY?.trim()
  if (!seed) {
    throw new ServerConfigError('Private A2A encryption is not configured')
  }
  return createHash('sha256').update(seed).digest()
}

export function requirePrivateA2aEncryptionConfigured(): void {
  getEncryptionKey()
}

function buildAad(input: {
  threadId: string
  senderWallet: string
  recipientWallet: string
  messageType: string
  timestamp: string
}): Buffer {
  return Buffer.from(JSON.stringify(input), 'utf8')
}

export function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function generatePrivateThreadId(): string {
  return `thread-${Date.now()}-${randomBytes(6).toString('hex')}`
}

export function generatePrivateMessageId(): string {
  return `msg-${Date.now()}-${randomBytes(6).toString('hex')}`
}

export function generateDeliverableId(): string {
  return `deliv-${Date.now()}-${randomBytes(6).toString('hex')}`
}

export function generateRetrievalEventId(): string {
  return `retrv-${Date.now()}-${randomBytes(6).toString('hex')}`
}

export function requirePrivateViewer(
  request: NextRequest,
  endpoint: string
): { wallet: string } | NextResponse {
  return requireAuthenticatedWallet(request, endpoint)
}

export function resolveViewerRole(
  wallet: string,
  participants: PrivateParticipants
): PrivateViewerRole | null {
  if (wallet === participants.buyerWallet) return 'buyer'
  if (wallet === participants.creatorWallet) return 'creator'
  if (participants.evaluatorWallet && wallet === participants.evaluatorWallet) return 'evaluator'
  return null
}

export function assertViewerRole(
  wallet: string,
  participants: PrivateParticipants,
  endpoint: string
): PrivateViewerRole | NextResponse {
  const role = resolveViewerRole(wallet, participants)
  if (!role) {
    return forbiddenError('You do not have access to this private resource', endpoint, wallet)
  }
  return role
}

export function canDecryptDeliverable(role: PrivateViewerRole): role is PrivateDecryptRole {
  return role === 'buyer' || role === 'evaluator'
}

export function validateEnumValue<T extends readonly string[]>(
  value: string,
  allowed: T,
  field: string,
  endpoint: string,
  wallet?: string
): NextResponse | null {
  if (!allowed.includes(value)) {
    return validationError(`Invalid ${field}`, endpoint, wallet)
  }
  return null
}

export function handlePrivateA2aConfigError(
  error: unknown,
  endpoint: string,
  wallet?: string
): NextResponse | null {
  if (!isServerConfigError(error)) return null
  return serverConfigError(error.message, endpoint, wallet)
}

export function encryptEnvelope(input: MessageEnvelopeInput): EnvelopeRecord {
  const timestamp = input.timestamp ?? new Date().toISOString()
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), nonce)
  const aad = buildAad({
    threadId: input.threadId,
    senderWallet: input.senderWallet,
    recipientWallet: input.recipientWallet,
    messageType: input.messageType,
    timestamp,
  })

  cipher.setAAD(aad)
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(input.content, 'utf8')),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([encrypted, authTag]).toString('base64')

  return {
    envelopeVersion: ENVELOPE_VERSION,
    ciphertext: payload,
    nonce: nonce.toString('base64'),
    ciphertextHash: hashText(payload),
    plaintextHash: hashText(input.content),
    encryptionScheme: ENCRYPTION_SCHEME,
    timestamp,
  }
}

export function decryptEnvelope(input: {
  threadId: string
  senderWallet: string
  recipientWallet: string
  messageType: string
  timestamp: string
  ciphertext: string
  nonce: string
}): string {
  const data = Buffer.from(input.ciphertext, 'base64')
  const authTag = data.subarray(data.length - 16)
  const encrypted = data.subarray(0, data.length - 16)
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(input.nonce, 'base64')
  )
  decipher.setAAD(
    buildAad({
      threadId: input.threadId,
      senderWallet: input.senderWallet,
      recipientWallet: input.recipientWallet,
      messageType: input.messageType,
      timestamp: input.timestamp,
    })
  )
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function buildPublicProofEnvelope(input: {
  threadId: string | null
  deliverableId: string | null
  encryptedDeliverableHash: string | null
  messageCount: number
  status: string
  receiptHash: string
  payment?: Record<string, unknown> | null
  safety?: Record<string, unknown> | null
}): Record<string, unknown> {
  return {
    envelopeVersion: ENVELOPE_VERSION,
    threadId: input.threadId,
    encryptedDeliverableId: input.deliverableId,
    encryptedDeliverableHash: input.encryptedDeliverableHash,
    messageCount: input.messageCount,
    receiptHash: input.receiptHash,
    status: input.status,
    payment: input.payment ?? null,
    safety: input.safety ?? null,
    privateContentRedacted: true,
  }
}

export function redactWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

export function formatPublicReceipt(record: {
  receiptId: string
  runId: string
  agentId: string
  agentName: string
  creatorWallet: string
  status: string
  resultHash: string
  receiptHash: string
  encryptedDeliverableHash: string | null
  messageCount: number
  privateContentRedacted: boolean
  evaluatorAttestationStatus: string | null
  publicProofEnvelope: Record<string, unknown> | null
  payment?: Record<string, unknown> | null
  createdAt: string
}) {
  return {
    receiptId: record.receiptId,
    runId: record.runId,
    agentId: record.agentId,
    agentName: record.agentName,
    creatorWallet: record.creatorWallet,
    status: record.status,
    resultHash: record.resultHash,
    receiptHash: record.receiptHash,
    encryptedDeliverableHash: record.encryptedDeliverableHash,
    messageCount: record.messageCount,
    privateContentRedacted: record.privateContentRedacted,
    evaluatorAttestationStatus: record.evaluatorAttestationStatus,
    publicProofEnvelope: sanitizePublicProofEnvelope(record.publicProofEnvelope),
    payment: sanitizeReceiptPayment(record.payment ?? extractPaymentProof(record.publicProofEnvelope)),
    createdAt: record.createdAt,
  }
}

function extractPaymentProof(
  publicProofEnvelope: Record<string, unknown> | null
): Record<string, unknown> | null {
  const payment = publicProofEnvelope?.payment
  if (payment && typeof payment === 'object' && !Array.isArray(payment)) {
    return payment as Record<string, unknown>
  }
  return null
}

function sanitizePublicProofEnvelope(
  publicProofEnvelope: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!publicProofEnvelope) return null
  const payment = extractPaymentProof(publicProofEnvelope)
  if (!payment) return publicProofEnvelope
  return {
    ...publicProofEnvelope,
    payment: sanitizeReceiptPayment(payment),
  }
}

function sanitizeReceiptPayment(payment: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!payment) return null
  return pickDefined({
    authorizationId: payment.authorizationId,
    runId: payment.runId,
    receiptId: payment.receiptId,
    buyerWalletRedacted: payment.buyerWalletRedacted,
    creatorWallet: payment.creatorWallet,
    agentId: payment.agentId,
    agentName: payment.agentName,
    amountAtomic: payment.amountAtomic,
    maxAmountAtomic: payment.maxAmountAtomic,
    amountSol: payment.amountSol,
    currency: payment.currency,
    status: payment.status,
    proofReference: payment.proofReference,
    proofPayloadHash: payment.proofPayloadHash,
    proofRecordedAt: payment.proofRecordedAt,
    settledAt: payment.settledAt,
    expiresAt: payment.expiresAt,
    platformFeeAtomic: payment.platformFeeAtomic,
    creatorPayoutAtomic: payment.creatorPayoutAtomic,
    creatorPayoutStatus: payment.creatorPayoutStatus,
    evaluatorAttestationStatus: payment.evaluatorAttestationStatus,
    escrowState: payment.escrowState,
    paymentProof: sanitizePaymentProof(payment.paymentProof),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  })
}

function sanitizePaymentProof(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const proof = value as Record<string, unknown>
  return pickDefined({
    proofReference: proof.proofReference,
    proofRecordedAt: proof.proofRecordedAt,
    settlementStatus: proof.settlementStatus,
  })
}

function pickDefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
}

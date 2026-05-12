import {
  PAYMENT_AUTHORIZATION_STATUSES,
  PaymentAuthorizationRecord,
  PaymentAuthorizationStatus,
} from './types'

const FINAL_STATUSES: PaymentAuthorizationStatus[] = [
  'settled',
  'failed',
  'refunded',
  'disputed',
  'expired',
]

const BLOCKING_TOLLGATE_STATUSES: PaymentAuthorizationStatus[] = [
  'failed',
  'refunded',
  'disputed',
  'expired',
]

const TRANSITIONS: Record<PaymentAuthorizationStatus, PaymentAuthorizationStatus[]> = {
  quoted: ['authorization_requested', 'expired', 'failed'],
  authorization_requested: ['wallet_approved', 'expired', 'failed', 'disputed'],
  wallet_approved: ['proof_pending', 'failed', 'refunded', 'disputed', 'expired'],
  proof_pending: ['proof_recorded', 'failed', 'refunded', 'disputed', 'expired'],
  proof_recorded: ['settled', 'failed', 'refunded', 'disputed'],
  settled: ['refunded', 'disputed'],
  failed: [],
  refunded: [],
  disputed: ['refunded', 'settled'],
  expired: [],
}

export function isPaymentAuthorizationStatus(value: string): value is PaymentAuthorizationStatus {
  return PAYMENT_AUTHORIZATION_STATUSES.includes(value as PaymentAuthorizationStatus)
}

export function assertPaymentTransition(
  from: PaymentAuthorizationStatus,
  to: PaymentAuthorizationStatus
): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error(`Payment authorization cannot transition from ${from} to ${to}`)
  }
}

export function isFinalPaymentStatus(status: PaymentAuthorizationStatus): boolean {
  return FINAL_STATUSES.includes(status)
}

export function isBlockingTollgateStatus(status: PaymentAuthorizationStatus): boolean {
  return BLOCKING_TOLLGATE_STATUSES.includes(status)
}

export function canFulfillPaidRun(record: PaymentAuthorizationRecord | null | undefined): boolean {
  if (!record) return false
  if (new Date(record.expiresAt).getTime() <= Date.now()) return false
  return record.status === 'proof_recorded' || record.status === 'settled'
}

export function buildStateEvent(
  status: PaymentAuthorizationStatus,
  note: string,
  at = new Date().toISOString()
) {
  return { status, note, at }
}

export function nextEscrowState(status: PaymentAuthorizationStatus) {
  if (status === 'settled') return 'released'
  if (status === 'refunded') return 'refunded'
  if (status === 'disputed') return 'disputed'
  if (status === 'proof_recorded') return 'held'
  return 'none'
}

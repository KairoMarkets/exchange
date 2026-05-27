import type { PaymentAuthorizationRecord } from './types'

export interface PaymentAuthorizationProjection {
  authorizationId: string
  runId: string
  amountAtomic: string
  network: 'solana-mainnet' | 'solana-devnet'
  status: PaymentAuthorizationRecord['status']
  privateExecutionRedacted: true
}

const fixtureRecords = new Map<string, PaymentAuthorizationProjection>()

export function registerPaymentAuthorizationFixture(record: PaymentAuthorizationProjection): void {
  fixtureRecords.set(record.authorizationId, record)
}

export async function getPaymentAuthorizationRecord(authorizationId: string): Promise<PaymentAuthorizationProjection | null> {
  return fixtureRecords.get(authorizationId) ?? null
}

export async function getPaymentAuthorizationForRun(runId: string): Promise<PaymentAuthorizationProjection | null> {
  return [...fixtureRecords.values()].find((record) => record.runId === runId) ?? null
}

export function clearPaymentAuthorizationFixtures(): void {
  fixtureRecords.clear()
}

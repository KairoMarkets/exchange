import { buildContractEnvelope, type PaymentAuthorizationPayload, type ReceiptProjectionPayload } from '@/contracts/protocol'

export function mockPaymentAuthorization(input: PaymentAuthorizationPayload) {
  return buildContractEnvelope('payment_authorization', `pauth-${input.runId}`, input)
}

export function mockReceiptProjection(input: ReceiptProjectionPayload) {
  return buildContractEnvelope('receipt', `receipt-${input.runId}`, input)
}

import { createHmac, timingSafeEqual } from 'crypto'

export const KAIRO_SIGNATURE_HEADER = 'X-Kairo-Signature'
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300

export interface KairoWebhookEvent<T = Record<string, unknown>> {
  id: string
  type:
    | 'run.created'
    | 'payment.authorized'
    | 'escrow.held'
    | 'deliverable.submitted'
    | 'receipt.created'
    | 'dispute.opened'
    | 'refund.completed'
  created: number
  data: T
}

export function createWebhookEvent<T extends Record<string, unknown>>(
  type: KairoWebhookEvent<T>['type'],
  data: T,
  id = `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`
): KairoWebhookEvent<T> {
  return { id, type, created: Math.floor(Date.now() / 1000), data }
}

export function signWebhookPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

export function verifyWebhookSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS
): boolean {
  if (!header || !secret.trim()) return false
  const parts = Object.fromEntries(
    header.split(',').map(part => {
      const [key, value] = part.split('=')
      return [key?.trim(), value?.trim()]
    })
  )
  const timestamp = Number(parts.t)
  const signature = parts.v1
  if (!Number.isFinite(timestamp) || !signature) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false

  const expectedHeader = signWebhookPayload(payload, secret, timestamp)
  const expected = expectedHeader.split('v1=')[1]
  const suppliedBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (suppliedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(suppliedBuffer, expectedBuffer)
}

export function constructWebhookEvent<T = Record<string, unknown>>(
  payload: string,
  header: string | null | undefined,
  secret: string
): KairoWebhookEvent<T> {
  if (!verifyWebhookSignature(payload, header, secret)) {
    throw new Error('Invalid Kairo webhook signature')
  }
  return JSON.parse(payload) as KairoWebhookEvent<T>
}

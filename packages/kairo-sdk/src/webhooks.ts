import { createHmac, timingSafeEqual } from 'crypto'
import { KairoWebhookEvent } from './types.js'

export const KAIRO_SIGNATURE_HEADER = 'X-Kairo-Signature'

export function signWebhookPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

export function verifyWebhookSignature(payload: string, header: string | null | undefined, secret: string): boolean {
  if (!header || !secret.trim()) return false
  const values = Object.fromEntries(
    header.split(',').map(part => {
      const [key, value] = part.split('=')
      return [key?.trim(), value?.trim()]
    })
  )
  const timestamp = Number(values.t)
  const signature = values.v1
  if (!Number.isFinite(timestamp) || !signature) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false

  const expected = signWebhookPayload(payload, secret, timestamp).split('v1=')[1]
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

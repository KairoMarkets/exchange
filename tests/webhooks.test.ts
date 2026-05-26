import { describe, expect, it, vi } from 'vitest'
import {
  KAIRO_SIGNATURE_HEADER,
  constructWebhookEvent,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../packages/kairo-sdk/src/webhooks'

describe('SDK webhook helpers', () => {
  it('exports the signature header expected by webhook consumers', () => {
    expect(KAIRO_SIGNATURE_HEADER).toBe('X-Kairo-Signature')
  })

  it('signs and verifies payloads with the shared secret', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'receipt.created' })
    const header = signWebhookPayload(payload, 'webhook-secret', 1_777_800_000)

    vi.setSystemTime(new Date(1_777_800_030_000))
    expect(verifyWebhookSignature(payload, header, 'webhook-secret')).toBe(true)
    expect(verifyWebhookSignature(payload, header, 'wrong-secret')).toBe(false)
    vi.useRealTimers()
  })

  it('rejects malformed, missing, expired, or empty-secret signatures', () => {
    const payload = '{}'
    const header = signWebhookPayload(payload, 'webhook-secret', 1_700_000_000)

    vi.setSystemTime(new Date(1_777_800_000_000))
    expect(verifyWebhookSignature(payload, null, 'webhook-secret')).toBe(false)
    expect(verifyWebhookSignature(payload, 't=bad,v1=abcd', 'webhook-secret')).toBe(false)
    expect(verifyWebhookSignature(payload, header, 'webhook-secret')).toBe(false)
    expect(verifyWebhookSignature(payload, header, '   ')).toBe(false)
    vi.useRealTimers()
  })

  it('constructs typed events only when signature verification succeeds', () => {
    const payload = JSON.stringify({ id: 'evt_2', type: 'payment.authorized', created: 1_777_800_000, data: { runId: 'run_1' } })
    const header = signWebhookPayload(payload, 'webhook-secret', 1_777_800_000)

    vi.setSystemTime(new Date(1_777_800_010_000))
    expect(constructWebhookEvent(payload, header, 'webhook-secret')).toMatchObject({
      id: 'evt_2',
      type: 'payment.authorized',
      data: { runId: 'run_1' },
    })
    expect(() => constructWebhookEvent(payload, header, 'wrong-secret')).toThrow('Invalid Kairo webhook signature')
    vi.useRealTimers()
  })
})

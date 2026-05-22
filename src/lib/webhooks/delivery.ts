import { createPool } from '@/lib/db'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { logger } from '@/lib/logger'
import { KairoWebhookEvent, signWebhookPayload } from './signature'

export interface WebhookDeliveryResult {
  deliveryId: string
  status: 'delivered' | 'failed'
  responseStatus: number | null
  retryCount: number
}

export async function deliverWebhookEvent(
  targetUrl: string,
  event: KairoWebhookEvent,
  secret: string,
  maxAttempts = 3
): Promise<WebhookDeliveryResult> {
  const now = new Date().toISOString()
  const deliveryId = `dlv_${Date.now()}_${event.id}`
  await createDeliveryRecord({
    deliveryId,
    eventId: event.id,
    eventType: event.type,
    targetUrl,
    status: 'pending',
    responseStatus: null,
    retryCount: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  })

  const payload = JSON.stringify(event)
  let responseStatus: number | null = null
  let lastError: string | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Kairo-Signature': signWebhookPayload(payload, secret),
          'X-Kairo-Event': event.type,
          'X-Kairo-Delivery': deliveryId,
          'Idempotency-Key': deliveryId,
        },
        body: payload,
      })
      responseStatus = response.status
      if (response.ok) {
        await updateDeliveryRecord(deliveryId, {
          status: 'delivered',
          responseStatus,
          retryCount: attempt - 1,
          lastError: null,
        })
        return { deliveryId, status: 'delivered', responseStatus, retryCount: attempt - 1 }
      }
      lastError = `HTTP ${response.status}`
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : 'Webhook delivery failed'
    }
  }

  await updateDeliveryRecord(deliveryId, {
    status: 'failed',
    responseStatus,
    retryCount: maxAttempts - 1,
    lastError,
  })
  logger.warn('Webhook delivery failed', {
    event: event.type,
    requestId: deliveryId,
    responseStatus,
  })
  return { deliveryId, status: 'failed', responseStatus, retryCount: maxAttempts - 1 }
}

async function createDeliveryRecord(input: {
  deliveryId: string
  eventId: string
  eventType: string
  targetUrl: string
  status: 'pending' | 'delivered' | 'failed'
  responseStatus: number | null
  retryCount: number
  lastError: string | null
  createdAt: string
  updatedAt: string
}): Promise<void> {
  if (!shouldUsePostgres()) {
    devnetStore.createWebhookDelivery({
      delivery_id: input.deliveryId,
      event_id: input.eventId,
      event_type: input.eventType,
      target_url: input.targetUrl,
      status: input.status,
      response_status: input.responseStatus,
      retry_count: input.retryCount,
      last_error: input.lastError,
      created_at: input.createdAt,
      updated_at: input.updatedAt,
    })
    return
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    await client.query(
      `INSERT INTO webhook_deliveries
         (delivery_id, event_id, event_type, target_url, status, response_status,
          retry_count, last_error, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        input.deliveryId,
        input.eventId,
        input.eventType,
        input.targetUrl,
        input.status,
        input.responseStatus,
        input.retryCount,
        input.lastError,
        input.createdAt,
        input.updatedAt,
      ]
    )
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

async function updateDeliveryRecord(
  deliveryId: string,
  patch: {
    status: 'delivered' | 'failed'
    responseStatus: number | null
    retryCount: number
    lastError: string | null
  }
): Promise<void> {
  if (!shouldUsePostgres()) {
    devnetStore.updateWebhookDelivery(deliveryId, {
      status: patch.status,
      response_status: patch.responseStatus,
      retry_count: patch.retryCount,
      last_error: patch.lastError,
    })
    return
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    await client.query(
      `UPDATE webhook_deliveries
       SET status = $2, response_status = $3, retry_count = $4, last_error = $5, updated_at = $6
       WHERE delivery_id = $1`,
      [deliveryId, patch.status, patch.responseStatus, patch.retryCount, patch.lastError, new Date().toISOString()]
    )
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

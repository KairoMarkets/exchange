import { NextRequest, NextResponse } from 'next/server'
import { validationError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { constructWebhookEvent, KAIRO_SIGNATURE_HEADER } from '@/lib/webhooks/signature'

export async function POST(request: NextRequest) {
  const secret = process.env.KAIRO_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return validationError('KAIRO_WEBHOOK_SECRET is required', 'POST /api/webhooks/kairo')
  }

  const rawBody = await request.text()
  try {
    const event = constructWebhookEvent(rawBody, request.headers.get(KAIRO_SIGNATURE_HEADER), secret)
    logger.info('Kairo webhook accepted', {
      route: 'POST /api/webhooks/kairo',
      event: event.type,
      requestId: event.id,
    })
    return NextResponse.json({ received: true, eventId: event.id, eventType: event.type })
  } catch (error: unknown) {
    return validationError(
      error instanceof Error ? error.message : 'Invalid Kairo webhook payload',
      'POST /api/webhooks/kairo'
    )
  }
}

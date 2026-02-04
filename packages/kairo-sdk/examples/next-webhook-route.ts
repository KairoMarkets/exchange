import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent, KAIRO_SIGNATURE_HEADER } from '../src/index.js'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const event = constructWebhookEvent(
    rawBody,
    request.headers.get(KAIRO_SIGNATURE_HEADER),
    process.env.KAIRO_WEBHOOK_SECRET ?? ''
  )

  return NextResponse.json({ received: true, eventType: event.type })
}

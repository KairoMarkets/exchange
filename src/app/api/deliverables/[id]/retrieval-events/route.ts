import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { databaseError, forbiddenError, notFoundError, validationError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import {
  RETRIEVAL_EVENT_TYPES,
  assertViewerRole,
  buildPublicProofEnvelope,
  generateRetrievalEventId,
  requirePrivateViewer,
  validateEnumValue,
} from '@/lib/private-a2a'

interface RetrievalEventBody {
  eventType?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePrivateViewer(request, 'POST /api/deliverables/[id]/retrieval-events')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const deliverableId = id?.trim()
  if (!deliverableId) {
    return notFoundError(
      'Deliverable',
      'POST /api/deliverables/[id]/retrieval-events',
      auth.wallet
    )
  }

  let body: RetrievalEventBody = {}
  try {
    body = await request.json()
  } catch {
    return validationError(
      'Request body must be valid JSON',
      'POST /api/deliverables/[id]/retrieval-events',
      auth.wallet
    )
  }

  const eventType = body.eventType?.trim()
  if (!eventType) {
    return validationError(
      'eventType is required',
      'POST /api/deliverables/[id]/retrieval-events',
      auth.wallet
    )
  }
  const typeError = validateEnumValue(
    eventType,
    RETRIEVAL_EVENT_TYPES,
    'eventType',
    'POST /api/deliverables/[id]/retrieval-events',
    auth.wallet
  )
  if (typeError) return typeError

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      await client.query('BEGIN')
      const result = await client.query(
        `SELECT deliverable_id, run_id, thread_id, receipt_id, creator_wallet, buyer_wallet,
                evaluator_wallet, ciphertext_hash
         FROM encrypted_deliverables
         WHERE deliverable_id = $1
         FOR UPDATE`,
        [deliverableId]
      )
      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return notFoundError(
          'Deliverable',
          'POST /api/deliverables/[id]/retrieval-events',
          auth.wallet
        )
      }
      const deliverable = result.rows[0] as {
        deliverable_id: string
        run_id: string
        thread_id: string
        receipt_id: string
        creator_wallet: string
        buyer_wallet: string
        evaluator_wallet: string | null
        ciphertext_hash: string
      }
      const viewerRole = assertViewerRole(
        auth.wallet,
        {
          buyerWallet: deliverable.buyer_wallet,
          creatorWallet: deliverable.creator_wallet,
          evaluatorWallet: deliverable.evaluator_wallet,
        },
        'POST /api/deliverables/[id]/retrieval-events'
      )
      if (viewerRole instanceof NextResponse) {
        await client.query('ROLLBACK')
        return viewerRole
      }

      if (
        (eventType === 'buyer_retrieved' && viewerRole !== 'buyer') ||
        (eventType === 'evaluator_reviewed' && viewerRole !== 'evaluator')
      ) {
        await client.query('ROLLBACK')
        return forbiddenError(
          'Event type does not match your role',
          'POST /api/deliverables/[id]/retrieval-events',
          auth.wallet
        )
      }

      const eventId = generateRetrievalEventId()
      const now = new Date().toISOString()
      await client.query(
        `INSERT INTO deliverable_retrieval_events
           (event_id, deliverable_id, run_id, actor_wallet, actor_role, event_type, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [eventId, deliverableId, deliverable.run_id, auth.wallet, viewerRole, eventType, now]
      )
      await client.query(
        `UPDATE encrypted_deliverables
         SET status = $1, updated_at = $2
         WHERE deliverable_id = $3`,
        [eventType, now, deliverableId]
      )
      const receiptResult = await client.query(
        `SELECT receipt_hash FROM receipts WHERE receipt_id = $1`,
        [deliverable.receipt_id]
      )
      const messageCountResult = await client.query(
        `SELECT COUNT(*) AS total FROM private_messages WHERE thread_id = $1`,
        [deliverable.thread_id]
      )
      await client.query(
        `UPDATE receipts
         SET encrypted_deliverable_hash = $1,
             evaluator_attestation_status = $2,
             public_proof_envelope_json = $3
         WHERE receipt_id = $4`,
        [
          deliverable.ciphertext_hash,
          eventType === 'evaluator_reviewed' ? 'reviewed' : null,
          JSON.stringify(
            buildPublicProofEnvelope({
              threadId: deliverable.thread_id,
              deliverableId,
              encryptedDeliverableHash: deliverable.ciphertext_hash,
              messageCount: parseInt(
                String((messageCountResult.rows[0] as { total: string }).total),
                10
              ),
              status: eventType,
              receiptHash: String(
                (receiptResult.rows[0] as { receipt_hash: string }).receipt_hash
              ),
            })
          ),
          deliverable.receipt_id,
        ]
      )
      await client.query('COMMIT')

      return NextResponse.json(
        {
          event: {
            eventId,
            deliverableId,
            runId: deliverable.run_id,
            actorWallet: auth.wallet,
            actorRole: viewerRole,
            eventType,
            createdAt: now,
          },
        },
        { status: 201 }
      )
    } catch (error: unknown) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      return databaseError('POST /api/deliverables/[id]/retrieval-events', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const deliverable = devnetStore.getDeliverable(deliverableId)
  if (!deliverable) {
    return notFoundError('Deliverable', 'POST /api/deliverables/[id]/retrieval-events', auth.wallet)
  }
  const viewerRole = assertViewerRole(
    auth.wallet,
    {
      buyerWallet: deliverable.buyer_wallet,
      creatorWallet: deliverable.creator_wallet,
      evaluatorWallet: deliverable.evaluator_wallet,
    },
    'POST /api/deliverables/[id]/retrieval-events'
  )
  if (viewerRole instanceof NextResponse) return viewerRole
  if (
    (eventType === 'buyer_retrieved' && viewerRole !== 'buyer') ||
    (eventType === 'evaluator_reviewed' && viewerRole !== 'evaluator')
  ) {
    return forbiddenError(
      'Event type does not match your role',
      'POST /api/deliverables/[id]/retrieval-events',
      auth.wallet
    )
  }

  const eventId = generateRetrievalEventId()
  const now = new Date().toISOString()
  devnetStore.createDeliverableRetrievalEvent({
    event_id: eventId,
    deliverable_id: deliverableId,
    run_id: deliverable.run_id,
    actor_wallet: auth.wallet,
    actor_role: viewerRole,
    event_type: eventType,
    created_at: now,
  })
  devnetStore.updateDeliverable(deliverableId, { status: eventType })
  const receipt = devnetStore.getReceipt(deliverable.receipt_id)
  if (receipt) {
    devnetStore.updateReceipt(receipt.receipt_id, {
      encrypted_deliverable_hash: deliverable.ciphertext_hash,
      evaluator_attestation_status: eventType === 'evaluator_reviewed' ? 'reviewed' : null,
      public_proof_envelope_json: buildPublicProofEnvelope({
        threadId: deliverable.thread_id,
        deliverableId,
        encryptedDeliverableHash: deliverable.ciphertext_hash,
        messageCount: devnetStore.countPrivateMessages(deliverable.thread_id),
        status: eventType,
        receiptHash: receipt.receipt_hash,
      }),
    })
  }

  return NextResponse.json(
    {
      event: {
        eventId,
        deliverableId,
        runId: deliverable.run_id,
        actorWallet: auth.wallet,
        actorRole: viewerRole,
        eventType,
        createdAt: now,
      },
    },
    { status: 201 }
  )
}

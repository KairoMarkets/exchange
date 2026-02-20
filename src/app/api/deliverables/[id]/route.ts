import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { databaseError, notFoundError, forbiddenError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import {
  assertViewerRole,
  canDecryptDeliverable,
  decryptEnvelope,
  handlePrivateA2aConfigError,
  requirePrivateViewer,
} from '@/lib/private-a2a'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePrivateViewer(request, 'GET /api/deliverables/[id]')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const deliverableId = id?.trim()
  if (!deliverableId) return notFoundError('Deliverable', 'GET /api/deliverables/[id]', auth.wallet)
  const includePlaintext = request.nextUrl.searchParams.get('decrypt') === 'true'

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const result = await client.query(
        `SELECT deliverable_id, run_id, thread_id, receipt_id, creator_wallet, buyer_wallet,
                evaluator_wallet, storage_kind, ciphertext, ciphertext_hash, plaintext_hash,
                nonce, encryption_scheme, access_policy_json, status, created_at, updated_at
         FROM encrypted_deliverables
         WHERE deliverable_id = $1`,
        [deliverableId]
      )
      if (result.rows.length === 0) {
        return notFoundError('Deliverable', 'GET /api/deliverables/[id]', auth.wallet)
      }
      const row = result.rows[0] as Record<string, unknown>
      const viewerRole = assertViewerRole(
        auth.wallet,
        {
          buyerWallet: String(row.buyer_wallet),
          creatorWallet: String(row.creator_wallet),
          evaluatorWallet: (row.evaluator_wallet as string | null) ?? null,
        },
        'GET /api/deliverables/[id]'
      )
      if (viewerRole instanceof NextResponse) return viewerRole
      if (includePlaintext && !canDecryptDeliverable(viewerRole)) {
        return forbiddenError(
          'Only the buyer or evaluator may decrypt this deliverable',
          'GET /api/deliverables/[id]',
          auth.wallet
        )
      }

      return NextResponse.json({
        deliverable: formatDeliverable(row, includePlaintext),
        viewerRole,
      })
    } catch (error: unknown) {
      const configError = handlePrivateA2aConfigError(error, 'GET /api/deliverables/[id]', auth.wallet)
      if (configError) return configError
      return databaseError('GET /api/deliverables/[id]', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const deliverable = devnetStore.getDeliverable(deliverableId)
  if (!deliverable) {
    return notFoundError('Deliverable', 'GET /api/deliverables/[id]', auth.wallet)
  }
  const viewerRole = assertViewerRole(
    auth.wallet,
    {
      buyerWallet: deliverable.buyer_wallet,
      creatorWallet: deliverable.creator_wallet,
      evaluatorWallet: deliverable.evaluator_wallet,
    },
    'GET /api/deliverables/[id]'
  )
  if (viewerRole instanceof NextResponse) return viewerRole
  if (includePlaintext && !canDecryptDeliverable(viewerRole)) {
    return forbiddenError(
      'Only the buyer or evaluator may decrypt this deliverable',
      'GET /api/deliverables/[id]',
      auth.wallet
    )
  }

  try {
    return NextResponse.json({
      deliverable: formatDevnetDeliverable(deliverable, includePlaintext),
      viewerRole,
    })
  } catch (error: unknown) {
    const configError = handlePrivateA2aConfigError(error, 'GET /api/deliverables/[id]', auth.wallet)
    if (configError) return configError
    throw error
  }
}

function formatDeliverable(row: Record<string, unknown>, includePlaintext: boolean) {
  const base = {
    deliverableId: String(row.deliverable_id),
    runId: String(row.run_id),
    threadId: String(row.thread_id),
    receiptId: String(row.receipt_id),
    creatorWallet: String(row.creator_wallet),
    buyerWallet: String(row.buyer_wallet),
    evaluatorWallet: (row.evaluator_wallet as string | null) ?? null,
    storageKind: String(row.storage_kind),
    ciphertext: String(row.ciphertext),
    ciphertextHash: String(row.ciphertext_hash),
    plaintextHash: String(row.plaintext_hash),
    nonce: String(row.nonce),
    encryptionScheme: String(row.encryption_scheme),
    accessPolicy: (row.access_policy_json as Record<string, unknown>) ?? {},
    status: String(row.status),
    createdAt: formatDbTimestamp(row.created_at),
    updatedAt: formatDbTimestamp(row.updated_at),
  }

  if (!includePlaintext) return base

  return {
    ...base,
    plaintext: decryptEnvelope({
      threadId: base.threadId,
      senderWallet: base.creatorWallet,
      recipientWallet: base.buyerWallet,
      messageType: 'delivery_notice',
      timestamp: base.createdAt,
      ciphertext: base.ciphertext,
      nonce: base.nonce,
    }),
  }
}

function formatDbTimestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

function formatDevnetDeliverable(
  deliverable: import('@/lib/db/devnet-store').DevnetDeliverable,
  includePlaintext: boolean
) {
  const base = {
    deliverableId: deliverable.deliverable_id,
    runId: deliverable.run_id,
    threadId: deliverable.thread_id,
    receiptId: deliverable.receipt_id,
    creatorWallet: deliverable.creator_wallet,
    buyerWallet: deliverable.buyer_wallet,
    evaluatorWallet: deliverable.evaluator_wallet,
    storageKind: deliverable.storage_kind,
    ciphertext: deliverable.ciphertext,
    ciphertextHash: deliverable.ciphertext_hash,
    plaintextHash: deliverable.plaintext_hash,
    nonce: deliverable.nonce,
    encryptionScheme: deliverable.encryption_scheme,
    accessPolicy: deliverable.access_policy_json,
    status: deliverable.status,
    createdAt: deliverable.created_at,
    updatedAt: deliverable.updated_at,
  }

  if (!includePlaintext) return base

  return {
    ...base,
    plaintext: decryptEnvelope({
      threadId: deliverable.thread_id,
      senderWallet: deliverable.creator_wallet,
      recipientWallet: deliverable.buyer_wallet,
      messageType: 'delivery_notice',
      timestamp: deliverable.created_at,
      ciphertext: deliverable.ciphertext,
      nonce: deliverable.nonce,
    }),
  }
}

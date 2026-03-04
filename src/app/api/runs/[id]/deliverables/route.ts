import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { databaseError, forbiddenError, notFoundError, validationError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import {
  assertViewerRole,
  buildPublicProofEnvelope,
  canDecryptDeliverable,
  decryptEnvelope,
  encryptEnvelope,
  generateDeliverableId,
  handlePrivateA2aConfigError,
  requirePrivateViewer,
} from '@/lib/private-a2a'
import { evaluateSafety } from '@/lib/safety/evaluate'

interface DeliverableBody {
  threadId?: string
  receiptId?: string
  evaluatorWallet?: string
  content?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePrivateViewer(request, 'GET /api/runs/[id]/deliverables')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const runId = id?.trim()
  if (!runId) return notFoundError('Run', 'GET /api/runs/[id]/deliverables', auth.wallet)

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
         WHERE run_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [runId]
      )
      if (result.rows.length === 0) {
        return notFoundError('Deliverable', 'GET /api/runs/[id]/deliverables', auth.wallet)
      }

      const row = result.rows[0] as Record<string, unknown>
      const viewerRole = assertViewerRole(
        auth.wallet,
        {
          buyerWallet: String(row.buyer_wallet),
          creatorWallet: String(row.creator_wallet),
          evaluatorWallet: (row.evaluator_wallet as string | null) ?? null,
        },
        'GET /api/runs/[id]/deliverables'
      )
      if (viewerRole instanceof NextResponse) return viewerRole
      if (includePlaintext && !canDecryptDeliverable(viewerRole)) {
        return forbiddenError(
          'Only the buyer or evaluator may decrypt this deliverable',
          'GET /api/runs/[id]/deliverables',
          auth.wallet
        )
      }

      return NextResponse.json({
        deliverable: formatDeliverableRow(row, includePlaintext),
        viewerRole,
      })
    } catch (error: unknown) {
      const configError = handlePrivateA2aConfigError(
        error,
        'GET /api/runs/[id]/deliverables',
        auth.wallet
      )
      if (configError) return configError
      return databaseError('GET /api/runs/[id]/deliverables', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const deliverable = devnetStore.getDeliverableByRunId(runId)
  if (!deliverable) {
    return notFoundError('Deliverable', 'GET /api/runs/[id]/deliverables', auth.wallet)
  }

  const viewerRole = assertViewerRole(
    auth.wallet,
    {
      buyerWallet: deliverable.buyer_wallet,
      creatorWallet: deliverable.creator_wallet,
      evaluatorWallet: deliverable.evaluator_wallet,
    },
    'GET /api/runs/[id]/deliverables'
  )
  if (viewerRole instanceof NextResponse) return viewerRole
  if (includePlaintext && !canDecryptDeliverable(viewerRole)) {
    return forbiddenError(
      'Only the buyer or evaluator may decrypt this deliverable',
      'GET /api/runs/[id]/deliverables',
      auth.wallet
    )
  }

  try {
    return NextResponse.json({
      deliverable: formatDevnetDeliverable(deliverable, includePlaintext),
      viewerRole,
    })
  } catch (error: unknown) {
    const configError = handlePrivateA2aConfigError(
      error,
      'GET /api/runs/[id]/deliverables',
      auth.wallet
    )
    if (configError) return configError
    throw error
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePrivateViewer(request, 'POST /api/runs/[id]/deliverables')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const runId = id?.trim()
  if (!runId) return notFoundError('Run', 'POST /api/runs/[id]/deliverables', auth.wallet)

  let body: DeliverableBody = {}
  try {
    body = await request.json()
  } catch {
    return validationError(
      'Request body must be valid JSON',
      'POST /api/runs/[id]/deliverables',
      auth.wallet
    )
  }

  const threadId = body.threadId?.trim()
  const content = body.content?.trim()
  if (!threadId) {
    return validationError('threadId is required', 'POST /api/runs/[id]/deliverables', auth.wallet)
  }
  if (!content) {
    return validationError('content is required', 'POST /api/runs/[id]/deliverables', auth.wallet)
  }
  const safety = evaluateSafety({ category: 'research', text: content })
  if (safety.decision === 'block') {
    return validationError(safety.safeLabel, 'POST /api/runs/[id]/deliverables', auth.wallet)
  }
  const publicSafety = {
    decision: safety.decision,
    category: safety.category,
    reasonCodes: safety.reasonCodes,
    safeLabel: safety.safeLabel,
  }

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      await client.query('BEGIN')

      const runResult = await client.query(
        `SELECT run_id, agent_id, agent_name, buyer_wallet, creator_wallet, status
         FROM runs
         WHERE run_id = $1
         FOR UPDATE`,
        [runId]
      )
      if (runResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return notFoundError('Run', 'POST /api/runs/[id]/deliverables', auth.wallet)
      }
      const run = runResult.rows[0] as {
        run_id: string
        agent_id: string
        agent_name: string
        buyer_wallet: string
        creator_wallet: string
        status: string
      }
      if (run.creator_wallet !== auth.wallet) {
        await client.query('ROLLBACK')
        return forbiddenError(
          'Only the creator may submit deliverables',
          'POST /api/runs/[id]/deliverables',
          auth.wallet
        )
      }
      if (run.status !== 'completed') {
        await client.query('ROLLBACK')
        return validationError(
          'Run must be completed before deliverable submission',
          'POST /api/runs/[id]/deliverables',
          auth.wallet
        )
      }

      const threadResult = await client.query(
        `SELECT thread_id, evaluator_wallet FROM private_threads WHERE thread_id = $1 AND run_id = $2`,
        [threadId, runId]
      )
      if (threadResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return notFoundError('Thread', 'POST /api/runs/[id]/deliverables', auth.wallet)
      }
      const evaluatorWallet =
        body.evaluatorWallet?.trim() ??
        ((threadResult.rows[0] as { evaluator_wallet: string | null }).evaluator_wallet ?? null)

      const receiptId = body.receiptId?.trim()
      const receiptResult = await client.query(
        `SELECT receipt_id, receipt_hash
         FROM receipts
         WHERE run_id = $1 ${receiptId ? 'AND receipt_id = $2' : ''}
         ORDER BY created_at DESC
         LIMIT 1`,
        receiptId ? [runId, receiptId] : [runId]
      )
      if (receiptResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return notFoundError('Receipt', 'POST /api/runs/[id]/deliverables', auth.wallet)
      }
      const receipt = receiptResult.rows[0] as { receipt_id: string; receipt_hash: string }

      const deliverableId = generateDeliverableId()
      const encrypted = encryptEnvelope({
        threadId,
        senderWallet: run.creator_wallet,
        recipientWallet: run.buyer_wallet,
        messageType: 'delivery_notice',
        content,
      })
      const messageCountResult = await client.query(
        `SELECT COUNT(*) AS total FROM private_messages WHERE thread_id = $1`,
        [threadId]
      )
      const messageCount = parseInt(String((messageCountResult.rows[0] as { total: string }).total), 10)

      await client.query(
        `INSERT INTO encrypted_deliverables
           (deliverable_id, run_id, thread_id, receipt_id, creator_wallet, buyer_wallet,
            evaluator_wallet, storage_kind, ciphertext, ciphertext_hash, plaintext_hash,
            nonce, encryption_scheme, access_policy_json, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'db',$8,$9,$10,$11,$12,$13,'submitted',$14,$14)`,
        [
          deliverableId,
          runId,
          threadId,
          receipt.receipt_id,
          run.creator_wallet,
          run.buyer_wallet,
          evaluatorWallet,
          encrypted.ciphertext,
          encrypted.ciphertextHash,
          encrypted.plaintextHash,
          encrypted.nonce,
          encrypted.encryptionScheme,
          JSON.stringify({
            buyerWallet: run.buyer_wallet,
            creatorWallet: run.creator_wallet,
            evaluatorWallet,
          }),
          encrypted.timestamp,
        ]
      )

      await client.query(
        `UPDATE receipts
         SET private_thread_id = $1,
             encrypted_deliverable_id = $2,
             encrypted_deliverable_hash = $3,
             message_count = $4,
             private_content_redacted = true,
             evaluator_attestation_status = $5,
             public_proof_envelope_json = $6
         WHERE receipt_id = $7`,
        [
          threadId,
          deliverableId,
          encrypted.ciphertextHash,
          messageCount,
          evaluatorWallet ? 'review_key_ready' : null,
          JSON.stringify(
            buildPublicProofEnvelope({
              threadId,
              deliverableId,
              encryptedDeliverableHash: encrypted.ciphertextHash,
              messageCount,
              status: 'submitted',
              receiptHash: receipt.receipt_hash,
              safety: publicSafety,
            })
          ),
          receipt.receipt_id,
        ]
      )

      await client.query(
        `UPDATE private_threads
         SET status = 'delivered', updated_at = $1
         WHERE thread_id = $2`,
        [encrypted.timestamp, threadId]
      )

      await client.query('COMMIT')
      return NextResponse.json(
        {
          deliverable: {
            deliverableId,
            runId,
            threadId,
            receiptId: receipt.receipt_id,
            status: 'submitted',
            ciphertextHash: encrypted.ciphertextHash,
            plaintextHash: encrypted.plaintextHash,
            encryptionScheme: encrypted.encryptionScheme,
            safety: publicSafety,
            createdAt: encrypted.timestamp,
          },
        },
        { status: 201 }
      )
    } catch (error: unknown) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      const configError = handlePrivateA2aConfigError(
        error,
        'POST /api/runs/[id]/deliverables',
        auth.wallet
      )
      if (configError) return configError
      return databaseError('POST /api/runs/[id]/deliverables', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const run = devnetStore.getRun(runId)
  if (!run) return notFoundError('Run', 'POST /api/runs/[id]/deliverables', auth.wallet)
  if (run.creator_wallet !== auth.wallet) {
    return forbiddenError(
      'Only the creator may submit deliverables',
      'POST /api/runs/[id]/deliverables',
      auth.wallet
    )
  }
  if (run.status !== 'completed') {
    return validationError(
      'Run must be completed before deliverable submission',
      'POST /api/runs/[id]/deliverables',
      auth.wallet
    )
  }

  const thread = devnetStore.getPrivateThread(threadId)
  if (!thread || thread.run_id !== runId) {
    return notFoundError('Thread', 'POST /api/runs/[id]/deliverables', auth.wallet)
  }
  const receipt =
    (body.receiptId?.trim() ? devnetStore.getReceipt(body.receiptId.trim()) : undefined) ??
    devnetStore.getReceiptByRunId(runId)
  if (!receipt) {
    return notFoundError('Receipt', 'POST /api/runs/[id]/deliverables', auth.wallet)
  }

  const deliverableId = generateDeliverableId()
  let encrypted: ReturnType<typeof encryptEnvelope>
  try {
    encrypted = encryptEnvelope({
      threadId,
      senderWallet: run.creator_wallet,
      recipientWallet: run.buyer_wallet,
      messageType: 'delivery_notice',
      content,
    })
  } catch (error: unknown) {
    const configError = handlePrivateA2aConfigError(
      error,
      'POST /api/runs/[id]/deliverables',
      auth.wallet
    )
    if (configError) return configError
    throw error
  }
  const messageCount = devnetStore.countPrivateMessages(threadId)
  devnetStore.createDeliverable({
    deliverable_id: deliverableId,
    run_id: runId,
    thread_id: threadId,
    receipt_id: receipt.receipt_id,
    creator_wallet: run.creator_wallet,
    buyer_wallet: run.buyer_wallet,
    evaluator_wallet: body.evaluatorWallet?.trim() ?? thread.evaluator_wallet,
    storage_kind: 'db',
    ciphertext: encrypted.ciphertext,
    ciphertext_hash: encrypted.ciphertextHash,
    plaintext_hash: encrypted.plaintextHash,
    nonce: encrypted.nonce,
    encryption_scheme: encrypted.encryptionScheme,
    access_policy_json: {
      buyerWallet: run.buyer_wallet,
      creatorWallet: run.creator_wallet,
      evaluatorWallet: body.evaluatorWallet?.trim() ?? thread.evaluator_wallet,
    },
    status: 'submitted',
    created_at: encrypted.timestamp,
    updated_at: encrypted.timestamp,
  })
  devnetStore.updateReceipt(receipt.receipt_id, {
    private_thread_id: threadId,
    encrypted_deliverable_id: deliverableId,
    encrypted_deliverable_hash: encrypted.ciphertextHash,
    message_count: messageCount,
    private_content_redacted: true,
    evaluator_attestation_status:
      body.evaluatorWallet?.trim() ?? thread.evaluator_wallet ? 'review_key_ready' : null,
    public_proof_envelope_json: buildPublicProofEnvelope({
      threadId,
      deliverableId,
      encryptedDeliverableHash: encrypted.ciphertextHash,
      messageCount,
      status: 'submitted',
      receiptHash: receipt.receipt_hash,
      safety: publicSafety,
    }),
  })
  devnetStore.updatePrivateThread(threadId, { status: 'delivered' })

  return NextResponse.json(
    {
      deliverable: {
        deliverableId,
        runId,
        threadId,
        receiptId: receipt.receipt_id,
        status: 'submitted',
        ciphertextHash: encrypted.ciphertextHash,
        plaintextHash: encrypted.plaintextHash,
        encryptionScheme: encrypted.encryptionScheme,
        safety: publicSafety,
        createdAt: encrypted.timestamp,
      },
    },
    { status: 201 }
  )
}

function formatDeliverableRow(row: Record<string, unknown>, includePlaintext: boolean) {
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

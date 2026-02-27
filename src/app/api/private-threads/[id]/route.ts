import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { databaseError, notFoundError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import {
  assertViewerRole,
  decryptEnvelope,
  handlePrivateA2aConfigError,
  requirePrivateViewer,
} from '@/lib/private-a2a'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePrivateViewer(request, 'GET /api/private-threads/[id]')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const threadId = id?.trim()
  if (!threadId) return notFoundError('Thread', 'GET /api/private-threads/[id]', auth.wallet)
  const includePlaintext = request.nextUrl.searchParams.get('decrypt') === 'true'

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const threadResult = await client.query(
        `SELECT thread_id, agent_id, run_id, buyer_wallet, creator_wallet, evaluator_wallet,
                status, public_subject_hash, last_message_at, created_at, updated_at
         FROM private_threads
         WHERE thread_id = $1`,
        [threadId]
      )
      if (threadResult.rows.length === 0) {
        return notFoundError('Thread', 'GET /api/private-threads/[id]', auth.wallet)
      }

      const thread = formatThreadRow(threadResult.rows[0] as Record<string, unknown>)
      const viewerRole = assertViewerRole(
        auth.wallet,
        {
          buyerWallet: thread.buyerWallet,
          creatorWallet: thread.creatorWallet,
          evaluatorWallet: thread.evaluatorWallet,
        },
        'GET /api/private-threads/[id]'
      )
      if (viewerRole instanceof NextResponse) return viewerRole

      const messageResult = await client.query(
        `SELECT message_id, thread_id, sender_wallet, recipient_wallet, message_type,
                envelope_version, ciphertext, ciphertext_hash, plaintext_hash, nonce,
                reply_to_message_id, encryption_scheme, created_at
         FROM private_messages
         WHERE thread_id = $1
         ORDER BY created_at ASC`,
        [threadId]
      )

      return NextResponse.json({
        thread: {
          ...thread,
          viewerRole,
          messageCount: messageResult.rows.length,
        },
        messages: messageResult.rows.map(row =>
          formatMessageRow(row as Record<string, unknown>, includePlaintext)
        ),
      })
    } catch (error: unknown) {
      const configError = handlePrivateA2aConfigError(error, 'GET /api/private-threads/[id]', auth.wallet)
      if (configError) return configError
      return databaseError('GET /api/private-threads/[id]', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const thread = devnetStore.getPrivateThread(threadId)
  if (!thread) return notFoundError('Thread', 'GET /api/private-threads/[id]', auth.wallet)

  const viewerRole = assertViewerRole(
    auth.wallet,
    {
      buyerWallet: thread.buyer_wallet,
      creatorWallet: thread.creator_wallet,
      evaluatorWallet: thread.evaluator_wallet,
    },
    'GET /api/private-threads/[id]'
  )
  if (viewerRole instanceof NextResponse) return viewerRole

  const messages = devnetStore.listPrivateMessages(threadId)
  try {
    return NextResponse.json({
      thread: {
        ...formatDevnetThread(thread),
        viewerRole,
        messageCount: messages.length,
      },
      messages: messages.map(message => formatDevnetMessage(message, includePlaintext)),
    })
  } catch (error: unknown) {
    const configError = handlePrivateA2aConfigError(error, 'GET /api/private-threads/[id]', auth.wallet)
    if (configError) return configError
    throw error
  }
}

function formatThreadRow(row: Record<string, unknown>) {
  return {
    threadId: String(row.thread_id),
    agentId: String(row.agent_id),
    runId: (row.run_id as string | null) ?? null,
    buyerWallet: String(row.buyer_wallet),
    creatorWallet: String(row.creator_wallet),
    evaluatorWallet: (row.evaluator_wallet as string | null) ?? null,
    status: String(row.status),
    publicSubjectHash: String(row.public_subject_hash),
    lastMessageAt: formatNullableDbTimestamp(row.last_message_at),
    createdAt: formatDbTimestamp(row.created_at),
    updatedAt: formatDbTimestamp(row.updated_at),
  }
}

function formatDevnetThread(thread: import('@/lib/db/devnet-store').DevnetPrivateThread) {
  return {
    threadId: thread.thread_id,
    agentId: thread.agent_id,
    runId: thread.run_id,
    buyerWallet: thread.buyer_wallet,
    creatorWallet: thread.creator_wallet,
    evaluatorWallet: thread.evaluator_wallet,
    status: thread.status,
    publicSubjectHash: thread.public_subject_hash,
    lastMessageAt: thread.last_message_at,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
  }
}

function formatMessageRow(row: Record<string, unknown>, includePlaintext: boolean) {
  const base = {
    messageId: String(row.message_id),
    threadId: String(row.thread_id),
    senderWallet: String(row.sender_wallet),
    recipientWallet: String(row.recipient_wallet),
    messageType: String(row.message_type),
    envelopeVersion: String(row.envelope_version),
    ciphertext: String(row.ciphertext),
    ciphertextHash: String(row.ciphertext_hash),
    plaintextHash: String(row.plaintext_hash),
    nonce: String(row.nonce),
    replyToMessageId: (row.reply_to_message_id as string | null) ?? null,
    encryptionScheme: String(row.encryption_scheme),
    createdAt: formatDbTimestamp(row.created_at),
  }

  if (!includePlaintext) return base

  return {
    ...base,
    plaintext: decryptEnvelope({
      threadId: base.threadId,
      senderWallet: base.senderWallet,
      recipientWallet: base.recipientWallet,
      messageType: base.messageType,
      timestamp: base.createdAt,
      ciphertext: base.ciphertext,
      nonce: base.nonce,
    }),
  }
}

function formatDbTimestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

function formatNullableDbTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return formatDbTimestamp(value)
}

function formatDevnetMessage(
  message: import('@/lib/db/devnet-store').DevnetPrivateMessage,
  includePlaintext: boolean
) {
  const base = {
    messageId: message.message_id,
    threadId: message.thread_id,
    senderWallet: message.sender_wallet,
    recipientWallet: message.recipient_wallet,
    messageType: message.message_type,
    envelopeVersion: message.envelope_version,
    ciphertext: message.ciphertext,
    ciphertextHash: message.ciphertext_hash,
    plaintextHash: message.plaintext_hash,
    nonce: message.nonce,
    replyToMessageId: message.reply_to_message_id,
    encryptionScheme: message.encryption_scheme,
    createdAt: message.created_at,
  }

  if (!includePlaintext) return base

  return {
    ...base,
    plaintext: decryptEnvelope({
      threadId: message.thread_id,
      senderWallet: message.sender_wallet,
      recipientWallet: message.recipient_wallet,
      messageType: message.message_type,
      timestamp: message.created_at,
      ciphertext: message.ciphertext,
      nonce: message.nonce,
    }),
  }
}

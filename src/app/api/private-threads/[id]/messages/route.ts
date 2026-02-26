import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { databaseError, notFoundError, validationError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import {
  PRIVATE_MESSAGE_TYPES,
  assertViewerRole,
  encryptEnvelope,
  generatePrivateMessageId,
  handlePrivateA2aConfigError,
  requirePrivateViewer,
  validateEnumValue,
} from '@/lib/private-a2a'

interface MessageBody {
  recipientWallet?: string
  messageType?: string
  content?: string
  replyToMessageId?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePrivateViewer(request, 'POST /api/private-threads/[id]/messages')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const threadId = id?.trim()
  if (!threadId) {
    return notFoundError('Thread', 'POST /api/private-threads/[id]/messages', auth.wallet)
  }

  let body: MessageBody = {}
  try {
    body = await request.json()
  } catch {
    return validationError(
      'Request body must be valid JSON',
      'POST /api/private-threads/[id]/messages',
      auth.wallet
    )
  }

  const content = body.content?.trim()
  const messageType = body.messageType?.trim() as
    | import('@/lib/private-a2a').PrivateMessageType
    | undefined
  if (!content) {
    return validationError(
      'content is required',
      'POST /api/private-threads/[id]/messages',
      auth.wallet
    )
  }
  if (!messageType) {
    return validationError(
      'messageType is required',
      'POST /api/private-threads/[id]/messages',
      auth.wallet
    )
  }
  const typeError = validateEnumValue(
    messageType,
    PRIVATE_MESSAGE_TYPES,
    'messageType',
    'POST /api/private-threads/[id]/messages',
    auth.wallet
  )
  if (typeError) return typeError

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const threadResult = await client.query(
        `SELECT thread_id, buyer_wallet, creator_wallet, evaluator_wallet
         FROM private_threads
         WHERE thread_id = $1`,
        [threadId]
      )
      if (threadResult.rows.length === 0) {
        return notFoundError('Thread', 'POST /api/private-threads/[id]/messages', auth.wallet)
      }

      const thread = threadResult.rows[0] as {
        thread_id: string
        buyer_wallet: string
        creator_wallet: string
        evaluator_wallet: string | null
      }
      const viewerRole = assertViewerRole(
        auth.wallet,
        {
          buyerWallet: thread.buyer_wallet,
          creatorWallet: thread.creator_wallet,
          evaluatorWallet: thread.evaluator_wallet,
        },
        'POST /api/private-threads/[id]/messages'
      )
      if (viewerRole instanceof NextResponse) return viewerRole

      const recipientWallet =
        body.recipientWallet?.trim() ||
        inferRecipientWallet(auth.wallet, thread.buyer_wallet, thread.creator_wallet, thread.evaluator_wallet)

      const envelope = encryptEnvelope({
        threadId,
        senderWallet: auth.wallet,
        recipientWallet,
        messageType,
        content,
      })
      const messageId = generatePrivateMessageId()
      const nextStatus = inferThreadStatus(messageType)
      await client.query(
        `INSERT INTO private_messages
           (message_id, thread_id, sender_wallet, recipient_wallet, message_type, envelope_version,
            ciphertext, ciphertext_hash, plaintext_hash, nonce, reply_to_message_id,
            encryption_scheme, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          messageId,
          threadId,
          auth.wallet,
          recipientWallet,
          messageType,
          envelope.envelopeVersion,
          envelope.ciphertext,
          envelope.ciphertextHash,
          envelope.plaintextHash,
          envelope.nonce,
          body.replyToMessageId?.trim() ?? null,
          envelope.encryptionScheme,
          envelope.timestamp,
        ]
      )
      await client.query(
        `UPDATE private_threads
         SET status = $1, last_message_at = $2, updated_at = $2
         WHERE thread_id = $3`,
        [nextStatus, envelope.timestamp, threadId]
      )

      return NextResponse.json(
        {
          message: {
            messageId,
            threadId,
            senderWallet: auth.wallet,
            recipientWallet,
            messageType,
            envelopeVersion: envelope.envelopeVersion,
            ciphertext: envelope.ciphertext,
            ciphertextHash: envelope.ciphertextHash,
            plaintextHash: envelope.plaintextHash,
            nonce: envelope.nonce,
            replyToMessageId: body.replyToMessageId?.trim() ?? null,
            encryptionScheme: envelope.encryptionScheme,
            createdAt: envelope.timestamp,
          },
          threadStatus: nextStatus,
          viewerRole,
        },
        { status: 201 }
      )
    } catch (error: unknown) {
      const configError = handlePrivateA2aConfigError(
        error,
        'POST /api/private-threads/[id]/messages',
        auth.wallet
      )
      if (configError) return configError
      return databaseError('POST /api/private-threads/[id]/messages', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const thread = devnetStore.getPrivateThread(threadId)
  if (!thread) {
    return notFoundError('Thread', 'POST /api/private-threads/[id]/messages', auth.wallet)
  }
  const viewerRole = assertViewerRole(
    auth.wallet,
    {
      buyerWallet: thread.buyer_wallet,
      creatorWallet: thread.creator_wallet,
      evaluatorWallet: thread.evaluator_wallet,
    },
    'POST /api/private-threads/[id]/messages'
  )
  if (viewerRole instanceof NextResponse) return viewerRole

  const recipientWallet =
    body.recipientWallet?.trim() ||
    inferRecipientWallet(auth.wallet, thread.buyer_wallet, thread.creator_wallet, thread.evaluator_wallet)
  let envelope: ReturnType<typeof encryptEnvelope>
  try {
    envelope = encryptEnvelope({
      threadId,
      senderWallet: auth.wallet,
      recipientWallet,
      messageType,
      content,
    })
  } catch (error: unknown) {
    const configError = handlePrivateA2aConfigError(
      error,
      'POST /api/private-threads/[id]/messages',
      auth.wallet
    )
    if (configError) return configError
    throw error
  }
  const messageId = generatePrivateMessageId()
  const nextStatus = inferThreadStatus(messageType)

  devnetStore.createPrivateMessage({
    message_id: messageId,
    thread_id: threadId,
    sender_wallet: auth.wallet,
    recipient_wallet: recipientWallet,
    message_type: messageType,
    envelope_version: envelope.envelopeVersion,
    ciphertext: envelope.ciphertext,
    ciphertext_hash: envelope.ciphertextHash,
    plaintext_hash: envelope.plaintextHash,
    nonce: envelope.nonce,
    reply_to_message_id: body.replyToMessageId?.trim() ?? null,
    encryption_scheme: envelope.encryptionScheme,
    created_at: envelope.timestamp,
  })
  devnetStore.updatePrivateThread(threadId, {
    status: nextStatus,
    last_message_at: envelope.timestamp,
  })

  return NextResponse.json(
    {
      message: {
        messageId,
        threadId,
        senderWallet: auth.wallet,
        recipientWallet,
        messageType,
        envelopeVersion: envelope.envelopeVersion,
        ciphertext: envelope.ciphertext,
        ciphertextHash: envelope.ciphertextHash,
        plaintextHash: envelope.plaintextHash,
        nonce: envelope.nonce,
        replyToMessageId: body.replyToMessageId?.trim() ?? null,
        encryptionScheme: envelope.encryptionScheme,
        createdAt: envelope.timestamp,
      },
      threadStatus: nextStatus,
      viewerRole,
    },
    { status: 201 }
  )
}

function inferRecipientWallet(
  senderWallet: string,
  buyerWallet: string,
  creatorWallet: string,
  evaluatorWallet: string | null
) {
  if (senderWallet === buyerWallet) return creatorWallet
  if (senderWallet === creatorWallet) return buyerWallet
  return evaluatorWallet ?? buyerWallet
}

function inferThreadStatus(messageType: string) {
  switch (messageType) {
    case 'quote_response':
      return 'quoted'
    case 'task_terms':
      return 'quoted'
    case 'terms_acceptance':
      return 'terms_accepted'
    case 'delivery_notice':
      return 'delivered'
    case 'dispute_note':
    case 'evaluator_note':
      return 'disputed'
    default:
      return 'open'
  }
}

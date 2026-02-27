import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import {
  databaseError,
  notFoundError,
  validationError,
} from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { KAIRO_AGENTS } from '@/lib/data/agents'
import {
  PRIVATE_MESSAGE_TYPES,
  PRIVATE_THREAD_STATUSES,
  encryptEnvelope,
  generatePrivateMessageId,
  generatePrivateThreadId,
  handlePrivateA2aConfigError,
  hashText,
  requirePrivateA2aEncryptionConfigured,
  requirePrivateViewer,
  resolveViewerRole,
  validateEnumValue,
} from '@/lib/private-a2a'

const DEVNET_CREATOR_FALLBACK = 'DevCreat0r1111111111111111111111111111111111'

interface CreateThreadBody {
  agentId?: string
  runId?: string
  creatorWallet?: string
  evaluatorWallet?: string
  publicSubject?: string
  initialMessage?: {
    recipientWallet?: string
    messageType?: string
    content?: string
    replyToMessageId?: string
  }
}

export async function POST(request: NextRequest) {
  const auth = requirePrivateViewer(request, 'POST /api/private-threads')
  if (auth instanceof NextResponse) return auth

  let body: CreateThreadBody = {}
  try {
    body = await request.json()
  } catch {
    return validationError('Request body must be valid JSON', 'POST /api/private-threads', auth.wallet)
  }

  const agentId = body.agentId?.trim()
  if (!agentId) {
    return validationError('agentId is required', 'POST /api/private-threads', auth.wallet)
  }

  const initialMessage = body.initialMessage
  const messageType =
    (initialMessage?.messageType?.trim() as
      | import('@/lib/private-a2a').PrivateMessageType
      | undefined) ?? 'quote_request'
  const typeError = validateEnumValue(
    messageType,
    PRIVATE_MESSAGE_TYPES,
    'messageType',
    'POST /api/private-threads',
    auth.wallet
  )
  if (typeError) return typeError

  const initialContent = initialMessage?.content?.trim()
  if (!initialContent) {
    return validationError(
      'initialMessage.content is required',
      'POST /api/private-threads',
      auth.wallet
    )
  }

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      await client.query('BEGIN')

      const agentResult = await client.query(
        `SELECT creator_wallet FROM agents WHERE agent_id = $1 AND active = true`,
        [agentId]
      )
      const staticAgent = KAIRO_AGENTS.find(agent => agent.id === agentId)
      if (agentResult.rows.length === 0 && !staticAgent) {
        await client.query('ROLLBACK')
        return notFoundError('Agent', 'POST /api/private-threads', auth.wallet)
      }

      const agentRow = agentResult.rows[0] as { creator_wallet: string | null } | undefined
      const creatorWallet =
        body.creatorWallet?.trim() ||
        agentRow?.creator_wallet?.trim() ||
        (staticAgent ? DEVNET_CREATOR_FALLBACK : '')

      if (!creatorWallet) {
        await client.query('ROLLBACK')
        return validationError(
          'creatorWallet is required for this agent',
          'POST /api/private-threads',
          auth.wallet
        )
      }

      const runId = body.runId?.trim() ?? null
      const existing = await client.query(
        `SELECT thread_id, agent_id, run_id, buyer_wallet, creator_wallet, evaluator_wallet, status,
                public_subject_hash, last_message_at, created_at, updated_at
         FROM private_threads
         WHERE agent_id = $1 AND buyer_wallet = $2 AND creator_wallet = $3
           AND (($4::text IS NULL AND run_id IS NULL) OR run_id = $4::text)
         ORDER BY created_at DESC
         LIMIT 1`,
        [agentId, auth.wallet, creatorWallet, runId]
      )

      let thread =
        existing.rows.length > 0 ? formatThreadRow(existing.rows[0] as Record<string, unknown>) : null

      if (!thread) {
        const threadId = generatePrivateThreadId()
        const now = new Date().toISOString()
        const publicSubjectHash = hashText(
          body.publicSubject?.trim() || `${agentId}|${auth.wallet}|${creatorWallet}|${runId ?? 'open'}`
        )
        const threadResult = await client.query(
          `INSERT INTO private_threads
             (thread_id, agent_id, run_id, buyer_wallet, creator_wallet, evaluator_wallet,
              status, public_subject_hash, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8,$8)
           RETURNING thread_id, agent_id, run_id, buyer_wallet, creator_wallet, evaluator_wallet,
                     status, public_subject_hash, last_message_at, created_at, updated_at`,
          [
            threadId,
            agentId,
            runId,
            auth.wallet,
            creatorWallet,
            body.evaluatorWallet?.trim() ?? null,
            publicSubjectHash,
            now,
          ]
        )
        thread = formatThreadRow(threadResult.rows[0] as Record<string, unknown>)
      }

      const recipientWallet = initialMessage?.recipientWallet?.trim() || thread.creatorWallet
      const envelope = encryptEnvelope({
        threadId: thread.threadId,
        senderWallet: auth.wallet,
        recipientWallet,
        messageType,
        content: initialContent,
      })
      const messageId = generatePrivateMessageId()

      await client.query(
        `INSERT INTO private_messages
           (message_id, thread_id, sender_wallet, recipient_wallet, message_type, envelope_version,
            ciphertext, ciphertext_hash, plaintext_hash, nonce, reply_to_message_id,
            encryption_scheme, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          messageId,
          thread.threadId,
          auth.wallet,
          recipientWallet,
          messageType,
          envelope.envelopeVersion,
          envelope.ciphertext,
          envelope.ciphertextHash,
          envelope.plaintextHash,
          envelope.nonce,
          initialMessage?.replyToMessageId?.trim() ?? null,
          envelope.encryptionScheme,
          envelope.timestamp,
        ]
      )

      const nextStatus = messageType === 'quote_request' ? 'open' : 'quoted'
      await client.query(
        `UPDATE private_threads
         SET status = $1, last_message_at = $2, updated_at = $2
         WHERE thread_id = $3`,
        [nextStatus, envelope.timestamp, thread.threadId]
      )

      const countResult = await client.query(
        `SELECT COUNT(*) AS total FROM private_messages WHERE thread_id = $1`,
        [thread.threadId]
      )
      await client.query('COMMIT')

      return NextResponse.json(
        {
          thread: {
            ...thread,
            status: nextStatus,
            lastMessageAt: envelope.timestamp,
            viewerRole: resolveViewerRole(auth.wallet, threadParticipants(thread)),
            messageCount: parseInt(String((countResult.rows[0] as { total: string }).total), 10),
          },
          message: formatMessageRecord({
            threadId: thread.threadId,
            messageId,
            senderWallet: auth.wallet,
            recipientWallet,
            messageType,
            envelopeVersion: envelope.envelopeVersion,
            ciphertext: envelope.ciphertext,
            ciphertextHash: envelope.ciphertextHash,
            plaintextHash: envelope.plaintextHash,
            nonce: envelope.nonce,
            encryptionScheme: envelope.encryptionScheme,
            createdAt: envelope.timestamp,
          }),
        },
        { status: existing.rows.length > 0 ? 200 : 201 }
      )
    } catch (error: unknown) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      const configError = handlePrivateA2aConfigError(error, 'POST /api/private-threads', auth.wallet)
      if (configError) return configError
      return databaseError('POST /api/private-threads', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const storedAgent = devnetStore.getAgent(agentId)
  const staticAgent = KAIRO_AGENTS.find(agent => agent.id === agentId)
  const creatorWallet =
    body.creatorWallet?.trim() ??
    storedAgent?.creator_wallet ??
    (staticAgent ? DEVNET_CREATOR_FALLBACK : '')

  if (!staticAgent && !storedAgent) {
    return notFoundError('Agent', 'POST /api/private-threads', auth.wallet)
  }
  if (!creatorWallet) {
    return validationError(
      'creatorWallet is required for this agent',
      'POST /api/private-threads',
      auth.wallet
    )
  }

  try {
    requirePrivateA2aEncryptionConfigured()
  } catch (error: unknown) {
    const configError = handlePrivateA2aConfigError(error, 'POST /api/private-threads', auth.wallet)
    if (configError) return configError
    throw error
  }

  const runId = body.runId?.trim() ?? null
  let thread = devnetStore.findPrivateThreadByParticipants({
    agentId,
    buyerWallet: auth.wallet,
    creatorWallet,
    runId,
  })

  if (!thread) {
    const now = new Date().toISOString()
    thread = devnetStore.createPrivateThread({
      thread_id: generatePrivateThreadId(),
      agent_id: agentId,
      run_id: runId,
      buyer_wallet: auth.wallet,
      creator_wallet: creatorWallet,
      evaluator_wallet: body.evaluatorWallet?.trim() ?? null,
      status: 'open',
      public_subject_hash: hashText(
        body.publicSubject?.trim() || `${agentId}|${auth.wallet}|${creatorWallet}|${runId ?? 'open'}`
      ),
      last_message_at: null,
      created_at: now,
      updated_at: now,
    })
  }

  const recipientWallet = initialMessage?.recipientWallet?.trim() || thread.creator_wallet
  let envelope: ReturnType<typeof encryptEnvelope>
  try {
    envelope = encryptEnvelope({
      threadId: thread.thread_id,
      senderWallet: auth.wallet,
      recipientWallet,
      messageType,
      content: initialContent,
    })
  } catch (error: unknown) {
    const configError = handlePrivateA2aConfigError(error, 'POST /api/private-threads', auth.wallet)
    if (configError) return configError
    throw error
  }
  const messageId = generatePrivateMessageId()
  devnetStore.createPrivateMessage({
    message_id: messageId,
    thread_id: thread.thread_id,
    sender_wallet: auth.wallet,
    recipient_wallet: recipientWallet,
    message_type: messageType,
    envelope_version: envelope.envelopeVersion,
    ciphertext: envelope.ciphertext,
    ciphertext_hash: envelope.ciphertextHash,
    plaintext_hash: envelope.plaintextHash,
    nonce: envelope.nonce,
    reply_to_message_id: initialMessage?.replyToMessageId?.trim() ?? null,
    encryption_scheme: envelope.encryptionScheme,
    created_at: envelope.timestamp,
  })

  const nextStatus = messageType === 'quote_request' ? 'open' : 'quoted'
  devnetStore.updatePrivateThread(thread.thread_id, {
    status: nextStatus,
    last_message_at: envelope.timestamp,
  })

  return NextResponse.json(
    {
      thread: {
        ...formatDevnetThread(thread),
        status: nextStatus,
        lastMessageAt: envelope.timestamp,
        viewerRole: resolveViewerRole(auth.wallet, threadParticipants(formatDevnetThread(thread))),
        messageCount: devnetStore.countPrivateMessages(thread.thread_id),
      },
      message: formatMessageRecord({
        threadId: thread.thread_id,
        messageId,
        senderWallet: auth.wallet,
        recipientWallet,
        messageType,
        envelopeVersion: envelope.envelopeVersion,
        ciphertext: envelope.ciphertext,
        ciphertextHash: envelope.ciphertextHash,
        plaintextHash: envelope.plaintextHash,
        nonce: envelope.nonce,
        encryptionScheme: envelope.encryptionScheme,
        createdAt: envelope.timestamp,
      }),
    },
    { status: 201 }
  )
}

export async function GET(request: NextRequest) {
  const auth = requirePrivateViewer(request, 'GET /api/private-threads')
  if (auth instanceof NextResponse) return auth

  const status = request.nextUrl.searchParams.get('status')?.trim()
  const role = request.nextUrl.searchParams.get('role')?.trim()
  if (status) {
    const statusError = validateEnumValue(
      status,
      PRIVATE_THREAD_STATUSES,
      'status',
      'GET /api/private-threads',
      auth.wallet
    )
    if (statusError) return statusError
  }

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const params: unknown[] = [auth.wallet]
      let where = `WHERE (t.buyer_wallet = $1 OR t.creator_wallet = $1 OR t.evaluator_wallet = $1)`
      let p = 1

      if (status) {
        p += 1
        params.push(status)
        where += ` AND t.status = $${p}`
      }
      if (role === 'buyer') where += ` AND t.buyer_wallet = $1`
      if (role === 'creator') where += ` AND t.creator_wallet = $1`
      if (role === 'evaluator') where += ` AND t.evaluator_wallet = $1`

      const result = await client.query(
        `SELECT t.thread_id, t.agent_id, t.run_id, t.buyer_wallet, t.creator_wallet, t.evaluator_wallet,
                t.status, t.public_subject_hash, t.last_message_at, t.created_at, t.updated_at,
                (SELECT COUNT(*) FROM private_messages pm WHERE pm.thread_id = t.thread_id) AS message_count
         FROM private_threads t
         ${where}
         ORDER BY COALESCE(t.last_message_at, t.created_at) DESC`,
        params
      )

      return NextResponse.json({
        threads: result.rows.map(row => {
          const thread = formatThreadRow(row as Record<string, unknown>)
          const viewerRole = resolveViewerRole(auth.wallet, threadParticipants(thread))
          return {
            ...thread,
            viewerRole,
            messageCount: parseInt(String((row as { message_count: string }).message_count), 10),
          }
        }),
      })
    } catch (error: unknown) {
      return databaseError('GET /api/private-threads', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const threads = devnetStore.listPrivateThreads({
    wallet: auth.wallet,
    role: role ?? undefined,
    status: status ?? undefined,
  })

  return NextResponse.json({
    threads: threads
      .map(thread => {
        const formatted = formatDevnetThread(thread)
        return {
          ...formatted,
          viewerRole: resolveViewerRole(auth.wallet, threadParticipants(formatted)),
          messageCount: devnetStore.countPrivateMessages(thread.thread_id),
        }
      })
      .sort(
        (left, right) =>
          new Date(right.lastMessageAt ?? right.createdAt).getTime() -
          new Date(left.lastMessageAt ?? left.createdAt).getTime()
      ),
  })
}

function threadParticipants(thread: {
  buyerWallet: string
  creatorWallet: string
  evaluatorWallet: string | null
}) {
  return {
    buyerWallet: thread.buyerWallet,
    creatorWallet: thread.creatorWallet,
    evaluatorWallet: thread.evaluatorWallet,
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
    lastMessageAt: (row.last_message_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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

function formatMessageRecord(input: {
  threadId: string
  messageId: string
  senderWallet: string
  recipientWallet: string
  messageType: string
  envelopeVersion: string
  ciphertext: string
  ciphertextHash: string
  plaintextHash: string
  nonce: string
  encryptionScheme: string
  createdAt: string
}) {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    senderWallet: input.senderWallet,
    recipientWallet: input.recipientWallet,
    messageType: input.messageType,
    envelopeVersion: input.envelopeVersion,
    ciphertext: input.ciphertext,
    ciphertextHash: input.ciphertextHash,
    plaintextHash: input.plaintextHash,
    nonce: input.nonce,
    encryptionScheme: input.encryptionScheme,
    createdAt: input.createdAt,
  }
}

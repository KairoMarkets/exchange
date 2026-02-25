import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { databaseError, notFoundError, validationError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import { KAIRO_AGENTS } from '@/lib/data/agents'
import { generateRunId, hashPayload } from '@/lib/receipt'
import {
  assertViewerRole,
  encryptEnvelope,
  generatePrivateMessageId,
  handlePrivateA2aConfigError,
  requirePrivateViewer,
} from '@/lib/private-a2a'

const DEVNET_CREATOR_FALLBACK = 'DevCreat0r1111111111111111111111111111111111'

interface AcceptTermsBody {
  amountSol?: number
  runPayload?: Record<string, unknown>
  acceptanceNote?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePrivateViewer(request, 'POST /api/private-threads/[id]/accept-terms')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const threadId = id?.trim()
  if (!threadId) {
    return notFoundError('Thread', 'POST /api/private-threads/[id]/accept-terms', auth.wallet)
  }

  let body: AcceptTermsBody = {}
  try {
    body = await request.json()
  } catch {
    return validationError(
      'Request body must be valid JSON',
      'POST /api/private-threads/[id]/accept-terms',
      auth.wallet
    )
  }

  const amountSol = body.amountSol
  if (!amountSol || amountSol <= 0) {
    return validationError(
      'amountSol must be a positive number',
      'POST /api/private-threads/[id]/accept-terms',
      auth.wallet
    )
  }

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      await client.query('BEGIN')

      const threadResult = await client.query(
        `SELECT thread_id, agent_id, run_id, buyer_wallet, creator_wallet, evaluator_wallet, status
         FROM private_threads
         WHERE thread_id = $1
         FOR UPDATE`,
        [threadId]
      )
      if (threadResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return notFoundError('Thread', 'POST /api/private-threads/[id]/accept-terms', auth.wallet)
      }
      const thread = threadResult.rows[0] as {
        thread_id: string
        agent_id: string
        run_id: string | null
        buyer_wallet: string
        creator_wallet: string
        evaluator_wallet: string | null
        status: string
      }
      const viewerRole = assertViewerRole(
        auth.wallet,
        {
          buyerWallet: thread.buyer_wallet,
          creatorWallet: thread.creator_wallet,
          evaluatorWallet: thread.evaluator_wallet,
        },
        'POST /api/private-threads/[id]/accept-terms'
      )
      if (viewerRole instanceof NextResponse) {
        await client.query('ROLLBACK')
        return viewerRole
      }
      if (viewerRole !== 'buyer') {
        await client.query('ROLLBACK')
        return validationError(
          'Only the buyer may accept terms',
          'POST /api/private-threads/[id]/accept-terms',
          auth.wallet
        )
      }

      const now = new Date().toISOString()
      const note = body.acceptanceNote?.trim() || 'Terms accepted'
      const envelope = encryptEnvelope({
        threadId,
        senderWallet: auth.wallet,
        recipientWallet: thread.creator_wallet,
        messageType: 'terms_acceptance',
        content: note,
        timestamp: now,
      })
      const messageId = generatePrivateMessageId()

      await client.query(
        `INSERT INTO private_messages
           (message_id, thread_id, sender_wallet, recipient_wallet, message_type, envelope_version,
            ciphertext, ciphertext_hash, plaintext_hash, nonce, reply_to_message_id,
            encryption_scheme, created_at)
         VALUES ($1,$2,$3,$4,'terms_acceptance',$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          messageId,
          threadId,
          auth.wallet,
          thread.creator_wallet,
          envelope.envelopeVersion,
          envelope.ciphertext,
          envelope.ciphertextHash,
          envelope.plaintextHash,
          envelope.nonce,
          null,
          envelope.encryptionScheme,
          now,
        ]
      )

      let runId = thread.run_id
      let runStatus = 'authorized'
      const payload = body.runPayload ?? {}
      const inputHash = hashPayload(payload)

      if (!runId) {
        const agentResult = await client.query(
          `SELECT name FROM agents WHERE agent_id = $1 AND active = true`,
          [thread.agent_id]
        )
        if (agentResult.rows.length === 0) {
          await client.query('ROLLBACK')
          return notFoundError('Agent', 'POST /api/private-threads/[id]/accept-terms', auth.wallet)
        }

        runId = generateRunId()
        await client.query(
          `INSERT INTO runs
             (run_id, agent_id, agent_name, buyer_wallet, creator_wallet, amount_sol,
              status, input_hash, payload, authorized_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'authorized',$7,$8,$9,$9,$9)`,
          [
            runId,
            thread.agent_id,
            String((agentResult.rows[0] as { name: string }).name),
            thread.buyer_wallet,
            thread.creator_wallet,
            amountSol,
            inputHash,
            JSON.stringify(payload),
            now,
          ]
        )
      } else {
        const runResult = await client.query(
          `SELECT status FROM runs WHERE run_id = $1 FOR UPDATE`,
          [runId]
        )
        if (runResult.rows.length === 0) {
          await client.query('ROLLBACK')
          return notFoundError('Run', 'POST /api/private-threads/[id]/accept-terms', auth.wallet)
        }
        runStatus = String((runResult.rows[0] as { status: string }).status)
        if (runStatus === 'pending') {
          runStatus = 'authorized'
          await client.query(
            `UPDATE runs
             SET status = 'authorized', amount_sol = $1, payload = $2, input_hash = $3,
                 authorized_at = $4, updated_at = $4
             WHERE run_id = $5`,
            [amountSol, JSON.stringify(payload), inputHash, now, runId]
          )
        }
      }

      await client.query(
        `UPDATE private_threads
         SET run_id = $1, status = 'terms_accepted', last_message_at = $2, updated_at = $2
         WHERE thread_id = $3`,
        [runId, now, threadId]
      )

      await client.query('COMMIT')
      return NextResponse.json({
        thread: { threadId, runId, status: 'terms_accepted', lastMessageAt: now },
        run: { runId, status: runStatus === 'pending' ? 'authorized' : runStatus },
        message: {
          messageId,
          messageType: 'terms_acceptance',
          ciphertextHash: envelope.ciphertextHash,
          createdAt: now,
        },
      })
    } catch (error: unknown) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      const configError = handlePrivateA2aConfigError(
        error,
        'POST /api/private-threads/[id]/accept-terms',
        auth.wallet
      )
      if (configError) return configError
      return databaseError('POST /api/private-threads/[id]/accept-terms', error, auth.wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  }

  const thread = devnetStore.getPrivateThread(threadId)
  if (!thread) {
    return notFoundError('Thread', 'POST /api/private-threads/[id]/accept-terms', auth.wallet)
  }
  const viewerRole = assertViewerRole(
    auth.wallet,
    {
      buyerWallet: thread.buyer_wallet,
      creatorWallet: thread.creator_wallet,
      evaluatorWallet: thread.evaluator_wallet,
    },
    'POST /api/private-threads/[id]/accept-terms'
  )
  if (viewerRole instanceof NextResponse) return viewerRole
  if (viewerRole !== 'buyer') {
    return validationError(
      'Only the buyer may accept terms',
      'POST /api/private-threads/[id]/accept-terms',
      auth.wallet
    )
  }

  const now = new Date().toISOString()
  const note = body.acceptanceNote?.trim() || 'Terms accepted'
  let envelope: ReturnType<typeof encryptEnvelope>
  try {
    envelope = encryptEnvelope({
      threadId,
      senderWallet: auth.wallet,
      recipientWallet: thread.creator_wallet,
      messageType: 'terms_acceptance',
      content: note,
      timestamp: now,
    })
  } catch (error: unknown) {
    const configError = handlePrivateA2aConfigError(
      error,
      'POST /api/private-threads/[id]/accept-terms',
      auth.wallet
    )
    if (configError) return configError
    throw error
  }
  const messageId = generatePrivateMessageId()
  devnetStore.createPrivateMessage({
    message_id: messageId,
    thread_id: threadId,
    sender_wallet: auth.wallet,
    recipient_wallet: thread.creator_wallet,
    message_type: 'terms_acceptance',
    envelope_version: envelope.envelopeVersion,
    ciphertext: envelope.ciphertext,
    ciphertext_hash: envelope.ciphertextHash,
    plaintext_hash: envelope.plaintextHash,
    nonce: envelope.nonce,
    reply_to_message_id: null,
    encryption_scheme: envelope.encryptionScheme,
    created_at: now,
  })

  const payload = body.runPayload ?? {}
  const inputHash = hashPayload(payload)
  let runId = thread.run_id
  let runStatus = 'authorized'
  if (!runId) {
    const storedAgent = devnetStore.getAgent(thread.agent_id)
    const staticAgent = KAIRO_AGENTS.find(agent => agent.id === thread.agent_id)
    const agentName = storedAgent?.name ?? staticAgent?.name
    const creatorWallet = storedAgent?.creator_wallet ?? thread.creator_wallet ?? DEVNET_CREATOR_FALLBACK
    if (!agentName) {
      return notFoundError('Agent', 'POST /api/private-threads/[id]/accept-terms', auth.wallet)
    }

    runId = generateRunId()
    devnetStore.createRun({
      run_id: runId,
      agent_id: thread.agent_id,
      agent_name: agentName,
      buyer_wallet: thread.buyer_wallet,
      creator_wallet: creatorWallet,
      amount_sol: String(amountSol),
      status: 'authorized',
      input_hash: inputHash,
      result_hash: null,
      summary: null,
      payload,
      result: {},
      authorized_at: now,
      started_at: null,
      completed_at: null,
      disputed_at: null,
      created_at: now,
      updated_at: now,
    })
  } else {
    const run = devnetStore.getRun(runId)
    if (!run) {
      return notFoundError('Run', 'POST /api/private-threads/[id]/accept-terms', auth.wallet)
    }
    runStatus = run.status
    if (run.status === 'pending') {
      runStatus = 'authorized'
      devnetStore.updateRun(runId, {
        status: 'authorized',
        amount_sol: String(amountSol),
        input_hash: inputHash,
        payload,
        authorized_at: now,
      })
    }
  }

  devnetStore.updatePrivateThread(threadId, {
    run_id: runId,
    status: 'terms_accepted',
    last_message_at: now,
  })

  return NextResponse.json({
    thread: { threadId, runId, status: 'terms_accepted', lastMessageAt: now },
    run: { runId, status: runStatus === 'pending' ? 'authorized' : runStatus },
    message: {
      messageId,
      messageType: 'terms_acceptance',
      ciphertextHash: envelope.ciphertextHash,
      createdAt: now,
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import {
  verifyWalletSignature,
  generateSessionToken,
  buildSignMessage,
  verifySignedNonce,
  isServerConfigError,
} from '@/lib/auth'
import { validationError, unauthorizedError, databaseError, serverConfigError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'

interface VerifyBody {
  wallet?: string
  nonce?: string
  signature?: string // base64-encoded ed25519 signature bytes from wallet.signMessage()
}

interface ProfileRow {
  wallet_address: string
  username: string | null
  bio: string | null
  avatar_url: string | null
  roles: string[]
  created_at: string
  updated_at: string
}

/**
 * POST /api/auth/verify
 * Body: { wallet: string, nonce: string, signature: string (base64) }
 *
 * Verifies the ed25519 signature over the challenge message.
 * On success: marks nonce used, upserts profile, returns session token.
 *
 * Response: { token: string, profile: ProfileRow }
 */
export async function POST(request: NextRequest) {
  let body: VerifyBody = {}
  try {
    body = await request.json()
  } catch {
    return validationError('Request body must be valid JSON', 'POST /api/auth/verify')
  }

  const wallet = body.wallet?.trim()
  const nonce = body.nonce?.trim()
  const signature = body.signature?.trim()

  if (!wallet) return validationError('wallet is required', 'POST /api/auth/verify')
  if (!nonce) return validationError('nonce is required', 'POST /api/auth/verify')
  if (!signature) return validationError('signature is required', 'POST /api/auth/verify')

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()

      // Look up the nonce record
      const nonceResult = await client.query<{
        id: number
        message: string
        expires_at: string
        used: boolean
      }>(
        `SELECT id, message, expires_at, used
         FROM auth_nonces
         WHERE wallet_address = $1 AND nonce = $2
         ORDER BY created_at DESC LIMIT 1`,
        [wallet, nonce]
      )

      if (nonceResult.rows.length === 0) {
        return unauthorizedError('Invalid or expired nonce', 'POST /api/auth/verify', wallet)
      }

      const nonceRow = nonceResult.rows[0]
      if (nonceRow.used) {
        return unauthorizedError('Nonce already used', 'POST /api/auth/verify', wallet)
      }
      if (new Date(nonceRow.expires_at) < new Date()) {
        return unauthorizedError('Nonce expired', 'POST /api/auth/verify', wallet)
      }

      // Verify ed25519 signature over the challenge message
      const expectedMessage = buildSignMessage(wallet, nonce)
      const isValid = await verifyWalletSignature(wallet, expectedMessage, signature)
      if (!isValid) {
        return unauthorizedError('Signature verification failed', 'POST /api/auth/verify', wallet)
      }

      // Mark nonce as used (prevent replay)
      await client.query('UPDATE auth_nonces SET used = true WHERE id = $1', [nonceRow.id])

      // Upsert profile
      const profileResult = await client.query<ProfileRow>(
        `INSERT INTO profiles (wallet_address, roles)
         VALUES ($1, ARRAY['buyer'])
         ON CONFLICT (wallet_address)
         DO UPDATE SET updated_at = now()
         RETURNING wallet_address, username, bio, avatar_url, roles, created_at, updated_at`,
        [wallet]
      )
      const profile = profileResult.rows[0]
      const token = generateSessionToken(wallet)

      return NextResponse.json({ token, profile })
    } catch (error: unknown) {
      if (isServerConfigError(error)) {
        return serverConfigError(error.message, 'POST /api/auth/verify', wallet)
      }
      return databaseError('POST /api/auth/verify', error, wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    // Devnet store fallback. On Vercel without Postgres, nonce and verify can land
    // on different serverless instances, so accept signed stateless nonce challenges
    //  /api/auth/nonce when the file-backed record is unavailable.
    const nonceRecord = devnetStore.findNonce(wallet, nonce)
    let hasValidNonce = Boolean(nonceRecord)

    if (!hasValidNonce && process.env.VERCEL) {
      try {
        hasValidNonce = verifySignedNonce(wallet, nonce)
      } catch (error: unknown) {
        if (isServerConfigError(error)) {
          return serverConfigError(error.message, 'POST /api/auth/verify', wallet)
        }
        throw error
      }
    }

    if (!hasValidNonce) {
      return unauthorizedError('Invalid or expired nonce', 'POST /api/auth/verify', wallet)
    }

    const expectedMessage = buildSignMessage(wallet, nonce)
    const isValid = await verifyWalletSignature(wallet, expectedMessage, signature)
    if (!isValid) {
      return unauthorizedError('Signature verification failed', 'POST /api/auth/verify', wallet)
    }

    if (nonceRecord) {
      devnetStore.markNonceUsed(nonceRecord.id)
    }
    const profile = devnetStore.upsertProfile(wallet, {})
    let token: string
    try {
      token = generateSessionToken(wallet)
    } catch (error: unknown) {
      if (isServerConfigError(error)) {
        return serverConfigError(error.message, 'POST /api/auth/verify', wallet)
      }
      throw error
    }

    return NextResponse.json({ token, profile })
  }
}

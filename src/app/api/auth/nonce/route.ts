import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import {
  generateNonce,
  generateSignedNonce,
  nonceExpiresAt,
  buildSignMessage,
  isServerConfigError,
} from '@/lib/auth'
import { validationError, databaseError, serverConfigError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'

/**
 * POST /api/auth/nonce
 * Body: { wallet: string }
 *
 * Generates a one-time nonce challenge for the wallet to sign.
 * The nonce expires in 5 minutes and is single-use.
 *
 * Response: { nonce: string, message: string, expiresAt: string }
 */
export async function POST(request: NextRequest) {
  let body: { wallet?: string } = {}
  try {
    body = await request.json()
  } catch {
    return validationError('Request body must be valid JSON', 'POST /api/auth/nonce')
  }

  const wallet = body.wallet?.trim()
  if (!wallet) {
    return validationError('wallet is required', 'POST /api/auth/nonce')
  }

  // Basic Solana address sanity: base58, 32–44 chars
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return validationError('wallet must be a valid Solana base58 address', 'POST /api/auth/nonce')
  }

  const expiresAt = nonceExpiresAt()
  let nonce = generateNonce()

  if (!shouldUsePostgres() && process.env.VERCEL) {
    try {
      nonce = generateSignedNonce(wallet, expiresAt)
    } catch (error: unknown) {
      if (isServerConfigError(error)) {
        return serverConfigError(error.message, 'POST /api/auth/nonce', wallet)
      }
      throw error
    }
  }

  const message = buildSignMessage(wallet, nonce)

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      await client.query(
        `INSERT INTO auth_nonces (wallet_address, nonce, message, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [wallet, nonce, message, expiresAt.toISOString()]
      )
      return NextResponse.json({ nonce, message, expiresAt: expiresAt.toISOString() })
    } catch (error: unknown) {
      return databaseError('POST /api/auth/nonce', error, wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    // Devnet file-based store fallback
    devnetStore.createNonce({
      wallet_address: wallet,
      nonce,
      message,
      used: false,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    })
    return NextResponse.json({ nonce, message, expiresAt: expiresAt.toISOString() })
  }
}

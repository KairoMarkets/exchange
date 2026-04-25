import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { forbiddenError, serverConfigError, unauthorizedError } from '@/lib/api-error'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const NONCE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export class ServerConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerConfigError'
  }
}

export function isServerConfigError(error: unknown): error is ServerConfigError {
  return error instanceof ServerConfigError
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim()
  if (!secret) {
    throw new ServerConfigError('Session authentication is not configured')
  }
  return secret
}

export function generateNonce(): string {
  return randomBytes(32).toString('hex')
}

export function nonceExpiresAt(): Date {
  return new Date(Date.now() + NONCE_TTL_MS)
}

export function generateSignedNonce(wallet: string, expiresAt = nonceExpiresAt()): string {
  const payload = {
    wallet,
    exp: expiresAt.getTime(),
    salt: randomBytes(16).toString('hex'),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('hex')
  return `v1.${encodedPayload}.${sig}`
}

export function verifySignedNonce(wallet: string, nonce: string): boolean {
  try {
    const parts = nonce.split('.')
    if (parts.length !== 3 || parts[0] !== 'v1') return false

    const encodedPayload = parts[1]
    const sig = parts[2]
    const expected = createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expectedBuf.length) return false
    if (!timingSafeEqual(sigBuf, expectedBuf)) return false

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      wallet?: string
      exp?: number
    }
    if (payload.wallet !== wallet) return false
    if (!payload.exp || payload.exp < Date.now()) return false
    return true
  } catch {
    return false
  }
}

export function buildSignMessage(wallet: string, nonce: string): string {
  return (
    `Kairo Authentication\n\n` +
    `Wallet: ${wallet}\n` +
    `Nonce: ${nonce}\n\n` +
    `By signing this message you confirm wallet ownership. ` +
    `This request will not trigger a blockchain transaction or cost any fees.`
  )
}

/**
 * Verify an ed25519 wallet signature using the Web Crypto API (Node.js 18+).
 * The client should pass the signature as base64-encoded bytes.
 * Phantom wallet's signMessage returns a Uint8Array — encode as base64 before sending.
 */
export async function verifyWalletSignature(
  wallet: string,
  message: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    // Buffer.from ensures a regular ArrayBuffer backing (required by Web Crypto importKey)
    const publicKeyBytes = Buffer.from(new PublicKey(wallet).toBytes())
    const signatureBytes = Buffer.from(signatureBase64, 'base64')
    const messageBytes = new TextEncoder().encode(message)

    const key = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      // Ed25519 is supported in Node.js 18+ Web Crypto API
      { name: 'Ed25519' } as AlgorithmIdentifier,
      false,
      ['verify']
    )
    return await crypto.subtle.verify(
      'Ed25519' as AlgorithmIdentifier,
      key,
      signatureBytes,
      messageBytes
    )
  } catch {
    return false
  }
}

/**
 * Generate an HMAC-SHA256 session token encoding the wallet address.
 * No external JWT library required — uses Node.js crypto only.
 * Format (base64url): wallet|timestamp|salt|hmac
 */
export function generateSessionToken(wallet: string): string {
  const ts = Date.now().toString()
  const salt = randomBytes(8).toString('hex')
  const payload = `${wallet}|${ts}|${salt}`
  const sig = createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`).toString('base64url')
}

/**
 * Verify a session token and return the embedded wallet address, or null if
 * the token is invalid, tampered with, or expired.
 */
export function verifySessionToken(token: string): string | null {
  const sessionSecret = getSessionSecret()
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    // Format: wallet|timestamp|salt|sig — wallet may itself contain |? No — base58 has no |.
    const lastPipe = decoded.lastIndexOf('|')
    if (lastPipe === -1) return null
    const payload = decoded.slice(0, lastPipe)
    const sig = decoded.slice(lastPipe + 1)
    const expected = createHmac('sha256', sessionSecret).update(payload).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null
    const parts = payload.split('|')
    // parts: [wallet, timestamp, salt]
    if (parts.length < 3) return null
    const wallet = parts[0]
    const ts = parts[1]
    if (Date.now() - parseInt(ts, 10) > TOKEN_TTL_MS) return null
    return wallet
  } catch {
    return null
  }
}

export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

export function requireAuthenticatedWallet(
  request: NextRequest,
  endpoint: string
): { wallet: string } | NextResponse {
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) {
    return unauthorizedError('Authorization header with Bearer token required', endpoint)
  }

  try {
    const wallet = verifySessionToken(token)
    if (!wallet) {
      return unauthorizedError('Invalid or expired session token', endpoint)
    }

    return { wallet }
  } catch (error: unknown) {
    if (isServerConfigError(error)) {
      return serverConfigError(error.message, endpoint)
    }
    throw error
  }
}

export function requireMatchingWalletHint(
  authenticatedWallet: string,
  hintedWallet: string | undefined,
  fieldName: string,
  endpoint: string
): NextResponse | null {
  const normalizedHint = hintedWallet?.trim()
  if (!normalizedHint) return null
  if (normalizedHint !== authenticatedWallet) {
    return forbiddenError(
      `${fieldName} must match the authenticated wallet`,
      endpoint,
      authenticatedWallet
    )
  }
  return null
}

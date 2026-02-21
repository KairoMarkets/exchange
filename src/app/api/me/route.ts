import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { requireAuthenticatedWallet } from '@/lib/auth'
import { notFoundError, databaseError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'

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
 * GET /api/me
 * Header: Authorization: Bearer <token>
 *
 * Returns the authenticated wallet's profile.
 * Response: { profile: ProfileRow }
 */
export async function GET(request: NextRequest) {
  const auth = requireAuthenticatedWallet(request, 'GET /api/me')
  if (auth instanceof NextResponse) return auth
  const wallet = auth.wallet

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const result = await client.query<ProfileRow>(
        `SELECT wallet_address, username, bio, avatar_url, roles, created_at, updated_at
         FROM profiles
         WHERE wallet_address = $1`,
        [wallet]
      )
      if (result.rows.length === 0) {
        return notFoundError('Profile', 'GET /api/me', wallet)
      }
      return NextResponse.json({ profile: result.rows[0] })
    } catch (error: unknown) {
      return databaseError('GET /api/me', error, wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const profile = devnetStore.getProfile(wallet) ?? (process.env.VERCEL ? devnetStore.upsertProfile(wallet, {}) : undefined)
    if (!profile) {
      return notFoundError('Profile', 'GET /api/me', wallet)
    }
    return NextResponse.json({ profile })
  }
}

/**
 * PATCH /api/me
 * Header: Authorization: Bearer <token>
 * Body: { username?: string, bio?: string, avatar_url?: string }
 *
 * Updates the authenticated wallet's profile fields.
 * Response: { profile: ProfileRow }
 */
export async function PATCH(request: NextRequest) {
  const auth = requireAuthenticatedWallet(request, 'PATCH /api/me')
  if (auth instanceof NextResponse) return auth
  const wallet = auth.wallet

  let body: { username?: string; bio?: string; avatar_url?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  // Sanitize string fields — no SQL injection risk because we use parameterized queries,
  // but trim to avoid accidental whitespace-only updates.
  const username = body.username?.trim() ?? undefined
  const bio = body.bio?.trim() ?? undefined
  const avatarUrl = body.avatar_url?.trim() ?? undefined

  if (shouldUsePostgres()) {
    const pool = createPool()
    let client
    try {
      client = await pool.connect()
      const result = await client.query<ProfileRow>(
        `INSERT INTO profiles (wallet_address, username, bio, avatar_url, roles)
         VALUES ($1, $2, $3, $4, ARRAY['buyer'])
         ON CONFLICT (wallet_address)
         DO UPDATE SET
           username   = COALESCE($2, profiles.username),
           bio        = COALESCE($3, profiles.bio),
           avatar_url = COALESCE($4, profiles.avatar_url),
           updated_at = now()
         RETURNING wallet_address, username, bio, avatar_url, roles, created_at, updated_at`,
        [wallet, username ?? null, bio ?? null, avatarUrl ?? null]
      )
      return NextResponse.json({ profile: result.rows[0] })
    } catch (error: unknown) {
      return databaseError('PATCH /api/me', error, wallet)
    } finally {
      if (client) client.release()
      await pool.end()
    }
  } else {
    const profile = devnetStore.upsertProfile(wallet, {
      ...(username !== undefined && { username }),
      ...(bio !== undefined && { bio }),
      ...(avatarUrl !== undefined && { avatar_url: avatarUrl }),
    })
    return NextResponse.json({ profile })
  }
}

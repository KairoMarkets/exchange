import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedWallet } from '@/lib/auth'
import { forbiddenError, validationError, databaseError } from '@/lib/api-error'
import { devnetStore, shouldUsePostgres } from '@/lib/db/devnet-store'
import {
  getBuyerDashboard,
  getCreatorDashboard,
  getOperatorDashboard,
} from '@/lib/dashboard'
import { createPool } from '@/lib/db'

const VALID_ROLES = ['buyer', 'creator', 'operator'] as const
type DashboardRole = (typeof VALID_ROLES)[number]

/**
 * GET /api/dashboard?role=buyer|creator|operator
 *
 * Returns the role-specific dashboard payload for the authenticated wallet.
 *
 * Role requirements:
 *   - buyer / creator: any authenticated wallet (data limited to their own records)
 *   - operator: wallet must have `operator` in profile roles
 *
 * Body wallet fields are NOT accepted as auth — session token is authoritative.
 *
 * Response shapes:
 *   - buyer:    { data: BuyerDashboard }
 *   - creator:  { data: CreatorDashboard }
 *   - operator: { data: OperatorDashboard }
 */
export async function GET(request: NextRequest) {
  const auth = requireAuthenticatedWallet(request, 'GET /api/dashboard')
  if (auth instanceof NextResponse) return auth
  const wallet = auth.wallet

  const sp = request.nextUrl.searchParams
  const roleParam = sp.get('role')?.toLowerCase()

  if (!roleParam || !VALID_ROLES.includes(roleParam as DashboardRole)) {
    return validationError(
      `role query parameter is required and must be one of: ${VALID_ROLES.join(', ')}`,
      'GET /api/dashboard',
      wallet
    )
  }

  const role = roleParam as DashboardRole

  if (role === 'operator') {
    const hasOperatorRole = await checkOperatorRole(wallet)
    if (!hasOperatorRole) {
      return forbiddenError(
        'Operator role required to access Market Control',
        'GET /api/dashboard',
        wallet
      )
    }
  }

  try {
    switch (role) {
      case 'buyer': {
        const data = await getBuyerDashboard(wallet)
        return NextResponse.json({ data })
      }
      case 'creator': {
        const data = await getCreatorDashboard(wallet)
        return NextResponse.json({ data })
      }
      case 'operator': {
        const data = await getOperatorDashboard(wallet)
        return NextResponse.json({ data })
      }
    }
  } catch (error: unknown) {
    return databaseError('GET /api/dashboard', error, wallet)
  }
}

async function checkOperatorRole(wallet: string): Promise<boolean> {
  if (!shouldUsePostgres()) {
    const profile = devnetStore.getProfile(wallet)
    if (!profile) return false
    return profile.roles.includes('operator')
  }

  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT roles FROM profiles WHERE wallet_address = $1`,
      [wallet]
    )
    if (result.rows.length === 0) return false
    const row = result.rows[0] as { roles: string[] }
    return Array.isArray(row.roles) && row.roles.includes('operator')
  } catch {
    return false
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

import { NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { shouldUsePostgres } from '@/lib/db/devnet-store'
import { featureFlagSnapshot } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface CheckResult {
  status: 'ok' | 'skipped' | 'degraded'
  detail?: string
}

export async function GET() {
  const [database, devnetRpc] = await Promise.all([checkDatabase(), checkDevnetRpc()])
  const health = {
    status: database.status === 'degraded' || devnetRpc.status === 'degraded' ? 'degraded' : 'ok',
    version: process.env.npm_package_version ?? '0.1.0',
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.KAIRO_COMMIT_SHA ?? 'local',
    featureFlags: featureFlagSnapshot(),
    checks: {
      database,
      devnetRpc,
    },
    checkedAt: new Date().toISOString(),
  }

  logger.info('Health check completed', {
    route: 'GET /api/health',
    event: 'health.check',
    status: health.status,
  })

  return NextResponse.json(health, { status: health.status === 'ok' ? 200 : 200 })
}

async function checkDatabase(): Promise<CheckResult> {
  if (!shouldUsePostgres()) return { status: 'skipped', detail: 'local file store active' }
  const pool = createPool()
  let client
  try {
    client = await pool.connect()
    await client.query('SELECT 1')
    return { status: 'ok' }
  } catch {
    return { status: 'degraded', detail: 'database connection failed' }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

async function checkDevnetRpc(): Promise<CheckResult> {
  const rpcUrl = process.env.KAIRO_DEVNET_RPC_URL?.trim()
  if (!rpcUrl) return { status: 'skipped', detail: 'KAIRO_DEVNET_RPC_URL not configured' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'kairo-health', method: 'getHealth' }),
      signal: controller.signal,
    })
    if (!response.ok) return { status: 'degraded', detail: `rpc status ${response.status}` }
    return { status: 'ok' }
  } catch {
    return { status: 'degraded', detail: 'devnet rpc check failed' }
  } finally {
    clearTimeout(timeout)
  }
}

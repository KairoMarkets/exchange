import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { 
  validationError, 
  serviceUnavailableError, 
  databaseError, 
  isFetchError 
} from '@/lib/api-error'

// Kairo Trust Auditor backend URL (FastAPI service)
const SECURITY_AI_URL = process.env.SECURITY_AI_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  const pool = createPool({ max: 5 })
  let client
  const startTime = Date.now()
  let body: any

  try {
    body = await request.json()
    const { transaction, userWallet } = body

    // Validation
    if (!transaction) {
      return validationError('Transaction data is required', 'POST /api/security/scan', userWallet)
    }

    // Forward request to Kairo Trust Auditor backend
    const scanResponse = await fetch(`${SECURITY_AI_URL}/api/security/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction,
        user_wallet: userWallet,
      }),
    })

    if (!scanResponse.ok) {
      const errorData = await scanResponse.json().catch(() => ({}))
      return NextResponse.json(
        { 
          error: 'Kairo Trust Auditor scan failed', 
          details: errorData.error || 'Analysis service returned an error' 
        },
        { status: scanResponse.status }
      )
    }

    const scanResult = await scanResponse.json()
    const scanTimeMs = Date.now() - startTime

    // OPTIMIZED: Save scan to database with proper indexing
    client = await pool.connect()
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    await client.query(
      `INSERT INTO security_scans 
       (scan_id, user_wallet, transaction_hash, risk_level, risk_score, scan_time_ms, confidence, threats_detected)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        scanId,
        userWallet || null,
        scanResult.transaction_hash || null,
        scanResult.risk_level,
        scanResult.risk_score,
        scanTimeMs,
        scanResult.confidence || 0,
        JSON.stringify(scanResult.threats_detected || []),
      ]
    )

    return NextResponse.json({
      success: true,
      scanId,
      riskLevel: scanResult.risk_level,
      riskScore: scanResult.risk_score,
      explanation: scanResult.explanation,
      recommendation: scanResult.recommendation,
      details: scanResult.details,
      scanTimeMs,
      confidence: scanResult.confidence,
      threatsDetected: scanResult.threats_detected || [],
    })
  } catch (error: unknown) {
    // If Kairo Trust Auditor is unavailable, return graceful error
    if (isFetchError(error)) {
      return serviceUnavailableError('Kairo Trust Auditor', 'POST /api/security/scan', body?.userWallet)
    }

    return databaseError('POST /api/security/scan', error, body?.userWallet)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

export async function GET(request: NextRequest) {
  const pool = createPool({ max: 5 })
  let client

  try {
    const searchParams = request.nextUrl.searchParams
    const userWallet = searchParams.get('userWallet')
    const riskLevel = searchParams.get('riskLevel')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const offset = (page - 1) * limit

    client = await pool.connect()

    // OPTIMIZED: Uses composite indexes idx_scans_user_risk_created, idx_scans_risk_created
    let query = `
      SELECT 
        scan_id, user_wallet, transaction_hash, risk_level, risk_score,
        scan_time_ms, confidence, threats_detected, created_at
      FROM security_scans
      WHERE 1=1
    `

    const params: any[] = []

    if (userWallet) {
      params.push(userWallet)
      query += ` AND user_wallet = $${params.length}`
    }

    if (riskLevel) {
      params.push(riskLevel.toUpperCase())
      query += ` AND risk_level = $${params.length}`
    }

    // OPTIMIZED: Fixed parameter placeholders
    params.push(limit, offset)
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

    const result = await client.query(query, params)

    // OPTIMIZED: Separate count query
    let countQuery = 'SELECT COUNT(*) as total FROM security_scans WHERE 1=1'
    const countParams: any[] = []

    if (userWallet) {
      countParams.push(userWallet)
      countQuery += ` AND user_wallet = $${countParams.length}`
    }
    if (riskLevel) {
      countParams.push(riskLevel.toUpperCase())
      countQuery += ` AND risk_level = $${countParams.length}`
    }

    const countResult = await client.query(countQuery, countParams)
    const total = parseInt((countResult.rows[0] as any).total)

    // OPTIMIZED: Statistics query - consider caching this for 5-10 minutes
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total_scans,
        COUNT(CASE WHEN risk_level = 'DANGER' THEN 1 END) as threats_blocked,
        AVG(scan_time_ms)::int as avg_scan_time,
        COUNT(DISTINCT user_wallet) as users_protected
      FROM security_scans
    `)

    const stats = statsResult.rows[0] as any

    return NextResponse.json({
      scans: result.rows.map((row: any) => ({
        scanId: row.scan_id,
        userWallet: row.user_wallet,
        transactionHash: row.transaction_hash,
        riskLevel: row.risk_level,
        riskScore: row.risk_score,
        scanTimeMs: row.scan_time_ms,
        confidence: row.confidence,
        threatsDetected: row.threats_detected,
        createdAt: row.created_at,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      statistics: {
        totalScans: parseInt(stats.total_scans),
        threatsBlocked: parseInt(stats.threats_blocked),
        avgScanTime: stats.avg_scan_time,
        usersProtected: parseInt(stats.users_protected),
      },
    })
  } catch (error: unknown) {
    const userWalletParam = request.nextUrl.searchParams.get('userWallet')
    return databaseError('GET /api/security/scan', error, userWalletParam || undefined)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

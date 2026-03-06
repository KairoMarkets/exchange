import { NextRequest, NextResponse } from 'next/server'
import { createPool } from '@/lib/db'
import { shouldUsePostgres } from '@/lib/db/devnet-store'
import { 
  validationError, 
  serviceUnavailableError, 
  databaseError, 
  isFetchError 
} from '@/lib/api-error'

// Kairo trust analysis backend URL (FastAPI service)
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

    // Save scan to database
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
  if (!shouldUsePostgres()) {
    return NextResponse.json({
      scans: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      statistics: {
        totalScans: 0,
        threatsBlocked: 0,
        avgScanTime: null,
        usersProtected: 0,
      },
      mode: 'devnet',
    })
  }

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

    let query = `
      SELECT 
        scan_id, user_wallet, transaction_hash, risk_level, risk_score,
        scan_time_ms, confidence, threats_detected, created_at
      FROM security_scans
      WHERE 1=1
    `

    const params: any[] = []
    let paramCount = 0

    if (userWallet) {
      paramCount++
      query += ` AND user_wallet = $${paramCount}`
      params.push(userWallet)
    }

    if (riskLevel) {
      paramCount++
      query += ` AND risk_level = $${paramCount}`
      params.push(riskLevel.toUpperCase())
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(limit, offset)

    const result = await client.query(query, params)

    let countQuery = 'SELECT COUNT(*) as total FROM security_scans WHERE 1=1'
    const countParams: any[] = []
    let countParamCount = 0

    if (userWallet) {
      countParamCount++
      countQuery += ` AND user_wallet = $${countParamCount}`
      countParams.push(userWallet)
    }
    if (riskLevel) {
      countParamCount++
      countQuery += ` AND risk_level = $${countParamCount}`
      countParams.push(riskLevel.toUpperCase())
    }

    const countResult = await client.query(countQuery, countParams)
    const total = parseInt((countResult.rows[0] as any).total)

    // Get statistics
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

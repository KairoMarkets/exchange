import { Pool, PoolConfig } from 'pg'

function basePoolConfig(): PoolConfig {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.DATABASE_POSTGRES_URL ||
    process.env.POSTGRES_URL ||
    ''

  if (connectionString) {
    return {
      connectionString,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  }

  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  }
}

/**
 * Create a new database pool connection
 * Use this for API routes that need database access
 */
export function createPool(config?: Partial<PoolConfig>): Pool {
  return new Pool({ ...basePoolConfig(), ...config })
}

/**
 * Execute a database query with automatic connection management
 * Useful for simple queries that don't need transaction control
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = createPool()
  let client

  try {
    client = await pool.connect()
    const result = await client.query(text, params)
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

/**
 * Execute multiple queries in a transaction
 * Automatically handles BEGIN, COMMIT, and ROLLBACK
 */
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const pool = createPool()
  let client

  try {
    client = await pool.connect()
    await client.query('BEGIN')

    const result = await callback(client)

    await client.query('COMMIT')
    return result
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK')
    }
    throw error
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

/**
 * Database helper types
 */
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginationResult {
  page: number
  limit: number
  total: number
  pages: number
}

/**
 * Build pagination query parameters
 */
export function buildPagination(params: PaginationParams): {
  limit: number
  offset: number
  page: number
} {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(50, Math.max(1, params.limit || 20))
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Calculate pagination result
 */
export function calculatePagination(
  total: number,
  params: { page: number; limit: number }
): PaginationResult {
  return {
    page: params.page,
    limit: params.limit,
    total,
    pages: Math.ceil(total / params.limit),
  }
}

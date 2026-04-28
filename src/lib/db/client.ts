import { Pool } from 'pg'

// Expected environment variable: DATABASE_URL in the form
// postgres://user:password@host:port/dbname
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  // Do not throw here in imported modules; export a not-connected pool.
  console.warn('DATABASE_URL not set. DB client will not connect until it is configured.')
}

export const pool = new Pool({
  connectionString,
  // Optional tuning for serverless: max connections 5
  max: Number(process.env.DB_MAX_CONN) || 5,
  idleTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false },
})

export async function query<T extends Record<string, any> = Record<string, any>>(text: string, params?: any[]) {
  const client = await pool.connect()
  try {
    const res = await client.query<T>(text, params)
    return res
  } finally {
    client.release()
  }
}

export async function testConnection() {
  try {
    const r = await query('SELECT NOW() as now')
    console.log('DB connected, now=', r.rows[0])
    return true
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('DB connection test failed:', errMsg)
    return false
  }
}

// Export default for quick imports
const dbClient = { pool, query, testConnection }

export default dbClient

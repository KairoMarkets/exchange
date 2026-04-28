import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const RDS_ENDPOINT = process.env.DB_HOST
const RDS_PORT = parseInt(process.env.DB_PORT || '5432')
const RDS_USER = process.env.DB_USER
const RDS_PASSWORD = process.env.DB_PASSWORD
const DB_NAME = process.env.DB_NAME

async function initDatabase() {
  if (!RDS_ENDPOINT || !RDS_USER || !RDS_PASSWORD || !DB_NAME) {
    console.error('❌ Missing required environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME')
    process.exit(1)
  }

  // First connect to postgres DB to create target database
  const adminPool = new Pool({
    host: RDS_ENDPOINT,
    port: RDS_PORT,
    user: RDS_USER,
    password: RDS_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('🔗 Connecting to postgres database...')
    const client = await adminPool.connect()

    // Check if database exists
    const checkDb = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    )

    if (checkDb.rows.length === 0) {
      console.log(`📦 Creating database '${DB_NAME}'...`)
      await client.query(`CREATE DATABASE ${DB_NAME}`)
      console.log(`✅ Database '${DB_NAME}' created`)
    } else {
      console.log(`✅ Database '${DB_NAME}' already exists`)
    }

    client.release()
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('❌ Error creating database:', errMsg)
    process.exit(1)
  } finally {
    await adminPool.end()
  }

  // Now connect to target DB and run schema
  const appPool = new Pool({
    host: RDS_ENDPOINT,
    port: RDS_PORT,
    user: RDS_USER,
    password: RDS_PASSWORD,
    database: DB_NAME,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log(`\n🔗 Connecting to '${DB_NAME}' database...`)
    const client = await appPool.connect()
    console.log('✅ Connected')

    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf-8')

    console.log('\n📋 Running schema.sql...')
    await client.query(schema)
    console.log('✅ Schema created successfully')

    // Verify tables exist
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    )
    console.log('\n📊 Created tables:', tables.rows.map((r: any) => r.table_name).join(', '))

    client.release()
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('❌ Error initializing schema:', errMsg)
    process.exit(1)
  } finally {
    await appPool.end()
  }

  console.log('\n✅ Database initialization complete!')
}

initDatabase().catch(console.error)

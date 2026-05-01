import { Pool } from 'pg'

async function main() {
  console.log('🧪 Testing database connection...\n')

  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error('❌ Missing required environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME')
    process.exit(1)
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const client = await pool.connect()
    console.log('✅ Connected to database')

    // Server time
    const timeRes = await client.query('SELECT NOW() as now')
    console.log('📅 Server time:', (timeRes.rows[0] as any).now)

    // List tables
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    )
    console.log('\n📊 Tables:', (tables.rows as any[]).map(r => r.table_name).join(', '))

    // Count data
    const agents = await client.query('SELECT COUNT(*) as count FROM agents')
    const users = await client.query('SELECT COUNT(*) as count FROM users')
    const requests = await client.query('SELECT COUNT(*) as count FROM service_requests')

    console.log('\n📈 Data:')
    console.log(`   Agents: ${(agents.rows[0] as any).count}`)
    console.log(`   Users: ${(users.rows[0] as any).count}`)
    console.log(`   Requests: ${(requests.rows[0] as any).count}`)

    // Sample agent
    const agentRes = await client.query('SELECT * FROM agents LIMIT 1')
    if ((agentRes.rows as any[]).length > 0) {
      const agent = (agentRes.rows[0] as any)
      console.log('\n🤖 Sample Agent:')
      console.log(`   Name: ${agent.name}`)
      console.log(`   ID: ${agent.agent_id}`)
      console.log(`   Active: ${agent.active}`)
    }

    client.release()
    console.log('\n✅ All tests passed!')
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('❌ Test failed:', errMsg)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main().catch(console.error)

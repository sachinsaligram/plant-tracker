import { readFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { getDb } from '../lib/db'

const sql = readFileSync('./lib/schema.sql', 'utf8')
const statements = sql.split(';').map(s => s.trim()).filter(Boolean)

async function run() {
  const db = getDb()
  for (const stmt of statements) {
    await db.execute(stmt)
  }
  console.log('Migration complete')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})

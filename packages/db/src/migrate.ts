import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool, getDatabaseUrl } from './client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

async function waitForDatabase(maxAttempts = 20, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pool = createPool(getDatabaseUrl())
    try {
      await pool.query('SELECT 1')
      await pool.end()
      return
    } catch {
      await pool.end().catch(() => undefined)
      if (attempt === maxAttempts) {
        throw new Error('Database did not become ready in time')
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

async function run(): Promise<void> {
  await waitForDatabase()
  const pool = createPool(getDatabaseUrl())
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const existing = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations'
    )
    const applied = new Set(existing.rows.map((row) => row.name))

    const migrationFiles = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    for (const fileName of migrationFiles) {
      if (applied.has(fileName)) {
        continue
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, fileName), 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [fileName]
        )
        await client.query('COMMIT')
        console.log(`Applied migration: ${fileName}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }

    if (migrationFiles.length === 0) {
      console.log('No migrations found.')
    } else {
      console.log('Migrations up to date.')
    }
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})

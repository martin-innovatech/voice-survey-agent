import { Pool } from 'pg'

export const DEFAULT_DATABASE_URL =
  'postgresql://voice:voice@localhost:5433/voice_survey'

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
}

export function createPool(connectionString?: string): Pool {
  return new Pool({
    connectionString: connectionString ?? getDatabaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000
  })
}

import pg from 'pg'
import { logger } from '../utils/logger.js'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

pool.on('error', (err) => {
  logger.error('Unexpected PG error', err)
})

export async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  logger.info('db.query', { durationMs: duration, rows: res.rowCount })
  return res
}

export { pool }

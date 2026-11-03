import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

export function createPool(): Pool {
  const urlFile = process.env.DATABASE_URL_FILE;
  if (urlFile && process.env.DATABASE_URL) throw new Error('Set only DATABASE_URL or DATABASE_URL_FILE');
  const connectionString = urlFile ? readFileSync(urlFile, 'utf8').trim() : process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL or DATABASE_URL_FILE is required');
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000 });
  // Idle PostgreSQL clients may fail asynchronously during an outage.
  pool.on('error', () => { console.error('Database connection lost'); });
  return pool;
}

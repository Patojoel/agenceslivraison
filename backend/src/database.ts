import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export function createDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  return { pool, db: drizzle(pool) };
}

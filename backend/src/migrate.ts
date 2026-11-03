import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDatabase } from './database';
async function migrate() {
  const { pool } = createDatabase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [19188412]);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const existing = await client.query('SELECT version FROM schema_migrations WHERE version = $1', ['0001_initial']);
    if (!existing.rowCount) {
      await client.query(await readFile(join(process.cwd(), 'migrations/0001_initial.sql'), 'utf8'));
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', ['0001_initial']);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
void migrate().catch(() => { console.error('Migration failed'); process.exitCode = 1; });

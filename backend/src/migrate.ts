import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './database';
import { requiredMigrations } from './migrations';
async function migrate() {
  const migrations = requiredMigrations();
  const { pool } = createDatabase();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [19188412]);
    const legacy = await client.query<{ exists: boolean }>("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists");
    if (legacy.rows[0]?.exists) {
      const versions = await client.query<{ version: string }>('SELECT version FROM public.schema_migrations');
      if (versions.rows.some(row => row.version !== '0001_initial')) throw new Error('Unknown legacy migrations require manual review');
    }
    const current = await client.query<{ exists: boolean }>("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists");
    if (current.rows[0]?.exists) {
      const applied = await client.query<{ hash: string; created_at: string }>('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at');
      if (applied.rows.length > migrations.length || applied.rows.some((row, i) => row.hash !== migrations[i]?.hash || Number(row.created_at) !== migrations[i]?.folderMillis)) {
        throw new Error('Migration history does not match files');
      }
    }
    await drizzleMigrate(drizzle(client), { migrationsFolder: './migrations' });
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [19188412]);
    client.release();
    await pool.end();
  }
}
void migrate().catch(() => { console.error('Migration failed'); process.exitCode = 1; });

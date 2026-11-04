import 'reflect-metadata';
import dataSource from '@config/typeorm-cli.config';
import { MIGRATIONS_TABLE, orderedMigrationNames } from '@config/typeorm.config';

const MIGRATION_LOCK = 19188412;

/** Explicit, repeatable deployment step: concurrent runs are serialized and an unknown history is refused. */
async function migrate(): Promise<void> {
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    const [table]: { exists: boolean }[] = await runner.query(`SELECT to_regclass('public.${MIGRATIONS_TABLE}') IS NOT NULL AS exists`);
    if (table?.exists) {
      const files = orderedMigrationNames(dataSource.migrations);
      const applied: { name: string }[] = await runner.query(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`);
      if (applied.length > files.length || applied.some((row, index) => row.name !== files[index])) {
        throw new Error('Migration history does not match files');
      }
    }
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    await runner.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => undefined);
    await runner.release();
    await dataSource.destroy();
  }
}

// The error may contain the connection string: only a generic message is logged.
void migrate().catch(() => { console.error('Migration failed'); process.exitCode = 1; });

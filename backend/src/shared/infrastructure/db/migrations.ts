import { readMigrationFiles } from 'drizzle-orm/migrator';

export function requiredMigrations(): { hash: string; folderMillis: number }[] {
  const migrations = readMigrationFiles({ migrationsFolder: './migrations' });
  if (!migrations.length) throw new Error('No migrations found');
  for (let index = 1; index < migrations.length; index++) {
    if (migrations[index].folderMillis <= migrations[index - 1].folderMillis) throw new Error('Migration order invalid');
  }
  return migrations;
}

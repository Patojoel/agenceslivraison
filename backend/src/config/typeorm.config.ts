import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { Env, resolveDatabaseUrl } from './env.schema';

export const MIGRATIONS_TABLE = 'typeorm_migrations';

/** Names of the migration files in the order TypeORM runs them (by timestamp), whatever order they were discovered in. */
export const orderedMigrationNames = (migrations: readonly { name?: string; constructor: { name: string } }[]): string[] =>
  migrations
    .map(migration => migration.name ?? migration.constructor.name)
    .sort((left, right) => Number(left.slice(-13)) - Number(right.slice(-13)));

export const buildDataSourceOptions = (env: Pick<Env, 'DATABASE_URL' | 'DATABASE_URL_FILE'>): DataSourceOptions => ({
  type: 'postgres',
  url: resolveDatabaseUrl(env),
  entities: [join(__dirname, '..', '**', '*.orm-entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
  migrationsTableName: MIGRATIONS_TABLE,
  // Migrations are an explicit deployment step (`npm run migrate`), never a side effect of booting.
  migrationsRun: false,
  synchronize: false,
  logging: false,
  // An undefined or null criterion would silently drop the condition (and widen the query): refuse it.
  invalidWhereValuesBehavior: { undefined: 'throw', null: 'throw' },
  extra: { connectionTimeoutMillis: 3000 },
});

export const buildTypeOrmOptions = (config: ConfigService<Env, true>): TypeOrmModuleOptions => ({
  ...buildDataSourceOptions({
    DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
    DATABASE_URL_FILE: config.get('DATABASE_URL_FILE', { infer: true }),
  }),
  // Opened on first use by TypeOrmDatabaseConnection, so the API starts and answers liveness without PostgreSQL.
  manualInitialization: true,
});

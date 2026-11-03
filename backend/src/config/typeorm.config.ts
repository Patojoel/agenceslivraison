import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { Env, resolveDatabaseUrl } from './env.schema';

export const MIGRATIONS_TABLE = 'typeorm_migrations';

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

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { validateEnv } from './env.schema';
import { buildDataSourceOptions } from './typeorm.config';

/** Data source for `npm run migrate` and the TypeORM CLI (`migration:generate`, `migration:check`). */
export default new DataSource(buildDataSourceOptions(validateEnv(process.env)));

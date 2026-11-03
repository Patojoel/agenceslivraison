import { Module } from '@nestjs/common';
import { createDatabase } from './database';
import { DATABASE_POOL, HealthController } from './health.controller';
@Module({ controllers: [HealthController], providers: [{ provide: DATABASE_POOL, useFactory: () => createDatabase().pool }] })
export class AppModule {}

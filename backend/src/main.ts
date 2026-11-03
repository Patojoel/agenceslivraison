import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Env } from '@config/env.schema';
import { ProblemDetailsFilter } from '@shared/presentation/filters/problem-details.filter';
import { HealthController } from '@shared/presentation/health/health.controller';
import { readinessMiddleware } from '@shared/presentation/middleware/readiness.middleware';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.use(readinessMiddleware(app.get(HealthController)));
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Agences Livraison API').setVersion('1').addBearerAuth().build());
  SwaggerModule.setup('api/v1/docs', app, document);
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService<Env, true>).get('PORT', { infer: true }), '0.0.0.0');
}
void bootstrap();

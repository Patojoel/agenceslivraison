import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HealthController } from './health.controller';
import { readinessMiddleware } from './readiness-middleware';
import { ProblemDetailsFilter } from './problem-details';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.use(readinessMiddleware(app.get(HealthController)));
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Agences Livraison API').setVersion('1').build());
  SwaggerModule.setup('api/v1/docs', app, document);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
void bootstrap();

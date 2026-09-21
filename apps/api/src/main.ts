import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Rate limiting keys on client IP, so the number of proxies in front of the
  // API has to be declared. Left at 0, every request behind a load balancer
  // reports the balancer's address and all callers share one bucket; set too
  // high, a caller can spoof `x-forwarded-for` and get a fresh bucket per
  // request. It is deployment-specific, so it comes from the environment.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 0));

  app.use(helmet());
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Rivisk API')
    .setDescription('Cross-protocol portfolio and risk intelligence API for Stacks.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`Rivisk API listening on http://localhost:${port}/api/v1`);
}

bootstrap();

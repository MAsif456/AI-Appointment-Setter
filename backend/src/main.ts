import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {  
  /**
   * Enable rawBody to make req.rawBody (a Buffer of the original bytes) available
   * on every request. This is required for webhook signature verification — the
   * signature is computed over the exact bytes the sender signed, and re-serialised
   * JSON may differ in whitespace or key ordering.
   * Ref: https://docs.nestjs.com/faq/raw-body
   * Ref: https://webhooks.fyi/security/hmac
   */
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Enable global validation so DTOs are automatically validated
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', 
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();

/**
 * Load .env BEFORE any other imports so process.env vars are available
 * when schema files are imported (needed for field-encryption plugin guard).
 * Without this, `if (process.env.FIELD_ENCRYPTION_KEY)` in schema files
 * evaluates to false because ConfigModule.forRoot() hasn't run yet.
 */
import 'dotenv/config';

import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from "./app.module";
import { buildHelmetOptions } from "./security-headers/security-headers.config";

async function bootstrap() {
  /**
   * Enable rawBody to make req.rawBody (a Buffer of the original bytes) available
   * on every request. This is required for webhook signature verification. The
   * signature is computed over the exact bytes the sender signed, and re-serialised
   * JSON may differ in whitespace or key ordering.
   * Ref: https://docs.nestjs.com/faq/raw-body
   * Ref: https://webhooks.fyi/security/hmac
   */
  const app = await NestFactory.create(AppModule, { rawBody: true });

  /*
   * Apply HTTP security headers globally before any controllers are mounted.
   * Registering helmet here (rather than per-controller) guarantees that every
   * current and future route is automatically protected against clickjacking,
   * MIME sniffing, protocol downgrade and referrer leakage, in line with the
   * "secure by default" principle (OWASP) and the Open/Closed Principle.
   * The environment-aware config is built in security-headers.config.ts so the
   * policy is unit-testable in isolation and HSTS only activates in production.
   */
  app.use(helmet(buildHelmetOptions(process.env.NODE_ENV)));

  /**
   * Parse cookies from incoming requests so req.cookies is populated.
   * Required for reading the HttpOnly refresh_token cookie in /auth/refresh.
   * Must be registered BEFORE any route handlers that read cookies.
   */
  app.use(cookieParser());
  
  // Enable global validation so DTOs are automatically validated
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  /**
   * Swagger (OpenAPI) — interactive API docs served at /api.
   * Only enabled outside production so the docs are not publicly exposed
   * on the live server. Visit http://localhost:3001/api when running locally.
   */
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('LunaX API')
      .setDescription('REST API for the LunaX clinic management platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();

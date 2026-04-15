import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
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

  // Enable global validation so DTOs are automatically validated
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();

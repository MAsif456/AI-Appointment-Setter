import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CspReportController } from "./csp-report.controller";
import { CspReportService } from "./csp-report.service";
import { CspReport, CspReportSchema } from "./schemas/csp-report.schema";

/**
 * Security headers module.
 *
 * Bundles the CSP violation reporting endpoint together with the
 * Mongoose model registration. The CacheControlInterceptor is
 * registered separately at the AppModule level (via APP_INTERCEPTOR)
 * because it must be applied globally and Nest's APP_* providers
 * have to be registered on the root module to take effect.
 *
 * Helmet itself is wired in main.ts because it is express-level
 * middleware, not a Nest provider.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CspReport.name, schema: CspReportSchema },
    ]),
  ],
  controllers: [CspReportController],
  providers: [CspReportService],
  exports: [CspReportService],
})
export class SecurityHeadersModule {}

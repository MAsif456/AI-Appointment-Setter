import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CacheControlInterceptor } from "./security-headers/cache-control.interceptor";
import { SecurityHeadersModule } from "./security-headers/security-headers.module";
import { AiSettingsModule } from "./ai-settings/ai-settings.module";
import { ClinicsModule } from "./clinics/clinics.module";
import { GhlModule } from "./ghl/ghl.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { AiModule } from "./ai/ai.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { OrchestratorModule } from "./orchestrator/orchestrator.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { CancellationModule } from "./cancellation/cancellation.module";
import { HealthModule } from "./health/health.module";
import { DatabaseExceptionFilter } from "./common/database-exception.filter";
import { RateLimitingModule } from "./rate-limiting/rate-limiting.module";
import { AuthModule } from "./auth/auth.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { ReminderModule } from "./reminder/reminder.module";
import { GdprModule } from "./gdpr/gdpr.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      /**
       * Use the ConfigService to get the MONGODB_URI and use it to create
       * the options for the MongooseModule.
       * @param {ConfigService} config - The ConfigService instance.
       * @returns {Promise<{ uri: string }>} - A promise that resolves to an object
       * with a single property, uri, which is the value of the MONGODB_URI
       * environment variable.
       */
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI"),
      }),
      inject: [ConfigService],
    }),
    RateLimitingModule,
    SecurityHeadersModule,
    AuthModule,
    AnalyticsModule,
    AiSettingsModule,
    ClinicsModule,
    GhlModule,
    WebhooksModule,
    AiModule,
    ConversationsModule,
    OrchestratorModule,
    AppointmentsModule,
    CancellationModule,
    HealthModule,
    ReminderModule,
    GdprModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
    /*
     * Global cache-control interceptor. Reads the @SensitiveData() metadata
     * and stamps strict no-store headers onto any response from a marked
     * handler. Registering it here means the "patient data" list lives at
     * the call site (the controller) rather than in a central hardcoded
     * registry, so new sensitive routes get the correct headers as long
     * as the developer remembers the decorator.
     */
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
  ],
})
export class AppModule {}

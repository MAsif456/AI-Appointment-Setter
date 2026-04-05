import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
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
import { AuthModule } from './auth/auth.module';
import { ReminderModule } from "./reminder/reminder.module";

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
    AuthModule,
    ReminderModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
  ],
})
export class AppModule {}

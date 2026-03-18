import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiSettingsModule } from './ai-settings/ai-settings.module';
import { ClinicsModule } from './clinics/clinics.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AiModule } from './ai/ai.module';
import { ConversationsModule } from './conversations/conversations.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    AiSettingsModule,
    ClinicsModule,
    WebhooksModule,
    AiModule,
    ConversationsModule,
    OrchestratorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

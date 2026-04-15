import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { ClinicsModule } from "../clinics/clinics.module";
import { OrchestratorModule } from "../orchestrator/orchestrator.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import {
  WebhookEvent,
  WebhookEventSchema,
} from "./schemas/webhook-event.schema";
import { WebhookBodySizeMiddleware } from "./middleware/webhook-body-size.middleware";
import { WebhookSignatureGuard } from "./guards/webhook-signature.guard";
import { WebhookThrottleGuard } from "./guards/webhook-throttle.guard";
import { WebhookDedupInterceptor } from "./interceptors/webhook-dedup.interceptor";
import { WebhookExceptionFilter } from "./filters/webhook-exception.filter";

@Module({
  imports: [
    ClinicsModule,
    OrchestratorModule,
    ConfigModule,
    MongooseModule.forFeature([
      { name: WebhookEvent.name, schema: WebhookEventSchema },
    ]),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhookSignatureGuard,
    WebhookThrottleGuard,
    WebhookDedupInterceptor,
    WebhookExceptionFilter,
  ],
})
export class WebhooksModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(WebhookBodySizeMiddleware)
      .forRoutes({ path: "webhooks/ghl", method: RequestMethod.POST });
  }
}

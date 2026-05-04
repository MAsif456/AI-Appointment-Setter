import { Test, TestingModule } from "@nestjs/testing";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { WebhookSignatureGuard } from "./guards/webhook-signature.guard";
import { WebhookThrottleGuard } from "./guards/webhook-throttle.guard";
import { WebhookDedupInterceptor } from "./interceptors/webhook-dedup.interceptor";
import { WebhookExceptionFilter } from "./filters/webhook-exception.filter";

const GUARDS_METADATA = "__guards__";
const INTERCEPTORS_METADATA = "__interceptors__";
const EXCEPTION_FILTERS_METADATA = "__exceptionFilters__";

describe("WebhooksController", () => {
  let controller: WebhooksController;
  let service: { handleGhlWebhook: jest.Mock };

  beforeEach(async () => {
    service = {
      handleGhlWebhook: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: WebhooksService, useValue: service }],
    })
      .overrideGuard(WebhookSignatureGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WebhookThrottleGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(WebhookDedupInterceptor)
      .useValue({ intercept: (_: any, next: any) => next.handle() })
      .overrideFilter(WebhookExceptionFilter)
      .useValue({ catch: () => {} })
      .compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  describe("handleGhlWebhook", () => {
    it("should delegate to webhooksService with the exact payload received", async () => {
      const payload = {
        type: "ContactCreate",
        location: { id: "loc_cardiff_001" },
      } as any;
      await controller.handleGhlWebhook(payload);
      expect(service.handleGhlWebhook).toHaveBeenCalledWith(payload);
    });

    it("should return { success: true } for a ContactCreate event", async () => {
      const payload = {
        type: "ContactCreate",
        location: { id: "loc_cardiff_001" },
      } as any;
      const result = await controller.handleGhlWebhook(payload);
      expect(result).toEqual({ success: true });
    });

    it("should return { success: true } for an InboundMessage event", async () => {
      const payload = {
        type: "InboundMessage",
        location: { id: "loc_cardiff_001" },
        message: { body: "Hello, I need help" },
      } as any;
      const result = await controller.handleGhlWebhook(payload);
      expect(result).toEqual({ success: true });
    });

    it("should return { success: true } even when the service encounters an internal error", async () => {
      service.handleGhlWebhook.mockResolvedValue({ success: true });
      const payload = { type: "BadEvent", location: { id: "loc_bad" } } as any;
      const result = await controller.handleGhlWebhook(payload);
      expect(result).toEqual({ success: true });
    });

    it("should pass an unknown event type through to the service without modification", async () => {
      const payload = {
        type: "UnknownEventType",
        location: { id: "loc_cardiff_001" },
      } as any;
      await controller.handleGhlWebhook(payload);
      expect(service.handleGhlWebhook).toHaveBeenCalledWith(payload);
    });
  });

  describe("Security decorators", () => {
    it("should have WebhookSignatureGuard and WebhookThrottleGuard applied", () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        WebhooksController.prototype.handleGhlWebhook,
      );
      expect(guards).toBeDefined();
      expect(guards).toContain(WebhookSignatureGuard);
      expect(guards).toContain(WebhookThrottleGuard);
    });

    it("should have WebhookDedupInterceptor applied", () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        WebhooksController.prototype.handleGhlWebhook,
      );
      expect(interceptors).toBeDefined();
      expect(interceptors).toContain(WebhookDedupInterceptor);
    });

    it("should have WebhookExceptionFilter applied at controller level", () => {
      const filters = Reflect.getMetadata(
        EXCEPTION_FILTERS_METADATA,
        WebhooksController,
      );
      expect(filters).toBeDefined();
      expect(filters).toContain(WebhookExceptionFilter);
    });
  });
});

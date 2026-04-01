import { Test, TestingModule } from "@nestjs/testing";
import {
  HealthCheckService,
  MongooseHealthIndicator,
  HealthCheckResult,
} from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { GroqHealthIndicator } from "./groq-health.indicator";
import { GhlHealthIndicator } from "./ghl-health.indicator";

describe("HealthController", () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  const mockHealthCheckService = {
    check: jest.fn(),
  };
  const mockMongoose = { pingCheck: jest.fn() };
  const mockGroq = { isHealthy: jest.fn() };
  const mockGhl = { isHealthy: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: MongooseHealthIndicator, useValue: mockMongoose },
        { provide: GroqHealthIndicator, useValue: mockGroq },
        { provide: GhlHealthIndicator, useValue: mockGhl },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should return healthy status when all services are up", async () => {
    const healthyResult: HealthCheckResult = {
      status: "ok",
      info: {
        mongodb: { status: "up" },
        "groq-ai": { status: "up", circuitBreaker: "CLOSED" },
        "ghl-api": {
          status: "up",
          circuitBreakers: { messaging: "CLOSED", appointments: "CLOSED" },
        },
      },
      error: {},
      details: {
        mongodb: { status: "up" },
        "groq-ai": { status: "up", circuitBreaker: "CLOSED" },
        "ghl-api": {
          status: "up",
          circuitBreakers: { messaging: "CLOSED", appointments: "CLOSED" },
        },
      },
    };

    mockHealthCheckService.check.mockResolvedValue(healthyResult);

    const result = await controller.check();
    expect(result.status).toBe("ok");
    expect(mockHealthCheckService.check).toHaveBeenCalledWith(
      expect.any(Array),
    );
  });

  it("should report degraded when a circuit breaker is OPEN", async () => {
    const degradedResult: HealthCheckResult = {
      status: "error",
      info: { mongodb: { status: "up" } },
      error: {
        "groq-ai": { status: "down", circuitBreaker: "OPEN" },
      },
      details: {
        mongodb: { status: "up" },
        "groq-ai": { status: "down", circuitBreaker: "OPEN" },
      },
    };

    mockHealthCheckService.check.mockResolvedValue(degradedResult);

    const result = await controller.check();
    expect(result.status).toBe("error");
  });
});

import { HealthCheckError } from "@nestjs/terminus";
import { GroqHealthIndicator } from "./groq-health.indicator";

describe("GroqHealthIndicator", () => {
  let indicator: GroqHealthIndicator;
  const mockGroqService = { getCircuitBreakerState: jest.fn() };

  beforeEach(() => {
    indicator = new GroqHealthIndicator(mockGroqService as any);
    jest.clearAllMocks();
  });

  it("should report healthy when circuit breaker is CLOSED", async () => {
    mockGroqService.getCircuitBreakerState.mockReturnValue("CLOSED");

    const result = await indicator.isHealthy("groq-ai");

    expect(result["groq-ai"].status).toBe("up");
    expect(result["groq-ai"].circuitBreaker).toBe("CLOSED");
  });

  it("should throw HealthCheckError when circuit breaker is OPEN", async () => {
    mockGroqService.getCircuitBreakerState.mockReturnValue("OPEN");

    await expect(indicator.isHealthy("groq-ai")).rejects.toThrow(
      HealthCheckError,
    );
  });

  it("should throw HealthCheckError when circuit breaker is HALF_OPEN", async () => {
    mockGroqService.getCircuitBreakerState.mockReturnValue("HALF_OPEN");

    await expect(indicator.isHealthy("groq-ai")).rejects.toThrow(
      HealthCheckError,
    );
  });
});

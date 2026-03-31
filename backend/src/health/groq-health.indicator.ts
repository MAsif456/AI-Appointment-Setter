import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { GroqService } from "../ai/groq.service";

/**
 * Custom health indicator that reports the Groq AI circuit breaker state.
 * If the circuit breaker is OPEN, the AI service is considered unhealthy.
 */
@Injectable()
export class GroqHealthIndicator extends HealthIndicator {
  /**
   * Creates a new instance of the GroqHealthIndicator.
   * @param groqService - The GroqService instance to use for health checks.
   */
  constructor(private readonly groqService: GroqService) {
    super();
  }

  /**
   * Reports the health status of the Groq AI service based on the circuit breaker state.
   * If the circuit breaker is CLOSED, the service is considered healthy.
   * Otherwise, a HealthCheckError is thrown with the circuit breaker state.
   * @param key - The key of the health indicator.
   * @returns {Promise<HealthIndicatorResult>} - The health status of the Groq AI service.
   * @throws {HealthCheckError} - If the circuit breaker is not in the CLOSED state.
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const state = this.groqService.getCircuitBreakerState();
    const isHealthy = state === "CLOSED";

    const result = this.getStatus(key, isHealthy, { circuitBreaker: state });

    if (isHealthy) {
      return result;
    }
    throw new HealthCheckError("Groq AI is degraded", result);
  }
}

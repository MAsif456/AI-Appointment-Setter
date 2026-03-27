import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { GhlApiService } from "../ghl/ghl-api.service";

/**
 * Custom health indicator that reports the GHL API circuit breaker states.
 * If any circuit breaker is OPEN, the GHL service is considered degraded.
 */
@Injectable()
export class GhlHealthIndicator extends HealthIndicator {
  /**
   * Constructs a GhlHealthIndicator instance.
   * Initialises the GHL API circuit breaker states.
   * @param {GhlApiService} ghlApiService - The GHL API service instance.
   */
  constructor(private readonly ghlApiService: GhlApiService) {
    super();
  }

  /**
   * Returns the health status of the GHL API service.
   * If all circuit breakers are in the CLOSED state, the service is considered healthy.
   * Otherwise, a HealthCheckError is thrown with the circuit breaker states.
   * @param key - The key of the health indicator.
   * @returns {Promise<HealthIndicatorResult>} - The health status of the GHL API service.
   * @throws {HealthCheckError} - If any circuit breaker is not in the CLOSED state.
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const states = this.ghlApiService.getCircuitBreakerStates();
    const allClosed = Object.values(states).every((s) => s === "CLOSED");

    const result = this.getStatus(key, allClosed, { circuitBreakers: states });

    if (allClosed) {
      return result;
    }
    throw new HealthCheckError("GHL API is degraded", result);
  }
}

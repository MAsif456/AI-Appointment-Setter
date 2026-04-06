import { Logger } from "@nestjs/common";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  name?: string;
}

/**
 * Implements the Circuit Breaker pattern (Nygard, 2007) to protect against
 * cascading failures when calling external services like the GHL API.
 *
 * States:
 *  - CLOSED:    Requests pass through normally; failures are counted.
 *  - OPEN:      After reaching the failure threshold the breaker trips;
 *               all calls fail immediately without hitting the external service.
 *  - HALF_OPEN: After the reset timeout, one probe request is allowed through.
 *               If it succeeds the breaker resets to CLOSED; otherwise it re-opens.
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly logger: Logger;

  /**
   * Constructs a CircuitBreaker instance.
   * @param {CircuitBreakerOptions} options - The options to configure the circuit breaker.
   * @param {number} options.failureThreshold - The number of consecutive failures before the circuit breaker trips.
   * @param {number} options.resetTimeoutMs - The time in milliseconds to wait before allowing one probe request to go through after tripping.
   * @param {string} [options.name] - Optional name to use for logging purposes (default is 'default').
   */
  constructor(private readonly options: CircuitBreakerOptions) {
    this.logger = new Logger(`CircuitBreaker:${options.name ?? "default"}`);
  }

  /**
   * Returns the current state of the circuit breaker.
   *
   * @returns {CircuitState} - One of 'CLOSED', 'OPEN', or 'HALF_OPEN'.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Executes the given function through the circuit breaker.
   * @throws Error with message containing 'Circuit breaker is OPEN' when tripped.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.state = "HALF_OPEN";
        this.logger.log(
          "Circuit breaker transitioning to HALF_OPEN – allowing probe request",
        );
      } else {
        const waitMs =
          this.options.resetTimeoutMs - (Date.now() - this.lastFailureTime);
        this.logger.warn(
          `Circuit breaker is OPEN – failing fast (retry in ${Math.ceil(waitMs / 1000)}s)`,
        );
        throw new Error(
          "Circuit breaker is OPEN – the GHL API is temporarily unavailable. Please try again shortly.",
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Returns true if the time since the last failure is greater than or equal to the reset timeout.
   * This indicates that the circuit breaker should attempt to reset from the OPEN state to the HALF_OPEN state.
   * @returns {boolean} - True if the circuit breaker should attempt to reset, false otherwise.
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs;
  }

  /**
   * Resets the circuit breaker to the CLOSED state when a probe request succeeds.
   * If the current state is HALF_OPEN, logs a message indicating that the circuit breaker is resetting.
   */
  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.logger.log(
        "Probe request succeeded – circuit breaker resetting to CLOSED",
      );
    }
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  /**
   * Increments the failure count and logs a message if the circuit breaker trips to the OPEN state
   * or if a probe request fails when the breaker is in the HALF_OPEN state
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.logger.warn("Probe request failed – circuit breaker re-opening");
      return;
    }

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = "OPEN";
      this.logger.warn(
        `Failure threshold reached (${this.failureCount}/${this.options.failureThreshold}) – circuit breaker tripped to OPEN`,
      );
    }
  }
}

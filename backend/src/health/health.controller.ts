import { Controller, Get } from "@nestjs/common";
import {
  HealthCheckService,
  HealthCheck,
  MongooseHealthIndicator,
} from "@nestjs/terminus";
import { GroqHealthIndicator } from "./groq-health.indicator";
import { GhlHealthIndicator } from "./ghl-health.indicator";

/**
 * Exposes a GET /health endpoint that reports the status of all
 * external dependencies: MongoDB, Groq AI, and GHL APIs.
 *
 * Returns 200 when all services are healthy, 503 when degraded.
 * @see https://docs.nestjs.com/recipes/terminus
 */
@Controller("health")
export class HealthController {
/**
 * Constructs a HealthController instance.
 * @param health - The HealthCheckService instance for reporting service health.
 * @param mongoose - The MongooseHealthIndicator instance for MongoDB health checks.
 * @param groq - The GroqHealthIndicator instance for Groq AI health checks.
 * @param ghl - The GhlHealthIndicator instance for GHL API health checks.
 */
  constructor(
    private health: HealthCheckService,
    private mongoose: MongooseHealthIndicator,
    private groq: GroqHealthIndicator,
    private ghl: GhlHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  /**
   * Performs a health check of the application by checking the status of all
   * external dependencies: MongoDB, Groq AI, and GHL APIs.
   *
   * Returns a Promise that resolves with the HealthCheckResult object.
   * @see https://docs.nestjs.com/recipes/terminus
   * @returns {Promise<HealthCheckResult>} - A promise that resolves with the health status.
   */
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck("mongodb"),
      () => this.groq.isHealthy("groq-ai"),
      () => this.ghl.isHealthy("ghl-api"),
    ]);
  }
}

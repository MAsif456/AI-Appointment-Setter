import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { AiModule } from "../ai/ai.module";
import { GhlModule } from "../ghl/ghl.module";
import { HealthController } from "./health.controller";
import { GroqHealthIndicator } from "./groq-health.indicator";
import { GhlHealthIndicator } from "./ghl-health.indicator";

@Module({
  imports: [TerminusModule, AiModule, GhlModule],
  controllers: [HealthController],
  providers: [GroqHealthIndicator, GhlHealthIndicator],
})
export class HealthModule {}

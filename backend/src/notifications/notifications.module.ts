import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationBusService } from "./notification-bus.service";
import { AuthModule } from "../auth/auth.module";

/**
 * Wires the staff-facing SSE notifications endpoint.
 *
 * The bus is provided and exported so other modules (the escalation
 * pipeline) can inject it to publish events. `AuthModule` is imported
 * so the controller can verify the short-lived stream-token JWT that
 * query-string auth relies on.
 */
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationBusService],
  exports: [NotificationBusService],
})
export class NotificationsModule {}

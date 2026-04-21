import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NotificationsController } from "./notifications.controller";
import { NotificationBusService } from "./notification-bus.service";
import { InboxNotificationController } from "./inbox-notification.controller";
import { InboxNotificationService } from "./inbox-notification.service";
import { AuthModule } from "../auth/auth.module";
import {
  Notification,
  NotificationSchema,
} from "../database/schemas/notification.schema";
import { User, UserSchema } from "../database/schemas/user.schema";

/**
 * NotificationsModule provides two separate systems:
 *
 * 1. SSE escalation bus (NotificationBusService + NotificationsController)
 *    — real-time escalation events pushed to staff browsers.
 *
 * 2. Persistent inbox (InboxNotificationService + InboxNotificationController)
 *    — persisted per-user notifications with read/dismiss state, polled
 *    from the sidebar badge and rendered in the /notifications inbox page.
 */
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [NotificationsController, InboxNotificationController],
  providers: [NotificationBusService, InboxNotificationService],
  exports: [NotificationBusService, InboxNotificationService],
})
export class NotificationsModule {}
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { InboxNotificationService } from "./inbox-notification.service";

@Controller("inbox-notifications")
@UseGuards(JwtAuthGuard)
export class InboxNotificationController {
  constructor(private readonly inboxService: InboxNotificationService) {}

  private userId(req: any): string {
    return req.user._id.toString();
  }

  /** GET /inbox-notifications?page=1 — paginated list, excludes dismissed */
  @Get()
  getNotifications(@Req() req: any, @Query("page") page = "1") {
    return this.inboxService.findByUser(this.userId(req), parseInt(page, 10));
  }

  /** GET /inbox-notifications/unread-count — sidebar badge count */
  @Get("unread-count")
  async getUnreadCount(@Req() req: any) {
    const count = await this.inboxService.getUnreadCount(this.userId(req));
    return { count };
  }

  /** PATCH /inbox-notifications/read-all — mark every unread notification as read */
  @Patch("read-all")
  async markAllAsRead(@Req() req: any) {
    await this.inboxService.markAllAsRead(this.userId(req));
    return { success: true };
  }

  /** PATCH /inbox-notifications/:id/read — mark a single notification as read */
  @Patch(":id/read")
  async markAsRead(@Req() req: any, @Param("id") id: string) {
    await this.inboxService.markAsRead(id, this.userId(req));
    return { success: true };
  }

  /** DELETE /inbox-notifications/:id — soft-delete (dismiss) a notification */
  @Delete(":id")
  async dismiss(@Req() req: any, @Param("id") id: string) {
    await this.inboxService.dismiss(id, this.userId(req));
    return { success: true };
  }
}
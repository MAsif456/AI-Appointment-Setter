import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Notification,
  NotificationDocument,
  NotificationType,
  RelatedEntityType,
} from "../database/schemas/notification.schema";
import { User, UserDocument } from "../database/schemas/user.schema";

const PAGE_SIZE = 20;

/** Maps a notification type to the user preference key that guards it. */
const PREF_KEY: Partial<Record<NotificationType, keyof UserDocument["notificationPreferences"]>> = {
  email_notification: "emailNotifications",
  stalled_conversation: "stalledConversations",
  appointment_reminder: "appointmentReminders",
  escalated_conversation: "escalatedConversations",
  booking_cancelled: "bookingCancelled",
  new_user_joined: "newUserJoined",
};

@Injectable()
export class InboxNotificationService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private prefAllowed(user: UserDocument, type: NotificationType): boolean {
    const prefs = user.notificationPreferences;
    if (!prefs?.generalNotifications) return false;
    const key = PREF_KEY[type];
    if (key && prefs[key] === false) return false;
    return true;
  }

  /** Create a notification for a single user, respecting their preferences. */
  async createForUser(
    userId: string | Types.ObjectId,
    type: NotificationType,
    title: string,
    description: string,
    relatedEntityId?: string,
    relatedEntityType?: RelatedEntityType,
  ): Promise<void> {
    const user = await this.userModel.findById(userId).lean<UserDocument>();
    if (!user || !this.prefAllowed(user as UserDocument, type)) return;
    await this.notificationModel.create({
      userId: new Types.ObjectId(userId.toString()),
      type,
      title,
      description,
      relatedEntityId,
      relatedEntityType,
    });
  }

  /** Create notifications for all active staff assigned to a clinic. */
  async createForClinicStaff(
    clinicId: string | Types.ObjectId,
    type: NotificationType,
    title: string,
    description: string,
    relatedEntityId?: string,
    relatedEntityType?: RelatedEntityType,
  ): Promise<void> {
    const clinicObjectId = new Types.ObjectId(clinicId.toString());
    const staff = await this.userModel
      .find({ assignedClinics: clinicObjectId, isActive: true, role: "staff" })
      .lean<UserDocument[]>();

    await Promise.all(
      staff
        .filter((u) => this.prefAllowed(u as UserDocument, type))
        .map((u) =>
          this.notificationModel.create({
            userId: (u as any)._id,
            type,
            title,
            description,
            relatedEntityId,
            relatedEntityType,
          }),
        ),
    );
  }

  /** Create notifications for all active admins (used for admin-only event types). */
  async createForAdmins(
    type: NotificationType,
    title: string,
    description: string,
    relatedEntityId?: string,
    relatedEntityType?: RelatedEntityType,
  ): Promise<void> {
    const admins = await this.userModel
      .find({ role: "admin", isActive: true })
      .lean<UserDocument[]>();

    await Promise.all(
      admins
        .filter((u) => this.prefAllowed(u as UserDocument, type))
        .map((u) =>
          this.notificationModel.create({
            userId: (u as any)._id,
            type,
            title,
            description,
            relatedEntityId,
            relatedEntityType,
          }),
        ),
    );
  }

  /** Paginated list of a user's non-dismissed notifications, newest first. */
  async findByUser(
    userId: string,
    page = 1,
  ): Promise<{
    notifications: NotificationDocument[];
    total: number;
    totalPages: number;
  }> {
    const filter = {
      userId: new Types.ObjectId(userId),
      dismissedAt: { $exists: false },
    };
    const skip = (page - 1) * PAGE_SIZE;
    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);
    return { notifications, total, totalPages: Math.ceil(total / PAGE_SIZE) };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
      dismissedAt: { $exists: false },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        isRead: false,
        dismissedAt: { $exists: false },
      },
      { isRead: true },
    );
  }

  async dismiss(notificationId: string, userId: string): Promise<void> {
    await this.notificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      },
      { dismissedAt: new Date() },
    );
  }
}
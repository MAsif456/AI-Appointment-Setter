import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { InboxNotificationService } from "./inbox-notification.service";
import { Notification } from "../database/schemas/notification.schema";
import { User } from "../database/schemas/user.schema";

const userId = new Types.ObjectId().toString();
const clinicId = new Types.ObjectId().toString();
const notifId = new Types.ObjectId().toString();

const makeUser = (overrides: Record<string, any> = {}) => ({
  _id: new Types.ObjectId(userId),
  role: "staff",
  isActive: true,
  assignedClinics: [new Types.ObjectId(clinicId)],
  notificationPreferences: {
    generalNotifications: true,
    emailNotifications: true,
    stalledConversations: true,
    appointmentReminders: true,
  },
  ...overrides,
});

const mockNotifModel = {
  create: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
  countDocuments: jest.fn(),
};

const mockUserModel = {
  findById: jest.fn(),
  find: jest.fn(),
};

describe("InboxNotificationService", () => {
  let service: InboxNotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxNotificationService,
        { provide: getModelToken(Notification.name), useValue: mockNotifModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();
    service = module.get(InboxNotificationService);
    jest.clearAllMocks();
  });

  // createForUser
  describe("createForUser", () => {
    it("creates notification when preferences allow", async () => {
      mockUserModel.findById.mockReturnValue({ lean: () => makeUser() });
      mockNotifModel.create.mockResolvedValue({});

      await service.createForUser(userId, "email_notification", "Title", "Desc", "conv_1", "conversation");

      expect(mockNotifModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "email_notification", title: "Title" }),
      );
    });

    it("does not create if generalNotifications is off", async () => {
      mockUserModel.findById.mockReturnValue({
        lean: () => makeUser({ notificationPreferences: { generalNotifications: false } }),
      });
      await service.createForUser(userId, "email_notification", "T", "D");
      expect(mockNotifModel.create).not.toHaveBeenCalled();
    });

    it("does not create if the specific preference is off", async () => {
      mockUserModel.findById.mockReturnValue({
        lean: () =>
          makeUser({
            notificationPreferences: {
              generalNotifications: true,
              stalledConversations: false,
            },
          }),
      });
      await service.createForUser(userId, "stalled_conversation", "T", "D");
      expect(mockNotifModel.create).not.toHaveBeenCalled();
    });

    it("does not create if user not found", async () => {
      mockUserModel.findById.mockReturnValue({ lean: () => null });
      await service.createForUser(userId, "email_notification", "T", "D");
      expect(mockNotifModel.create).not.toHaveBeenCalled();
    });
  });

  // createForClinicStaff
  describe("createForClinicStaff", () => {
    it("creates notifications for all eligible staff", async () => {
      const staff = [makeUser(), makeUser({ _id: new Types.ObjectId() })];
      mockUserModel.find.mockReturnValue({ lean: () => staff });
      mockNotifModel.create.mockResolvedValue({});

      await service.createForClinicStaff(clinicId, "email_notification", "T", "D");

      expect(mockNotifModel.create).toHaveBeenCalledTimes(2);
    });

    it("skips staff with generalNotifications off", async () => {
      const staff = [
        makeUser({ notificationPreferences: { generalNotifications: false } }),
        makeUser({ _id: new Types.ObjectId() }),
      ];
      mockUserModel.find.mockReturnValue({ lean: () => staff });
      mockNotifModel.create.mockResolvedValue({});

      await service.createForClinicStaff(clinicId, "email_notification", "T", "D");

      expect(mockNotifModel.create).toHaveBeenCalledTimes(1);
    });
  });

  // findByUser
  describe("findByUser", () => {
    it("returns paginated notifications sorted newest first", async () => {
      const notifs = [{ _id: notifId, title: "Test" }];
      mockNotifModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(notifs),
      });
      mockNotifModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      const result = await service.findByUser(userId, 1);

      expect(result.notifications).toEqual(notifs);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  // getUnreadCount
  describe("getUnreadCount", () => {
    it("returns count of unread, non-dismissed notifications", async () => {
      mockNotifModel.countDocuments.mockResolvedValue(3);
      const count = await service.getUnreadCount(userId);
      expect(count).toBe(3);
      expect(mockNotifModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: false }),
      );
    });
  });

  // markAsRead
  describe("markAsRead", () => {
    it("sets isRead to true for the matching notification", async () => {
      mockNotifModel.findOneAndUpdate.mockResolvedValue({});
      await service.markAsRead(notifId, userId);
      expect(mockNotifModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.any(Types.ObjectId) }),
        { isRead: true },
      );
    });
  });

  // markAllAsRead
  describe("markAllAsRead", () => {
    it("updates all unread non-dismissed notifications", async () => {
      mockNotifModel.updateMany.mockResolvedValue({ modifiedCount: 5 });
      await service.markAllAsRead(userId);
      expect(mockNotifModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: false }),
        { isRead: true },
      );
    });
  });

  // dismiss
  describe("dismiss", () => {
    it("sets dismissedAt for the matching notification", async () => {
      mockNotifModel.findOneAndUpdate.mockResolvedValue({});
      await service.dismiss(notifId, userId);
      expect(mockNotifModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.any(Types.ObjectId) }),
        expect.objectContaining({ dismissedAt: expect.any(Date) }),
      );
    });
  });
});
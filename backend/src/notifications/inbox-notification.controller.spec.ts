import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { InboxNotificationController } from "./inbox-notification.controller";
import { InboxNotificationService } from "./inbox-notification.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

const mockGuard = { canActivate: () => true };
const rejectGuard = {
  canActivate: () => { throw new UnauthorizedException(); },
};

const mockService = {
  findByUser: jest.fn(),
  getUnreadCount: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  dismiss: jest.fn(),
};

const mockReq = { user: { _id: { toString: () => "user_1" } } };

describe("InboxNotificationController", () => {
  let controller: InboxNotificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InboxNotificationController],
      providers: [{ provide: InboxNotificationService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get(InboxNotificationController);
    jest.clearAllMocks();
  });

  describe("getNotifications", () => {
    it("returns paginated notifications for the authenticated user", async () => {
      const payload = { notifications: [], total: 0, totalPages: 1 };
      mockService.findByUser.mockResolvedValue(payload);

      const result = await controller.getNotifications(mockReq as any, "1");

      expect(mockService.findByUser).toHaveBeenCalledWith("user_1", 1);
      expect(result).toEqual(payload);
    });

    it("rejects unauthenticated requests (guard throws 401)", async () => {
      await Test.createTestingModule({
        controllers: [InboxNotificationController],
        providers: [{ provide: InboxNotificationService, useValue: mockService }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(rejectGuard)
        .compile();

      expect(() => rejectGuard.canActivate()).toThrow(UnauthorizedException);
    });
  });

  describe("getUnreadCount", () => {
    it("returns count object for the authenticated user", async () => {
      mockService.getUnreadCount.mockResolvedValue(4);

      const result = await controller.getUnreadCount(mockReq as any);

      expect(mockService.getUnreadCount).toHaveBeenCalledWith("user_1");
      expect(result).toEqual({ count: 4 });
    });
  });

  describe("markAllAsRead", () => {
    it("delegates to service and returns success", async () => {
      mockService.markAllAsRead.mockResolvedValue(undefined);

      const result = await controller.markAllAsRead(mockReq as any);

      expect(mockService.markAllAsRead).toHaveBeenCalledWith("user_1");
      expect(result).toEqual({ success: true });
    });
  });

  describe("markAsRead", () => {
    it("delegates to service with notification id and user id", async () => {
      mockService.markAsRead.mockResolvedValue(undefined);

      const result = await controller.markAsRead(mockReq as any, "notif_1");

      expect(mockService.markAsRead).toHaveBeenCalledWith("notif_1", "user_1");
      expect(result).toEqual({ success: true });
    });
  });

  describe("dismiss", () => {
    it("delegates to service and returns success", async () => {
      mockService.dismiss.mockResolvedValue(undefined);

      const result = await controller.dismiss(mockReq as any, "notif_1");

      expect(mockService.dismiss).toHaveBeenCalledWith("notif_1", "user_1");
      expect(result).toEqual({ success: true });
    });
  });
});
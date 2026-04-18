import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NotificationsController } from "./notifications.controller";
import { NotificationBusService, EscalationEvent } from "./notification-bus.service";
import { firstValueFrom, take, toArray } from "rxjs";

describe("NotificationsController", () => {
  let controller: NotificationsController;
  let bus: NotificationBusService;
  let mockJwt: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    mockJwt = {
      sign: jest.fn().mockReturnValue("signed-token"),
      verify: jest.fn().mockReturnValue({
        sub: "user_1",
        scope: "notifications-stream",
        role: "staff",
        assignedClinics: ["clinic_1"],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationBusService,
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    bus = module.get(NotificationBusService);
    controller = module.get(NotificationsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe("GET /stream-token", () => {
    it("returns a signed token for a staff user", async () => {
      const req = {
        user: {
          _id: "user_1",
          role: "staff",
          assignedClinics: ["clinic_1"],
        },
      };
      const result = await controller.getStreamToken(req);

      expect(result).toEqual({
        token: "signed-token",
        expiresInSec: 60,
      });
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: "user_1",
          scope: "notifications-stream",
          role: "staff",
          assignedClinics: ["clinic_1"],
        }),
        { expiresIn: "60s" },
      );
    });

    it("throws ForbiddenException for admin users", async () => {
      const req = {
        user: { _id: "admin_1", role: "admin", assignedClinics: [] },
      };
      await expect(controller.getStreamToken(req)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("SSE /stream", () => {
    it("throws UnauthorizedException when token is missing", () => {
      expect(() => controller.stream("")).toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when token is invalid", () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });
      expect(() => controller.stream("bad-token")).toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException when scope is wrong", () => {
      mockJwt.verify.mockReturnValue({
        sub: "user_1",
        scope: "wrong-scope",
        role: "staff",
        assignedClinics: [],
      });
      expect(() => controller.stream("token")).toThrow(
        UnauthorizedException,
      );
    });

    it("throws ForbiddenException for admin role", () => {
      mockJwt.verify.mockReturnValue({
        sub: "admin_1",
        scope: "notifications-stream",
        role: "admin",
        assignedClinics: [],
      });
      expect(() => controller.stream("token")).toThrow(ForbiddenException);
    });

    it("filters events by assignedClinics", async () => {
      const observable = controller.stream("valid-token");

      const collected = firstValueFrom(
        observable.pipe(
          // Take only real escalation events (skip heartbeats).
          take(2),
          toArray(),
        ),
      );

      // Publish one matching and one non-matching event.
      const matching: EscalationEvent = {
        id: "e1",
        conversationId: "c1",
        leadId: "l1",
        leadName: "Jane Doe",
        leadPhone: "+44",
        clinicId: "clinic_1",
        clinicName: "Clinic One",
        trigger: "abuse",
        reason: "test",
        createdAt: new Date().toISOString(),
      };
      const nonMatching = { ...matching, id: "e2", clinicId: "clinic_999" };
      const matching2 = { ...matching, id: "e3" };

      bus.publish(matching);
      bus.publish(nonMatching);
      bus.publish(matching2);

      const results = await collected;
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(
        expect.objectContaining({ type: "escalation" }),
      );
      expect((results[0] as any).data.clinicId).toBe("clinic_1");
    });

    it("emits nothing for staff with zero assignedClinics", async () => {
      mockJwt.verify.mockReturnValue({
        sub: "user_2",
        scope: "notifications-stream",
        role: "staff",
        assignedClinics: [],
      });

      const observable = controller.stream("token");
      const collected: any[] = [];

      const sub = observable.subscribe((event) => {
        if ((event as any).type === "escalation") collected.push(event);
      });

      bus.publish({
        id: "e1",
        conversationId: "c1",
        leadId: "l1",
        leadName: "Jane",
        leadPhone: "",
        clinicId: "clinic_1",
        clinicName: "Clinic",
        trigger: "abuse",
        reason: "test",
        createdAt: new Date().toISOString(),
      });

      // Allow any micro-task to run.
      await new Promise((r) => setTimeout(r, 50));
      sub.unsubscribe();
      expect(collected).toHaveLength(0);
    });

    it("handles missing assignedClinics in token payload", () => {
      mockJwt.verify.mockReturnValue({
        sub: "user_1",
        scope: "notifications-stream",
        role: "staff",
        // assignedClinics is undefined
      });

      // Should not throw — falls back to empty set
      const observable = controller.stream("token");
      expect(observable).toBeDefined();
    });
  });
});

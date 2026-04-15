import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { AnalyticsService } from "./analytics.service";
import { SecurityEvent } from "./schemas/security-event.schema";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let module: TestingModule;
  let mockModel: Record<string, jest.Mock>;

  afterAll(async () => {
    await module.close();
  });

  const mockEvents = [
    {
      eventType: "rate_limit_exceeded",
      ip: "192.168.1.1",
      endpoint: "/conversations",
      tier: "read",
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    mockModel = {
      create: jest.fn().mockResolvedValue(mockEvents[0]),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockEvents),
            }),
          }),
        }),
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getModelToken(SecurityEvent.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  // --- logSecurityEvent ---

  describe("logSecurityEvent", () => {
    it("should create a security event document", async () => {
      const event = {
        eventType: "rate_limit_exceeded",
        ip: "192.168.1.1",
        endpoint: "/conversations",
        tier: "read",
      };

      await service.logSecurityEvent(event);

      expect(mockModel.create).toHaveBeenCalledWith(event);
    });

    it("should not throw when the database fails (fail-silent)", async () => {
      mockModel.create.mockRejectedValue(new Error("DB error"));
      jest.spyOn(service["logger"], "warn").mockImplementation();

      await expect(
        service.logSecurityEvent({
          eventType: "test",
          ip: "1.2.3.4",
          endpoint: "/test",
        }),
      ).resolves.toBeUndefined();
    });

    it("should log a warning when creation fails", async () => {
      mockModel.create.mockRejectedValue(new Error("DB timeout"));
      const warnSpy = jest
        .spyOn(service["logger"], "warn")
        .mockImplementation();

      await service.logSecurityEvent({
        eventType: "test",
        ip: "1.2.3.4",
        endpoint: "/test",
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("DB timeout"),
      );
    });
  });

  // --- getSecurityEvents ---

  describe("getSecurityEvents", () => {
    it("should return events sorted by newest first", async () => {
      const result = await service.getSecurityEvents({});
      expect(result).toEqual(mockEvents);
    });

    it("should filter by eventType when provided", async () => {
      await service.getSecurityEvents({ eventType: "login_failed" });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "login_failed" }),
      );
    });

    it("should filter by IP when provided", async () => {
      await service.getSecurityEvents({ ip: "10.0.0.1" });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ ip: "10.0.0.1" }),
      );
    });

    it("should filter by email when provided", async () => {
      await service.getSecurityEvents({ email: "test@example.com" });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@example.com" }),
      );
    });

    it("should filter by date range when provided", async () => {
      const from = new Date("2026-01-01");
      const to = new Date("2026-12-31");

      await service.getSecurityEvents({ from, to });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: { $gte: from, $lte: to },
        }),
      );
    });

    it("should default to limit of 50", async () => {
      await service.getSecurityEvents({});

      const sortReturn = mockModel.find().sort();
      expect(sortReturn.limit).toHaveBeenCalledWith(50);
    });

    it("should use custom limit when provided", async () => {
      await service.getSecurityEvents({ limit: 10 });

      const sortReturn = mockModel.find().sort();
      expect(sortReturn.limit).toHaveBeenCalledWith(10);
    });
  });
});

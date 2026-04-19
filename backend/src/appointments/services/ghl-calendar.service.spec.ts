import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { of, throwError } from "rxjs";
import { GHLCalendarService } from "./ghl-calendar.service";
import { AxiosResponse } from "axios";

const TEST_API_KEY = "test-clinic-api-key";

describe("GHLCalendarService", () => {
  let service: GHLCalendarService;

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GHLCalendarService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<GHLCalendarService>(GHLCalendarService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchAvailableSlots - Real GHL API", () => {
    it("should parse GHL response correctly with 30-minute appointment duration", async () => {
      const mockGHLResponse = {
        '2026-03-25': {
          slots: [
            '2026-03-25T08:00:00Z',
            '2026-03-25T08:10:00Z',
            '2026-03-25T08:20:00Z',
          ],
        },
        '2026-03-26': {
          slots: ['2026-03-26T09:00:00Z'],
        },
        traceId: 'test-trace-id',
      };

      const axiosResponse: AxiosResponse = {
        data: mockGHLResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.fetchAvailableSlots(
        TEST_API_KEY,
        "cal_123",
        new Date("2026-03-25"),
        new Date("2026-03-27"),
        30,
      );

      expect(result.length).toBe(4);

      // Check first slot
      expect(result[0].id).toContain("ghl_slot_");
      expect(result[0].startTime).toBe("2026-03-25T08:00:00.000Z");
      expect(result[0].available).toBe(true);

      const start = new Date(result[0].startTime);
      const end = new Date(result[0].endTime);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);
      expect(duration).toBe(30);
    });

    it("should ignore traceId in response", async () => {
      const mockGHLResponse = {
        "2026-03-25": {
          slots: ["2026-03-25T08:00:00Z"],
        },
        traceId: "should-be-ignored",
      };

      const axiosResponse: AxiosResponse = {
        data: mockGHLResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.fetchAvailableSlots(
        TEST_API_KEY,
        "cal_123",
        new Date("2026-03-25"),
        new Date("2026-03-26"),
        30,
      );
      expect(result.length).toBe(1);
    });

    it("should handle empty slots array", async () => {
      const mockGHLResponse = {
        "2026-03-25": {
          slots: [],
        },
        traceId: "test",
      };

      const axiosResponse: AxiosResponse = {
        data: mockGHLResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.fetchAvailableSlots(
        TEST_API_KEY,
        "cal_123",
        new Date("2026-03-25"),
        new Date("2026-03-26"),
        30,
      );
      expect(result).toEqual([]);
    });

    it("should handle response with null dayData", async () => {
      const mockGHLResponse = {
        "2026-03-25": null, // null dayData
        "2026-03-26": {
          slots: ["2026-03-26T09:00:00Z"],
        },
        traceId: "test",
      };

      const axiosResponse: AxiosResponse = {
        data: mockGHLResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.fetchAvailableSlots(
        TEST_API_KEY,
        "cal_123",
        new Date("2026-03-25"),
        new Date("2026-03-27"),
        30,
      );

      // Should only have 1 slot from 2026-03-26 (null dayData is skipped)
      expect(result.length).toBe(1);
      expect(result[0].startTime).toBe("2026-03-26T09:00:00.000Z");
    });

    it("should handle response with missing slots property", async () => {
      const mockGHLResponse = {
        "2026-03-25": {
          // No slots property
          someOtherData: "test",
        },
        "2026-03-26": {
          slots: ["2026-03-26T09:00:00Z"],
        },
        traceId: "test",
      };

      const axiosResponse: AxiosResponse = {
        data: mockGHLResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.fetchAvailableSlots(
        TEST_API_KEY,
        "cal_123",
        new Date("2026-03-25"),
        new Date("2026-03-27"),
        30,
      );

      // Should only have 1 slot from 2026-03-26 (missing slots is skipped)
      expect(result.length).toBe(1);
      expect(result[0].startTime).toBe("2026-03-26T09:00:00.000Z");
    });

    it("should handle response with non-array slots", async () => {
      const mockGHLResponse = {
        "2026-03-25": {
          slots: "not-an-array", // Invalid slots format
        },
        "2026-03-26": {
          slots: ["2026-03-26T09:00:00Z"],
        },
        traceId: "test",
      };

      const axiosResponse: AxiosResponse = {
        data: mockGHLResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.fetchAvailableSlots(
        TEST_API_KEY,
        "cal_123",
        new Date("2026-03-25"),
        new Date("2026-03-27"),
        30,
      );

      // Should only have 1 slot from 2026-03-26 (non-array slots is skipped)
      expect(result.length).toBe(1);
      expect(result[0].startTime).toBe("2026-03-26T09:00:00.000Z");
    });
  });

  describe("fetchAvailableSlots - Error Handling", () => {
    it("should return empty array on API error", async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error("Network error")),
      );

      const result = await service.fetchAvailableSlots(
        TEST_API_KEY,
        "cal_123",
        new Date("2024-03-25"),
        new Date("2024-03-26"),
        30,
      );

      expect(result).toEqual([]);
    });

    it("should return empty array on timeout", async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error("Timeout")),
      );

      const result = await service.fetchAvailableSlots(
        TEST_API_KEY,
        "cal_123",
        new Date("2024-03-25"),
        new Date("2024-03-26"),
        30,
      );

      expect(result).toEqual([]);
    });
  });

  describe("createAppointment", () => {
    it("should create appointment successfully", async () => {
      const mockResponse = {
        id: "appt_123",
        status: "confirmed",
      };

      const axiosResponse: AxiosResponse = {
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.createAppointment(
        TEST_API_KEY,
        "cal_123",
        "contact_123",
        "slot_123",
      );

      expect(result).toEqual({ appointmentId: "appt_123" });
    });

    it("should throw error on API failure", async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error("API error")),
      );

      await expect(
        service.createAppointment(TEST_API_KEY, "cal_123", "contact_123", "slot_123"),
      ).rejects.toThrow("API error");
    });
  });
});

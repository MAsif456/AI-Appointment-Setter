import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { SlotsService } from "./slots.service";
import { GHLCalendarService } from "./ghl-calendar.service";

describe("SlotsService - US-12", () => {
  let service: SlotsService;

  const mockClinicModel = {
    findById: jest.fn(),
  };

  const mockGHLCalendarService = {
    fetchAvailableSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotsService,
        { provide: getModelToken("Clinic"), useValue: mockClinicModel },
        { provide: GHLCalendarService, useValue: mockGHLCalendarService },
      ],
    }).compile();

    service = module.get<SlotsService>(SlotsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockClinic = {
    _id: new Types.ObjectId().toString(),
    ghlCalendarId: "cal_123",
    ghlApiKey: "api_key",
    defaultAppointmentDuration: 30,
    businessHours: [
      {
        day: "monday",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
      },
      {
        day: "tuesday",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
      },
      {
        day: "wednesday",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
      },
      {
        day: "thursday",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
      },
      {
        day: "friday",
        isOpen: true,
        openTime: "09:00",
        closeTime: "17:00",
      },
      {
        day: "saturday",
        isOpen: false,
      },
      {
        day: "sunday",
        isOpen: false,
      },
    ],
  };

  describe("fetchAvailableSlots", () => {
    it("should return empty array if clinic not found", async () => {
      mockClinicModel.findById.mockResolvedValue(null);

      const result = await service.fetchAvailableSlots(
        "invalid",
        new Date(),
        new Date(),
      );

      expect(result).toEqual([]);
    });

    it("should return empty array if no GHL slots available", async () => {
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue([]);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date(),
        new Date(),
      );

      expect(result).toEqual([]);
    });

    it("should return empty array if GHL returns null", async () => {
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(null);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date(),
        new Date(),
      );

      expect(result).toEqual([]);
    });

    it("should throw CalendarUnavailableError on GHL API failure", async () => {
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockRejectedValue(
        new Error("API Error"),
      );

      await expect(
        service.fetchAvailableSlots(mockClinic._id, new Date(), new Date()),
      ).rejects.toThrow("GHL Calendar unavailable: API Error");
    });

    it("should filter slots before business hours", async () => {
      const mockGHLSlots = [
        {
          id: "1",
          startTime: "2024-03-25T08:00:00Z", // Before 09:00
          endTime: "2024-03-25T08:30:00Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-25"),
        new Date("2024-03-26"),
      );

      expect(result).toEqual([]);
    });

    it("should filter slots after business hours", async () => {
      const mockGHLSlots = [
        {
          id: "1",
          startTime: "2024-03-25T18:00:00Z", // After 17:00
          endTime: "2024-03-25T18:30:00Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-25"),
        new Date("2024-03-26"),
      );

      expect(result).toEqual([]);
    });

    it("should filter slots on closed days (Saturday)", async () => {
      const mockGHLSlots = [
        {
          id: "1",
          startTime: "2024-03-30T10:00:00Z", // Saturday
          endTime: "2024-03-30T10:30:00Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-30"),
        new Date("2024-03-31"),
      );

      expect(result).toEqual([]);
    });

    it("should filter slots on closed days (Sunday)", async () => {
      const mockGHLSlots = [
        {
          id: "1",
          startTime: "2024-03-31T10:00:00Z", // Sunday
          endTime: "2024-03-31T10:30:00Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-31"),
        new Date("2024-04-01"),
      );

      expect(result).toEqual([]);
    });

    it("should filter slots when business hours missing openTime", async () => {
      const clinicWithMissingHours = {
        ...mockClinic,
        businessHours: [
          {
            day: "monday",
            isOpen: true,
            openTime: undefined,
            closeTime: "17:00",
          },
        ],
      };

      const mockGHLSlots = [
        {
          id: "1",
          startTime: "2024-03-25T10:00:00Z",
          endTime: "2024-03-25T10:30:00Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(clinicWithMissingHours);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-25"),
        new Date("2024-03-26"),
      );

      expect(result).toEqual([]);
    });

    it("should filter slots when business hours missing closeTime", async () => {
      const clinicWithMissingHours = {
        ...mockClinic,
        businessHours: [
          {
            day: "monday",
            isOpen: true,
            openTime: "09:00",
            closeTime: undefined,
          },
        ],
      };

      const mockGHLSlots = [
        {
          id: "1",
          startTime: "2024-03-25T10:00:00Z",
          endTime: "2024-03-25T10:30:00Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(clinicWithMissingHours);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-25"),
        new Date("2024-03-26"),
      );

      expect(result).toEqual([]);
    });

    it("should filter slots using UTC time (fixes timezone bug)", async () => {
      const mockGHLSlots = [
        {
          id: "1",
          // 16:30 UTC should pass (within 09:00-17:00 UTC business hours)
          startTime: "2024-03-25T16:30:00.000Z",
          endTime: "2024-03-25T17:00:00.000Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-25"),
        new Date("2024-03-26"),
      );

      // Should pass because we're using UTC time
      expect(result.length).toBe(1);
    });

    it("should format slots correctly", async () => {
      const mockGHLSlots = [
        {
          id: "1",
          startTime: "2024-03-25T14:00:00Z",
          endTime: "2024-03-25T14:30:00Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-25"),
        new Date("2024-03-26"),
      );

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("startTime");
      expect(result[0]).toHaveProperty("endTime");
      expect(result[0]).toHaveProperty("dateTime");
      expect(result[0].date).toBe("2024-03-25");
      expect(typeof result[0].startTime).toBe("string");
      expect(typeof result[0].endTime).toBe("string");
      expect(result[0].dateTime).toBeInstanceOf(Date);
    });

    it("should return valid slots within business hours", async () => {
      const mockGHLSlots = [
        {
          id: "1",
          startTime: "2024-03-25T10:00:00Z",
          endTime: "2024-03-25T10:30:00Z",
          available: true,
        },
        {
          id: "2",
          startTime: "2024-03-25T14:00:00Z",
          endTime: "2024-03-25T14:30:00Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-25"),
        new Date("2024-03-26"),
      );

      expect(result.length).toBe(2);
    });

    it("should handle mixed valid and invalid slots", async () => {
      const mockGHLSlots = [
        {
          id: "1",
          startTime: "2024-03-25T08:00:00Z", // Before hours - invalid
          endTime: "2024-03-25T08:30:00Z",
          available: true,
        },
        {
          id: "2",
          startTime: "2024-03-25T10:00:00Z", // Valid
          endTime: "2024-03-25T10:30:00Z",
          available: true,
        },
        {
          id: "3",
          startTime: "2024-03-25T18:00:00Z", // After hours - invalid
          endTime: "2024-03-25T18:30:00Z",
          available: true,
        },
        {
          id: "4",
          startTime: "2024-03-25T14:00:00Z", // Valid (duration no longer filtered)
          endTime: "2024-03-25T14:15:00Z",
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(
        mockGHLSlots,
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date("2024-03-25"),
        new Date("2024-03-26"),
      );

      // Slots 2 and 4 should pass (duration filter removed)
      expect(result.length).toBe(2);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { SlotProvider } from "./slot-provider";
import { SlotsService } from "../appointments/services/slots.service";

describe("SlotProvider", () => {
  let provider: SlotProvider;

  const mockSlotsService = {
    fetchAvailableSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotProvider,
        { provide: SlotsService, useValue: mockSlotsService },
      ],
    }).compile();

    provider = module.get<SlotProvider>(SlotProvider);
    jest.clearAllMocks();
  });

  it("should return mapped slots when GHL returns data", async () => {
    mockSlotsService.fetchAvailableSlots.mockResolvedValue([
      {
        date: "2026-03-23",
        startTime: "09:00",
        endTime: "09:30",
        dateTime: new Date(),
      },
      {
        date: "2026-03-24",
        startTime: "10:00",
        endTime: "10:30",
        dateTime: new Date(),
      },
    ]);

    const result = await provider.getAvailableSlots("clinic_001");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({
      date: "2026-03-23",
      startTime: "09:00",
      endTime: "09:30",
      isoDateTime: expect.any(String),
    }));
    expect(result[1]).toEqual(expect.objectContaining({
      date: "2026-03-24",
      startTime: "10:00",
      endTime: "10:30",
      isoDateTime: expect.any(String),
    }));
  });

  it("should call SlotsService with clinicId and a 31-day date range", async () => {
    mockSlotsService.fetchAvailableSlots.mockResolvedValue([]);

    await provider.getAvailableSlots("clinic_001");

    expect(mockSlotsService.fetchAvailableSlots).toHaveBeenCalledTimes(1);
    const [clinicId, startDate, endDate] =
      mockSlotsService.fetchAvailableSlots.mock.calls[0];
    expect(clinicId).toBe("clinic_001");
    expect(startDate).toBeInstanceOf(Date);
    expect(endDate).toBeInstanceOf(Date);

    // End date should be ~31 days after start date (default fetch window)
    const diffDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(31, 0);
  });

  it("should return empty array when GHL returns empty array", async () => {
    mockSlotsService.fetchAvailableSlots.mockResolvedValue([]);

    const result = await provider.getAvailableSlots("clinic_001");

    expect(result).toHaveLength(0);
  });

  it("should return empty array when GHL returns null", async () => {
    mockSlotsService.fetchAvailableSlots.mockResolvedValue(null);

    const result = await provider.getAvailableSlots("clinic_001");

    expect(result).toHaveLength(0);
  });

  it("should return empty array when SlotsService throws an error", async () => {
    mockSlotsService.fetchAvailableSlots.mockRejectedValue(
      new Error("GHL API timeout"),
    );

    const result = await provider.getAvailableSlots("clinic_001");

    expect(result).toHaveLength(0);
  });

  it("should map dateTime to isoDateTime and not expose the raw Date object", async () => {
    const mockDate = new Date("2026-03-23T09:00:00.000Z");
    mockSlotsService.fetchAvailableSlots.mockResolvedValue([
      {
        date: "2026-03-23",
        startTime: "09:00",
        endTime: "09:30",
        dateTime: mockDate,
      },
    ]);

    const result = await provider.getAvailableSlots("clinic_001");

    // dateTime (Date object) is not exposed; isoDateTime (UTC ISO string) is
    expect(result[0]).not.toHaveProperty("dateTime");
    expect(result[0].isoDateTime).toBe(mockDate.toISOString());
  });

  describe("4-month GHL booking limit", () => {
    it("should return empty when requested start is beyond 4 months", async () => {
      const farFuture = new Date();
      farFuture.setMonth(farFuture.getMonth() + 5);
      const farEnd = new Date(farFuture);
      farEnd.setDate(farFuture.getDate() + 7);

      const result = await provider.getAvailableSlots(
        "clinic_001",
        farFuture,
        farEnd,
      );

      expect(result).toHaveLength(0);
      expect(mockSlotsService.fetchAvailableSlots).not.toHaveBeenCalled();
    });

    it("should clamp end date to 4-month limit when end date exceeds it", async () => {
      mockSlotsService.fetchAvailableSlots.mockResolvedValue([]);

      const start = new Date();
      const farEnd = new Date();
      farEnd.setMonth(farEnd.getMonth() + 6);

      await provider.getAvailableSlots("clinic_001", start, farEnd);

      expect(mockSlotsService.fetchAvailableSlots).toHaveBeenCalledTimes(1);
      const [, , endDate] = mockSlotsService.fetchAvailableSlots.mock.calls[0];
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + SlotProvider.MAX_ADVANCE_MONTHS);
      maxDate.setDate(maxDate.getDate() + 1);
      // End date should be clamped to ~4 months
      expect(endDate.getTime()).toBeLessThanOrEqual(maxDate.getTime());
    });

    it("should pass through dates within the 4-month limit unchanged", async () => {
      mockSlotsService.fetchAvailableSlots.mockResolvedValue([]);

      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 2);

      await provider.getAvailableSlots("clinic_001", start, end);

      const [, , endDate] = mockSlotsService.fetchAvailableSlots.mock.calls[0];
      // Should be approximately 2 months from now (not clamped)
      const diffMs = endDate.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(50); // ~2 months
      expect(diffDays).toBeLessThan(70);
    });

    it("exposes MAX_ADVANCE_MONTHS as 4", () => {
      expect(SlotProvider.MAX_ADVANCE_MONTHS).toBe(4);
    });
  });
});

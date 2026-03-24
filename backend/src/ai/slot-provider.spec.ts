import { Test, TestingModule } from '@nestjs/testing';
import { SlotProvider } from './slot-provider';
import { SlotsService } from '../appointments/services/slots.service';

describe('SlotProvider', () => {
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

  it('should return mapped slots when GHL returns data', async () => {
    mockSlotsService.fetchAvailableSlots.mockResolvedValue([
      { date: '2026-03-23', startTime: '09:00', endTime: '09:30', dateTime: new Date() },
      { date: '2026-03-24', startTime: '10:00', endTime: '10:30', dateTime: new Date() },
    ]);

    const result = await provider.getAvailableSlots('clinic_001');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: '2026-03-23', startTime: '09:00', endTime: '09:30' });
    expect(result[1]).toEqual({ date: '2026-03-24', startTime: '10:00', endTime: '10:30' });
  });

  it('should call SlotsService with clinicId and a 31-day date range', async () => {
    mockSlotsService.fetchAvailableSlots.mockResolvedValue([]);

    await provider.getAvailableSlots('clinic_001');

    expect(mockSlotsService.fetchAvailableSlots).toHaveBeenCalledTimes(1);
    const [clinicId, startDate, endDate] = mockSlotsService.fetchAvailableSlots.mock.calls[0];
    expect(clinicId).toBe('clinic_001');
    expect(startDate).toBeInstanceOf(Date);
    expect(endDate).toBeInstanceOf(Date);

    // End date should be ~31 days after start date (default fetch window)
    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(31, 0);
  });

  it('should return empty array when GHL returns empty array', async () => {
    mockSlotsService.fetchAvailableSlots.mockResolvedValue([]);

    const result = await provider.getAvailableSlots('clinic_001');

    expect(result).toHaveLength(0);
  });

  it('should return empty array when GHL returns null', async () => {
    mockSlotsService.fetchAvailableSlots.mockResolvedValue(null);

    const result = await provider.getAvailableSlots('clinic_001');

    expect(result).toHaveLength(0);
  });

  it('should return empty array when SlotsService throws an error', async () => {
    mockSlotsService.fetchAvailableSlots.mockRejectedValue(
      new Error('GHL API timeout'),
    );

    const result = await provider.getAvailableSlots('clinic_001');

    expect(result).toHaveLength(0);
  });

  it('should strip the dateTime field from GHL response', async () => {
    mockSlotsService.fetchAvailableSlots.mockResolvedValue([
      { date: '2026-03-23', startTime: '09:00', endTime: '09:30', dateTime: new Date() },
    ]);

    const result = await provider.getAvailableSlots('clinic_001');

    // Should only contain date, startTime, endTime — not dateTime
    expect(result[0]).not.toHaveProperty('dateTime');
  });
});

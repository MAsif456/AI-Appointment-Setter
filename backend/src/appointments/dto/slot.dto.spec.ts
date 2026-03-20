import { SlotDto } from './slot.dto';

describe('SlotDto', () => {
  it('should create a SlotDto instance with correct values', () => {
    const dto: SlotDto = {
      date: '2024-03-25',
      startTime: '14:00',
      endTime: '14:30',
      dateTime: new Date('2024-03-25T14:00:00'),
    };

    // Check all properties are correctly assigned
    expect(dto.date).toBe('2024-03-25');
    expect(dto.startTime).toBe('14:00');
    expect(dto.endTime).toBe('14:30');
    expect(dto.dateTime).toBeInstanceOf(Date);
  });

  it('should allow different valid values', () => {
    const dto: SlotDto = {
      date: '2025-01-01',
      startTime: '09:00',
      endTime: '09:30',
      dateTime: new Date(),
    };

    expect(dto.date).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(typeof dto.startTime).toBe('string');
    expect(typeof dto.endTime).toBe('string');
  });
});
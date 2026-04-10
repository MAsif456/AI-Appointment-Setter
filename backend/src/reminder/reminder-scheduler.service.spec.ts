import { Test, TestingModule } from '@nestjs/testing';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { ReminderService } from './reminder.service';

describe('ReminderSchedulerService', () => {
  let service: ReminderSchedulerService;
  let reminderService: ReminderService;

  const mockReminderService = {
    processReminders: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderSchedulerService,
        {
          provide: ReminderService,
          useValue: mockReminderService,
        },
      ],
    }).compile();

    service = module.get<ReminderSchedulerService>(ReminderSchedulerService);
    reminderService = module.get<ReminderService>(ReminderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleReminderCron', () => {
    it('should process reminders on cron trigger', async () => {
      mockReminderService.processReminders.mockResolvedValue({
        sent: 5,
        failed: 2,
      });

      await service.handleReminderCron();

      expect(mockReminderService.processReminders).toHaveBeenCalled();
    });

    it('should skip execution if already processing', async () => {
      // Set isProcessing to true by starting a long-running process
      mockReminderService.processReminders.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ sent: 0, failed: 0 }), 100)),
      );

      // Start first execution (don't await)
      const firstExecution = service.handleReminderCron();

      // Try second execution immediately
      await service.handleReminderCron();

      // Wait for first to complete
      await firstExecution;

      // Should only be called once (second was skipped)
      expect(mockReminderService.processReminders).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      mockReminderService.processReminders.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      await expect(service.handleReminderCron()).resolves.not.toThrow();
    });
  });

  describe('triggerManually', () => {
    it('should manually trigger reminder processing', async () => {
      mockReminderService.processReminders.mockResolvedValue({
        sent: 3,
        failed: 1,
      });

      const result = await service.triggerManually();

      expect(result).toEqual({ sent: 3, failed: 1 });
      expect(mockReminderService.processReminders).toHaveBeenCalled();
    });

    it('should propagate errors from manual trigger', async () => {
      mockReminderService.processReminders.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(service.triggerManually()).rejects.toThrow(
        'Service unavailable',
      );
    });
  });
});
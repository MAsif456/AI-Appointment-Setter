import { Test, TestingModule } from '@nestjs/testing';
import { ReminderController } from './reminder.controller';
import { ReminderSchedulerService } from './reminder-scheduler.service';

describe('ReminderController', () => {
  let controller: ReminderController;
  let schedulerService: ReminderSchedulerService;

  const mockSchedulerService = {
    triggerManually: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReminderController],
      providers: [
        {
          provide: ReminderSchedulerService,
          useValue: mockSchedulerService,
        },
      ],
    }).compile();

    controller = module.get<ReminderController>(ReminderController);
    schedulerService = module.get<ReminderSchedulerService>(
      ReminderSchedulerService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerReminders', () => {
    it('should successfully trigger reminders', async () => {
      mockSchedulerService.triggerManually.mockResolvedValue({
        sent: 3,
        failed: 1,
      });

      const result = await controller.triggerReminders();

      expect(result).toEqual({
        success: true,
        message: 'Reminders processed successfully',
        sent: 3,
        failed: 1,
      });
      expect(mockSchedulerService.triggerManually).toHaveBeenCalled();
    });

    it('should handle trigger failures gracefully', async () => {
      mockSchedulerService.triggerManually.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = await controller.triggerReminders();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to process reminders');
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('getStatus', () => {
    it('should return cron job status', async () => {
      const result = await controller.getStatus();

      expect(result).toEqual({
        success: true,
        cronPattern: '*/15 * * * *',
        description: 'Runs every 15 minutes',
        timezone: 'Europe/London',
      });
    });
  });
});
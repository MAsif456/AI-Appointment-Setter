import { Controller, Post, Get, Logger } from '@nestjs/common';
import { ReminderSchedulerService } from './reminder-scheduler.service';

/**
 * Controller for reminder management endpoints.
 * Provides manual trigger and status endpoints for testing.
 */
@Controller('reminders')
export class ReminderController {
  private readonly logger = new Logger(ReminderController.name);

  constructor(
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  /**
   * Manually trigger reminder processing.
   * POST /reminders/trigger
   * Useful for testing or immediate execution.
   */
  @Post('trigger')
  async triggerReminders() {
    this.logger.log('Manual reminder trigger requested via API');

    try {
      const result = await this.reminderScheduler.triggerManually();

      return {
        success: true,
        message: 'Reminders processed successfully',
        sent: result.sent,
        failed: result.failed,
      };
    } catch (error) {
      this.logger.error(`Manual trigger failed: ${error.message}`);

      return {
        success: false,
        message: 'Failed to process reminders',
        error: error.message,
      };
    }
  }

  /**
   * Get reminder job status.
   * GET /reminders/status
   * Returns information about the scheduled job.
   */
  @Get('status')
  async getStatus() {
    return {
      success: true,
      cronPattern: '*/15 * * * *',
      description: 'Runs every 15 minutes',
      timezone: 'Europe/London',
    };
  }
}
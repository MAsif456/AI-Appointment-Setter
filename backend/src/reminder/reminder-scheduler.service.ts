import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReminderService } from './reminder.service';

/**
 * Scheduler service that runs the reminder job every 15 minutes.
 * AC: Runs every 15 minutes, prevents concurrent executions.
 */
@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);
  private isProcessing = false;

  constructor(private readonly reminderService: ReminderService) {}

  /**
   * Cron job that runs every 15 minutes.
   * AC: Check for appointments needing reminders and process them.
   * Uses isProcessing flag to prevent concurrent executions.
   */
  @Cron('*/15 * * * *', {
    name: 'process-appointment-reminders',
    timeZone: 'Europe/London',
  })
  async handleReminderCron(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn(
        'Previous reminder job still running, skipping this execution',
      );
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting scheduled reminder check...');

      const result = await this.reminderService.processReminders();

      const duration = Date.now() - startTime;

      this.logger.log(
        `Reminder job completed in ${duration}ms. ` +
          `Sent: ${result.sent}, Failed: ${result.failed}`,
      );
    } catch (error) {
      this.logger.error(`Reminder job failed: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manually trigger reminder processing.
   * AC: Useful for testing or on-demand execution via API.
   */
  async triggerManually(): Promise<{ sent: number; failed: number }> {
    this.logger.log('Manual reminder trigger requested');

    try {
      return await this.reminderService.processReminders();
    } catch (error) {
      this.logger.error(`Manual reminder trigger failed: ${error.message}`);
      throw error;
    }
  }
}
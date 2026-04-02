import { Controller, Post } from '@nestjs/common';
import { FollowUpService } from './follow-up.service';

@Controller('dev/follow-up')
export class FollowUpController {
  constructor(private readonly followUpService: FollowUpService) {}

  @Post('trigger')
  async trigger(): Promise<{ triggered: true }> {
    await this.followUpService.checkAndSendFollowUps();
    return { triggered: true };
  }
}

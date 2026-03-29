import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from '../database/schemas/conversation.schema';
import { Appointment, AppointmentSchema } from '../database/schemas/appointment.schema';
import { Clinic, ClinicSchema } from '../database/schemas/clinic.schema';
import { GhlModule } from '../ghl/ghl.module';
import { CancellationService } from './cancellation.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Clinic.name, schema: ClinicSchema },
    ]),
    GhlModule,
  ],
  providers: [CancellationService],
  exports: [CancellationService],
})
export class CancellationModule {}

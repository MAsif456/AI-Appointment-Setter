/**
 * NestJS feature module for UK GDPR compliance.
 *
 * Bundles consent capture, right-to-erasure, automated retention cleanup,
 * and data-access audit logging. Validates the field encryption key at boot
 * Ref: OWASP Key Management Cheat Sheet — "validate key material at startup"
 *   https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
 */
import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConsentRecordEntry, ConsentRecordSchema } from '../database/schemas/consent-record.schema';
import { ErasureRecord, ErasureRecordSchema } from '../database/schemas/erasure-record.schema';
import { Lead, LeadSchema } from '../database/schemas/lead.schema';
import { Conversation, ConversationSchema } from '../database/schemas/conversation.schema';
import { Message, MessageSchema } from '../database/schemas/message.schema';
import { Appointment, AppointmentSchema } from '../database/schemas/appointment.schema';
import { AuditLog, AuditLogSchema } from '../database/schemas/audit-log.schema';
import { Clinic, ClinicSchema } from '../database/schemas/clinic.schema';
import { PatientHistory, PatientHistorySchema } from '../database/schemas/patient-history.schema';
import { ConsentService } from './consent/consent.service';
import { ErasureService } from './erasure/erasure.service';
import { RetentionService } from './retention/retention.service';
import { GdprController } from './gdpr.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConsentRecordEntry.name, schema: ConsentRecordSchema },
      { name: ErasureRecord.name, schema: ErasureRecordSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Clinic.name, schema: ClinicSchema },
      { name: PatientHistory.name, schema: PatientHistorySchema },
    ]),
  ],
  controllers: [GdprController],
  providers: [ConsentService, ErasureService, RetentionService],
  exports: [ConsentService, ErasureService],
})
export class GdprModule implements OnModuleInit {
  private readonly logger = new Logger(GdprModule.name);

/**
 * Validates the FIELD_ENCRYPTION_KEY environment variable on application startup.
 * Logs a warning if the variable is not set, and throws an error if it does not match the
 * expected format of exactly 64 hex characters (32 bytes).
 * If the key is valid, logs a success message indicating that field-level encryption is active.
 */
  onModuleInit(): void {
    const key = process.env.FIELD_ENCRYPTION_KEY;
    if (!key) {
      this.logger.warn(
        'FIELD_ENCRYPTION_KEY is not set — field-level encryption is DISABLED. ' +
        'Set a 64-character hex string in production.',
      );
      return;
    }
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error(
        'FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    this.logger.log('FIELD_ENCRYPTION_KEY validated — field-level encryption is ACTIVE');
  }
}

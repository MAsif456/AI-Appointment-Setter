/**
 * Builds the OrchestratorContext from live conversation state.
 * Extracted from handleInboundMessageFlow to keep that file under 200 lines.
 */
import { Types } from 'mongoose';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { MessagesService } from '../ghl/messages.service';
import { ConversationDocument } from '../database/schemas/conversation.schema';
import { OrchestratorContext, OrchestratorMessage } from './orchestrator.types';

export async function buildInboundContext(
  conversation: ConversationDocument,
  contactId: string,
  clinicConfig: ClinicConfig,
  currentPhase: string,
  conversationObjectId: Types.ObjectId,
  messagesService: MessagesService,
): Promise<OrchestratorContext> {
  const storedMessages = await messagesService.getByConversation(conversationObjectId);
  const messages: OrchestratorMessage[] = storedMessages
    .filter((m) => m.sender !== 'system')
    .map((m) => ({
      content: m.content,
      role: (m.sender === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
      timestamp: (m as any).createdAt ?? new Date(),
    }));

  const ghlApptId = conversation.context?.get('ghlAppointmentId');
  const currentAppointment = ghlApptId
    ? {
        ghlAppointmentId: ghlApptId,
        appointmentDate: conversation.context?.get('appointmentDate') ?? '',
        appointmentTime: conversation.context?.get('appointmentTime') ?? '',
        startTime: conversation.context?.get('appointmentStartTime') ?? '',
      }
    : undefined;

  return {
    ghlContactId: contactId,
    clinicId: clinicConfig.clinicId,
    phase: currentPhase,
    conversationId: conversationObjectId.toHexString(),
    messages,
    patientInfo: { firstName: 'there' },
    currentAppointment,
    isReturningPatient: conversation.isReturningPatient ?? false,
  };
}

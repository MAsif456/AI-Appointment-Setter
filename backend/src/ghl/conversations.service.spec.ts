import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ConversationsService } from './conversations.service';
import { Conversation } from '../database/schemas/conversation.schema';
import { Lead } from '../database/schemas/lead.schema';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let conversationModel: Record<string, jest.Mock>;
  let leadModel: Record<string, jest.Mock>;

  const clinicId = new Types.ObjectId();
  const leadId = new Types.ObjectId();
  const conversationId = new Types.ObjectId();

  beforeEach(async () => {
    conversationModel = {
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      create: jest.fn(),
    };

    leadModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: getModelToken(Conversation.name), useValue: conversationModel },
        { provide: getModelToken(Lead.name), useValue: leadModel },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  describe('findByGhlContactId', () => {
    it('should return a conversation when found', async () => {
      const mockConversation = { _id: conversationId, ghlContactId: 'ghl_contact_1', clinicId };
      conversationModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockConversation) });

      const result = await service.findByGhlContactId('ghl_contact_1', clinicId);

      expect(result).toEqual(mockConversation);
      expect(conversationModel.findOne).toHaveBeenCalledWith({ ghlContactId: 'ghl_contact_1', clinicId });
    });

    it('should return null when no conversation exists', async () => {
      conversationModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      const result = await service.findByGhlContactId('nonexistent', clinicId);

      expect(result).toBeNull();
    });
  });

  describe('createForNewLead', () => {
    it('should create a new lead and conversation when lead does not exist', async () => {
      const mockLead = { _id: leadId, ghlContactId: 'ghl_contact_1' };
      const mockConversation = {
        _id: conversationId,
        clinicId,
        leadId,
        ghlContactId: 'ghl_contact_1',
        phase: 'greeting',
      };

      leadModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      leadModel.create.mockResolvedValue(mockLead);
      conversationModel.create.mockResolvedValue(mockConversation);

      const result = await service.createForNewLead(
        clinicId,
        'ghl_contact_1',
        'ghl_conv_1',
        'sms',
        { firstName: 'John', phone: '+441234567890', leadSource: 'whatsapp_direct' },
      );

      expect(leadModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId,
          firstName: 'John',
          phone: '+441234567890',
          ghlContactId: 'ghl_contact_1',
        }),
      );
      expect(conversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId,
          leadId,
          ghlContactId: 'ghl_contact_1',
          phase: 'greeting',
          channel: 'sms',
        }),
      );
      expect(result).toEqual(mockConversation);
    });

    it('should use existing lead when one already exists', async () => {
      const existingLead = { _id: leadId, ghlContactId: 'ghl_contact_1' };
      const mockConversation = { _id: conversationId, leadId };

      leadModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existingLead) });
      conversationModel.create.mockResolvedValue(mockConversation);

      await service.createForNewLead(
        clinicId,
        'ghl_contact_1',
        'ghl_conv_1',
        'whatsapp',
        { firstName: 'Jane', phone: '+441234567890', leadSource: 'other' },
      );

      expect(leadModel.create).not.toHaveBeenCalled();
      expect(conversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ leadId }),
      );
    });
  });

  describe('findOrCreate', () => {
    it('should return existing conversation if found', async () => {
      const existing = { _id: conversationId, ghlContactId: 'ghl_contact_1' };
      conversationModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      const payload = {
        type: 'InboundMessage',
        locationId: 'loc_1',
        contactId: 'ghl_contact_1',
        conversationId: 'ghl_conv_1',
        messageId: 'msg_1',
        body: 'Hello',
        direction: 'inbound',
        messageType: 'SMS',
      };

      const result = await service.findOrCreate(payload, clinicId);

      expect(result).toEqual(existing);
      expect(conversationModel.create).not.toHaveBeenCalled();
    });

    it('should create a new conversation when none exists', async () => {
      const newConversation = { _id: conversationId, phase: 'greeting' };
      const newLead = { _id: leadId };

      conversationModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      leadModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      leadModel.create.mockResolvedValue(newLead);
      conversationModel.create.mockResolvedValue(newConversation);

      const payload = {
        type: 'InboundMessage',
        locationId: 'loc_1',
        contactId: 'ghl_contact_new',
        conversationId: 'ghl_conv_new',
        messageId: 'msg_1',
        body: 'Hi there',
        direction: 'inbound',
        messageType: 'WhatsApp',
        from: '+441234567890',
      };

      const result = await service.findOrCreate(payload, clinicId);

      expect(result).toEqual(newConversation);
      expect(conversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'greeting', channel: 'whatsapp' }),
      );
    });
  });

  describe('setContext', () => {
    it('should call findByIdAndUpdate with $set for the given key', async () => {
      conversationModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await service.setContext(conversationId, 'validatedPostcode', 'CF10 1AA');

      expect(conversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        conversationId,
        { $set: { 'context.validatedPostcode': 'CF10 1AA' } },
      );
    });
  });

  describe('updatePhase', () => {
    it('should update the conversation phase', async () => {
      const updated = { _id: conversationId, phase: 'qualifying' };
      conversationModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.updatePhase(conversationId, 'qualifying');

      expect(result).toEqual(updated);
      expect(conversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        conversationId,
        { phase: 'qualifying' },
        { new: true },
      );
    });

    it('should return null when conversation does not exist', async () => {
      conversationModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      const result = await service.updatePhase(new Types.ObjectId(), 'qualifying');

      expect(result).toBeNull();
    });
  });

  describe('flagForHumanIntervention', () => {
    it('should set requiresHumanIntervention and reason on the conversation', async () => {
      conversationModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.flagForHumanIntervention(conversationId, 'AI service failure');

      expect(conversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({
          requiresHumanIntervention: true,
          humanInterventionReason: 'AI service failure',
          escalationReason: 'AI service failure',
        }),
      );
    });

    it('should set escalatedAt timestamp', async () => {
      conversationModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.flagForHumanIntervention(conversationId, 'Message delivery failed');

      const call = conversationModel.findByIdAndUpdate.mock.calls[0][1];
      expect(call.escalatedAt).toBeInstanceOf(Date);
    });
  });
});

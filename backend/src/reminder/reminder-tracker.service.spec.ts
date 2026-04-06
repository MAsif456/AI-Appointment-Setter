import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ReminderTrackerService } from './reminder-tracker.service';
import { Appointment } from '../database/schemas/appointment.schema';
import { MessagesService } from '../ghl/messages.service';

describe('ReminderTrackerService', () => {
  let service: ReminderTrackerService;

  const mockAppointmentModel = { updateOne: jest.fn() };
  const mockMessagesService = { addMessage: jest.fn() };

  const conversationId = new Types.ObjectId();
  const clinicId = new Types.ObjectId();
  const leadId = new Types.ObjectId();

  const makeAppointment = (overrides = {}) => ({
    _id: new Types.ObjectId(),
    leadId,
    ...overrides,
  } as any);

  const makeConversation = (channel: 'sms' | 'whatsapp' = 'sms') => ({
    _id: conversationId,
    channel,
  } as any);

  const makeClinic = () => ({
    _id: clinicId,
  } as any);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderTrackerService,
        { provide: getModelToken(Appointment.name), useValue: mockAppointmentModel },
        { provide: MessagesService, useValue: mockMessagesService },
      ],
    }).compile();

    service = module.get<ReminderTrackerService>(ReminderTrackerService);
  });

  afterEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // trackSent
  // ---------------------------------------------------------------------------
  describe('trackSent', () => {
    it('should push a sent reminder entry to the appointment', async () => {
      mockAppointmentModel.updateOne.mockResolvedValue(undefined);
      mockMessagesService.addMessage.mockResolvedValue(undefined);

      const appointment = makeAppointment();
      const conversation = makeConversation('sms');
      const clinic = makeClinic();

      await service.trackSent(appointment, conversation, clinic, '24_hour', 'Reminder: your appointment is tomorrow.');

      expect(mockAppointmentModel.updateOne).toHaveBeenCalledWith(
        { _id: appointment._id },
        {
          $push: {
            reminders: {
              sentAt: expect.any(Date),
              type: '24_hour',
              status: 'sent',
            },
          },
        },
      );
    });

    it('should log the message via MessagesService with correct args', async () => {
      mockAppointmentModel.updateOne.mockResolvedValue(undefined);
      mockMessagesService.addMessage.mockResolvedValue(undefined);

      const appointment = makeAppointment();
      const conversation = makeConversation('whatsapp');
      const clinic = makeClinic();
      const messageContent = 'Reminder: your appointment is in 1 hour.';

      await service.trackSent(appointment, conversation, clinic, '1_hour', messageContent);

      expect(mockMessagesService.addMessage).toHaveBeenCalledWith(
        conversation._id,
        clinic._id,
        appointment.leadId,
        'system',
        messageContent,
        'whatsapp',
      );
    });

    it('should call updateOne before addMessage', async () => {
      const callOrder: string[] = [];
      mockAppointmentModel.updateOne.mockImplementation(() => {
        callOrder.push('updateOne');
        return Promise.resolve(undefined);
      });
      mockMessagesService.addMessage.mockImplementation(() => {
        callOrder.push('addMessage');
        return Promise.resolve(undefined);
      });

      const appointment = makeAppointment();
      await service.trackSent(appointment, makeConversation(), makeClinic(), '24_hour', 'msg');

      expect(callOrder).toEqual(['updateOne', 'addMessage']);
    });

    it('should propagate errors thrown by updateOne', async () => {
      mockAppointmentModel.updateOne.mockRejectedValue(new Error('DB write failed'));

      await expect(
        service.trackSent(makeAppointment(), makeConversation(), makeClinic(), '24_hour', 'msg'),
      ).rejects.toThrow('DB write failed');

      expect(mockMessagesService.addMessage).not.toHaveBeenCalled();
    });

    it('should propagate errors thrown by addMessage', async () => {
      mockAppointmentModel.updateOne.mockResolvedValue(undefined);
      mockMessagesService.addMessage.mockRejectedValue(new Error('Message service error'));

      await expect(
        service.trackSent(makeAppointment(), makeConversation(), makeClinic(), '1_hour', 'msg'),
      ).rejects.toThrow('Message service error');
    });

    it('should use the sms channel from the conversation', async () => {
      mockAppointmentModel.updateOne.mockResolvedValue(undefined);
      mockMessagesService.addMessage.mockResolvedValue(undefined);

      await service.trackSent(makeAppointment(), makeConversation('sms'), makeClinic(), '24_hour', 'msg');

      expect(mockMessagesService.addMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'system',
        'msg',
        'sms',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // trackFailed
  // ---------------------------------------------------------------------------
  describe('trackFailed', () => {
    it('should push a failed reminder entry to the appointment', async () => {
      mockAppointmentModel.updateOne.mockResolvedValue(undefined);

      const appointment = makeAppointment();
      await service.trackFailed(appointment, '24_hour');

      expect(mockAppointmentModel.updateOne).toHaveBeenCalledWith(
        { _id: appointment._id },
        {
          $push: {
            reminders: {
              sentAt: expect.any(Date),
              type: '24_hour',
              status: 'failed',
            },
          },
        },
      );
    });

    it('should record the correct reminderType in the failed entry', async () => {
      mockAppointmentModel.updateOne.mockResolvedValue(undefined);

      const appointment = makeAppointment();
      await service.trackFailed(appointment, '1_hour');

      expect(mockAppointmentModel.updateOne).toHaveBeenCalledWith(
        { _id: appointment._id },
        expect.objectContaining({
          $push: expect.objectContaining({
            reminders: expect.objectContaining({ type: '1_hour', status: 'failed' }),
          }),
        }),
      );
    });

    it('should not call MessagesService', async () => {
      mockAppointmentModel.updateOne.mockResolvedValue(undefined);

      await service.trackFailed(makeAppointment(), '24_hour');

      expect(mockMessagesService.addMessage).not.toHaveBeenCalled();
    });

    it('should propagate errors thrown by updateOne', async () => {
      mockAppointmentModel.updateOne.mockRejectedValue(new Error('DB write failed'));

      await expect(
        service.trackFailed(makeAppointment(), '24_hour'),
      ).rejects.toThrow('DB write failed');
    });
  });
});

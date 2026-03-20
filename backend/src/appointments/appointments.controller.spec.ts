import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService, BookingResult } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let service: { bookAppointment: jest.Mock };

  const mockDto: CreateAppointmentDto = {
    clinicId: '507f1f77bcf86cd799439011',
    contactId: 'ghl_contact_123',
    conversationId: '507f1f77bcf86cd799439012',
    leadId: '507f1f77bcf86cd799439013',
    startTime: '2026-03-17T14:00:00Z',
  };

  beforeEach(async () => {
    service = { bookAppointment: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        { provide: AppointmentsService, useValue: service },
      ],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return successful booking result', async () => {
    const mockResult: BookingResult = {
      success: true,
      appointmentId: '507f1f77bcf86cd799439014',
      ghlAppointmentId: 'ghl_apt_001',
      confirmationMessage: 'Appointment Confirmed!',
    };
    service.bookAppointment.mockResolvedValue(mockResult);

    const result = await controller.bookAppointment(mockDto);

    expect(result).toEqual(mockResult);
    expect(service.bookAppointment).toHaveBeenCalledWith(mockDto);
  });

  it('should return failure when slot is taken', async () => {
    const mockResult: BookingResult = {
      success: false,
      error: 'Slot no longer available',
      slotTaken: true,
    };
    service.bookAppointment.mockResolvedValue(mockResult);

    const result = await controller.bookAppointment(mockDto);

    expect(result.success).toBe(false);
    expect(result.slotTaken).toBe(true);
  });

  it('should return failure when clinic not found', async () => {
    const mockResult: BookingResult = {
      success: false,
      error: 'Clinic not found',
    };
    service.bookAppointment.mockResolvedValue(mockResult);

    const result = await controller.bookAppointment(mockDto);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Clinic not found');
  });
});

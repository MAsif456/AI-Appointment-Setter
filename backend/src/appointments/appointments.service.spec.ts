import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AppointmentsService } from './appointments.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { Appointment } from '../database/schemas/appointment.schema';
import { Clinic } from '../database/schemas/clinic.schema';
import { Conversation } from '../database/schemas/conversation.schema';
import { Lead } from '../database/schemas/lead.schema';
import { PatientHistoryService } from '../patient-history/patient-history.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let appointmentModel: { create: jest.Mock };
  let clinicModel: { findById: jest.Mock };
  let conversationModel: { findByIdAndUpdate: jest.Mock; findById: jest.Mock };
  let leadModel: { findById: jest.Mock };
  let patientHistoryService: { persistHistory: jest.Mock };
  let ghlApiService: { createAppointment: jest.Mock };

  const mockClinic = {
    _id: new Types.ObjectId(),
    name: 'Cardiff Physiotherapy Centre',
    ghlCalendarId: 'cal_123',
    ghlLocationId: 'loc_123',
    ghlApiKey: 'encrypted-key',
    address: '123 Queen Street, Cardiff, CF10 2BX',
    defaultAppointmentDuration: 30,
    itemsToBring: 'Photo ID',
    services: [
      { name: 'Physiotherapy', durationMinutes: 45 },
      { name: 'Consultation', durationMinutes: 20 },
    ],
  };

  const mockEncryptionService = {
    decrypt: jest.fn().mockReturnValue('decrypted-api-key'),
  };

  const mockDto: CreateAppointmentDto = {
    clinicId: mockClinic._id.toString(),
    contactId: 'ghl_contact_123',
    conversationId: new Types.ObjectId().toString(),
    leadId: new Types.ObjectId().toString(),
    startTime: '2026-03-17T14:00:00Z',
  };

  const mockGhlResponse = { id: 'ghl_apt_001' };
  const mockAppointment = { _id: new Types.ObjectId() };

  beforeEach(async () => {
    appointmentModel = {
      create: jest.fn().mockResolvedValue(mockAppointment),
    };
    clinicModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClinic),
      }),
    };
    conversationModel = {
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    };
    leadModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };
    patientHistoryService = { persistHistory: jest.fn().mockResolvedValue(undefined) };
    ghlApiService = {
      createAppointment: jest.fn().mockResolvedValue(mockGhlResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: getModelToken(Appointment.name),
          useValue: appointmentModel,
        },
        { provide: getModelToken(Clinic.name), useValue: clinicModel },
        { provide: getModelToken(Conversation.name), useValue: conversationModel },
        { provide: getModelToken(Lead.name), useValue: leadModel },
        { provide: PatientHistoryService, useValue: patientHistoryService },
        { provide: GhlApiService, useValue: ghlApiService },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  it('should successfully book an appointment', async () => {
    const result = await service.bookAppointment(mockDto);

    expect(result.success).toBe(true);
    expect(result.ghlAppointmentId).toBe("ghl_apt_001");
    expect(result.confirmationMessage).toContain("Appointment Confirmed");
    expect(result.confirmationMessage).toContain(
      "Cardiff Physiotherapy Centre",
    );
    expect(result.appointmentId).toBeDefined();
  });

  it("should call GHL API with correct calendar and location IDs", async () => {
    await service.bookAppointment(mockDto);

    expect(ghlApiService.createAppointment).toHaveBeenCalledWith(
      'decrypted-api-key',
      'cal_123',
      'loc_123',
      'ghl_contact_123',
      '2026-03-17T14:00:00Z',
      expect.any(String),
    );
  });

  it("should calculate end time using default duration (30 min)", async () => {
    await service.bookAppointment(mockDto);

    expect(ghlApiService.createAppointment).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      '2026-03-17T14:00:00Z',
      '2026-03-17T14:30:00.000Z',
    );
  });

  it("should use service-specific duration when serviceType provided", async () => {
    const dto = { ...mockDto, serviceType: "Physiotherapy" };
    await service.bookAppointment(dto);

    expect(ghlApiService.createAppointment).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      '2026-03-17T14:00:00Z',
      '2026-03-17T14:45:00.000Z',
    );
  });

  it("should fall back to default duration for unknown service type", async () => {
    const dto = { ...mockDto, serviceType: "UnknownService" };
    await service.bookAppointment(dto);

    expect(ghlApiService.createAppointment).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      '2026-03-17T14:00:00Z',
      '2026-03-17T14:30:00.000Z',
    );
  });

  it("should store appointment in database with correct fields", async () => {
    await service.bookAppointment(mockDto);

    expect(appointmentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ghlAppointmentId: "ghl_apt_001",
        appointmentTime: "14:00",
        durationMinutes: 30,
        status: "confirmed",
      }),
    );
  });

  it("should update conversation phase to booked", async () => {
    await service.bookAppointment(mockDto);

    expect(conversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockDto.conversationId,
      expect.objectContaining({ phase: "booked" }),
    );
  });

  it("should set appointmentId on conversation", async () => {
    await service.bookAppointment(mockDto);

    expect(conversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockDto.conversationId,
      expect.objectContaining({ appointmentId: mockAppointment._id }),
    );
  });

  it("should return failure for invalid clinic ID", async () => {
    const dto = { ...mockDto, clinicId: "<mongo-clinic-id>" };
    const result = await service.bookAppointment(dto);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid clinic ID");
    expect(clinicModel.findById).not.toHaveBeenCalled();
  });

  it("should return failure when clinic not found", async () => {
    clinicModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    const result = await service.bookAppointment(mockDto);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Clinic not found");
  });

  it("should handle 409 conflict as slot taken", async () => {
    const error = { response: { status: 409 }, message: "Conflict" };
    ghlApiService.createAppointment.mockRejectedValue(error);

    const result = await service.bookAppointment(mockDto);

    expect(result.success).toBe(false);
    expect(result.slotTaken).toBe(true);
    expect(result.error).toBe("Slot no longer available");
  });

  it("should handle 422 as slot taken", async () => {
    const error = { response: { status: 422 }, message: "Unprocessable" };
    ghlApiService.createAppointment.mockRejectedValue(error);

    const result = await service.bookAppointment(mockDto);

    expect(result.success).toBe(false);
    expect(result.slotTaken).toBe(true);
  });

  it("should handle general GHL API error", async () => {
    const error = { response: { status: 500 }, message: "Server error" };
    ghlApiService.createAppointment.mockRejectedValue(error);

    const result = await service.bookAppointment(mockDto);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to create appointment");
    expect(result.slotTaken).toBeUndefined();
  });

  it("should include clinic address in confirmation", async () => {
    const result = await service.bookAppointment(mockDto);
    expect(result.confirmationMessage).toContain("123 Queen Street");
  });

  it("should include items to bring in confirmation", async () => {
    const result = await service.bookAppointment(mockDto);
    expect(result.confirmationMessage).toContain("Photo ID");
  });

  it("should not call store or update when GHL fails", async () => {
    ghlApiService.createAppointment.mockRejectedValue({
      response: { status: 500 },
      message: "fail",
    });

    await service.bookAppointment(mockDto);

    expect(appointmentModel.create).not.toHaveBeenCalled();
    expect(conversationModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  describe('BST timezone regression', () => {
    it('should store appointmentTime as 11:00 for 10:00 UTC input during BST (UTC+1)', async () => {
      // 2026-04-01T10:00:00.000Z = 11:00 AM BST — must be stored as '11:00', not '10:00'
      const bstDto = { ...mockDto, startTime: '2026-04-01T10:00:00.000Z' };
      await service.bookAppointment(bstDto);

      expect(appointmentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentTime: '11:00' }),
      );
    });

    it('should store appointmentTime as 10:00 for 10:00 UTC input during GMT (UTC+0)', async () => {
      // 2026-01-15T10:00:00.000Z = 10:00 AM GMT — must be stored as '10:00'
      const gmtDto = { ...mockDto, startTime: '2026-01-15T10:00:00.000Z' };
      await service.bookAppointment(gmtDto);

      expect(appointmentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentTime: '10:00' }),
      );
    });
  });

  it('should call persistHistory when lead is found', async () => {
    const mockLead = {
      phone: '+441234567890',
      email: 'patient@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    };
    leadModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockLead),
    });
    conversationModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        context: { get: jest.fn().mockReturnValue('CF10 2BX') },
      }),
    });

    await service.bookAppointment(mockDto);

    expect(patientHistoryService.persistHistory).toHaveBeenCalledWith(
      mockDto.clinicId,
      mockLead.phone,
      mockLead.email,
      mockLead.firstName,
      mockLead.lastName,
      'CF10 2BX',
      expect.any(Types.ObjectId),
    );
  });
});

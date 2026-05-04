import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService, BookingResult } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { SlotsService } from "./services/slots.service";
import { IdempotencyKey } from "./idempotency-key.schema";

describe("AppointmentsController", () => {
  let controller: AppointmentsController;
  let appointmentsService: { bookAppointment: jest.Mock };
  let slotsService: { fetchAvailableSlots: jest.Mock };

  const mockDto: CreateAppointmentDto = {
    clinicId: "507f1f77bcf86cd799439011",
    contactId: "ghl_contact_123",
    conversationId: "507f1f77bcf86cd799439012",
    leadId: "507f1f77bcf86cd799439013",
    startTime: "2026-03-17T14:00:00Z",
  };

  beforeEach(async () => {
    appointmentsService = { bookAppointment: jest.fn() };
    slotsService = { fetchAvailableSlots: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        { provide: AppointmentsService, useValue: appointmentsService },
        { provide: SlotsService, useValue: slotsService },
        {
          provide: getModelToken(IdempotencyKey.name),
          useValue: { findOne: jest.fn(), create: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("bookAppointment", () => {
    it("should return successful booking result", async () => {
      const mockResult: BookingResult = {
        success: true,
        appointmentId: "507f1f77bcf86cd799439014",
        ghlAppointmentId: "ghl_apt_001",
        confirmationMessage: "Appointment Confirmed!",
      };
      appointmentsService.bookAppointment.mockResolvedValue(mockResult);

      const result = await controller.bookAppointment(mockDto);

      expect(result).toEqual(mockResult);
      expect(appointmentsService.bookAppointment).toHaveBeenCalledWith(mockDto);
    });

    it("should return failure when slot is taken", async () => {
      const mockResult: BookingResult = {
        success: false,
        error: "Slot no longer available",
        slotTaken: true,
      };
      appointmentsService.bookAppointment.mockResolvedValue(mockResult);

      const result = await controller.bookAppointment(mockDto);

      expect(result.success).toBe(false);
      expect(result.slotTaken).toBe(true);
    });

    it("should return failure when clinic not found", async () => {
      const mockResult: BookingResult = {
        success: false,
        error: "Clinic not found",
      };
      appointmentsService.bookAppointment.mockResolvedValue(mockResult);

      const result = await controller.bookAppointment(mockDto);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Clinic not found");
    });
  });

  describe("getAvailableSlots", () => {
    it("should return available slots", async () => {
      const mockSlots = [
        {
          date: "2024-03-25",
          startTime: "14:00",
          endTime: "14:30",
          dateTime: new Date("2024-03-25T14:00:00Z"),
        },
      ];

      slotsService.fetchAvailableSlots.mockResolvedValue(mockSlots);

      const result = await controller.getAvailableSlots({
        clinicId: "clinic_123",
        startDate: "2024-03-25",
        endDate: "2024-03-26",
      });

      expect(result).toEqual(mockSlots);
      expect(slotsService.fetchAvailableSlots).toHaveBeenCalledWith(
        "clinic_123",
        new Date("2024-03-25"),
        new Date("2024-03-26"),
      );
    });

    it("should return empty array when no slots available", async () => {
      slotsService.fetchAvailableSlots.mockResolvedValue([]);

      const result = await controller.getAvailableSlots({
        clinicId: "clinic_123",
        startDate: "2024-03-25",
        endDate: "2024-03-26",
      });

      expect(result).toEqual([]);
    });
  });
});

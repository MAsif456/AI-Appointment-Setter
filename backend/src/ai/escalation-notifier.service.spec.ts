import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { EscalationNotifierService } from "./escalation-notifier.service";
import { NotificationBusService } from "../notifications/notification-bus.service";
import { InboxNotificationService } from "../notifications/inbox-notification.service";

describe("EscalationNotifierService", () => {
  let service: EscalationNotifierService;
  let mockNotificationModel: { create: jest.Mock };
  let mockBus: { publish: jest.Mock };

  const ctx: any = {
    conversation: { _id: "conv_1" },
    lead: {
      _id: "lead_1",
      firstName: "Jane",
      lastName: "Doe",
      phone: "+447700900123",
    },
    clinic: { _id: "clinic_1", name: "Smile Dental Bristol" },
    trigger: "failed_understanding",
    reason: "3 consecutive AI comprehension failures",
  };

  beforeEach(async () => {
    mockNotificationModel = {
      create: jest.fn().mockResolvedValue({ _id: "notif_1" }),
    };
    mockBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationNotifierService,
        {
          provide: getModelToken("EscalationNotification"),
          useValue: mockNotificationModel,
        },
        { provide: NotificationBusService, useValue: mockBus },
        { provide: InboxNotificationService, useValue: { createForClinicStaff: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(EscalationNotifierService);
  });

  afterEach(() => jest.clearAllMocks());

  it("persists an escalation notification document", async () => {
    await service.recordAndPublish(ctx);

    expect(mockNotificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv_1",
        leadId: "lead_1",
        clinicId: "clinic_1",
        trigger: "failed_understanding",
        reason: "3 consecutive AI comprehension failures",
        leadName: "Jane Doe",
        leadPhone: "+447700900123",
        clinicName: "Smile Dental Bristol",
      }),
    );
  });

  it("returns the new notification id", async () => {
    const id = await service.recordAndPublish(ctx);
    expect(id).toBe("notif_1");
  });

  it("publishes to the bus with the correct payload shape", async () => {
    await service.recordAndPublish(ctx);

    expect(mockBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "notif_1",
        conversationId: "conv_1",
        leadId: "lead_1",
        leadName: "Jane Doe",
        leadPhone: "+447700900123",
        clinicId: "clinic_1",
        clinicName: "Smile Dental Bristol",
        trigger: "failed_understanding",
        reason: "3 consecutive AI comprehension failures",
        createdAt: expect.any(String),
      }),
    );
  });

  it("builds leadName from first and last name", async () => {
    await service.recordAndPublish(ctx);
    expect(mockNotificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ leadName: "Jane Doe" }),
    );
  });

  it("uses 'Unknown lead' when name fields are empty", async () => {
    const noName = {
      ...ctx,
      lead: { ...ctx.lead, firstName: undefined, lastName: undefined },
    };
    await service.recordAndPublish(noName);
    expect(mockNotificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ leadName: "Unknown lead" }),
    );
  });

  it("uses empty string for missing phone", async () => {
    const noPhone = {
      ...ctx,
      lead: { ...ctx.lead, phone: undefined },
    };
    await service.recordAndPublish(noPhone);
    expect(mockNotificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ leadPhone: "" }),
    );
  });

  it("returns null and logs when persistence fails", async () => {
    mockNotificationModel.create.mockRejectedValue(new Error("DB down"));
    const id = await service.recordAndPublish(ctx);
    expect(id).toBeNull();
    expect(mockBus.publish).not.toHaveBeenCalled();
  });

  it("still returns the id when bus publish throws", async () => {
    mockBus.publish.mockImplementation(() => {
      throw new Error("Bus broken");
    });
    const id = await service.recordAndPublish(ctx);
    expect(id).toBe("notif_1");
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { Types } from "mongoose";
import { EscalationsService } from "./escalations.service";

describe("EscalationsService", () => {
  let service: EscalationsService;
  let mockModel: any;
  let mockMessageModel: any;
  let mockLeadModel: any;

  const clinicId = new Types.ObjectId();
  const userId = new Types.ObjectId().toString();

  const baseDocs = [
    {
      _id: new Types.ObjectId(),
      conversationId: new Types.ObjectId(),
      leadId: new Types.ObjectId(),
      clinicId,
      leadName: "Jane Doe",
      leadPhone: "+447700900123",
      clinicName: "Smile Dental",
      trigger: "failed_understanding",
      reason: "3 consecutive failures",
      acknowledgements: [],
      resolvedAt: null,
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    mockModel = {
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(baseDocs) }),
      findById: jest.fn().mockResolvedValue(baseDocs[0]),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };
    mockMessageModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            sender: "lead",
            content: "hello",
            createdAt: new Date(),
          },
        ]),
      }),
    };
    mockLeadModel = {
      findById: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        firstName: "Jane",
        lastName: "Doe",
        phone: "+447700900123",
        email: "jane@test.com",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationsService,
        { provide: getModelToken("EscalationNotification"), useValue: mockModel },
        { provide: getModelToken("Message"), useValue: mockMessageModel },
        { provide: getModelToken("Lead"), useValue: mockLeadModel },
      ],
    }).compile();

    service = module.get(EscalationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("listUnresolved", () => {
    it("returns empty array when staff has no assigned clinics", async () => {
      const result = await service.listUnresolved(userId, []);
      expect(result).toEqual([]);
      expect(mockModel.find).not.toHaveBeenCalled();
    });

    it("queries by clinicId and resolvedAt:null", async () => {
      await service.listUnresolved(userId, [clinicId.toString()]);

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId: { $in: expect.any(Array) },
          resolvedAt: null,
        }),
      );
    });

    it("serialises docs with acknowledgedByMe=false when not acked", async () => {
      const result = await service.listUnresolved(userId, [clinicId.toString()]);
      expect(result[0]).toHaveProperty("acknowledgedByMe", false);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("trigger", "failed_understanding");
    });
  });

  describe("getWithTranscript", () => {
    it("returns escalation with embedded messages and lead", async () => {
      const result = await service.getWithTranscript(
        baseDocs[0]._id.toString(),
        userId,
        [clinicId.toString()],
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toHaveProperty("sender", "lead");
      expect(result.lead).toHaveProperty("firstName", "Jane");
    });

    it("throws NotFoundException for invalid id", async () => {
      mockModel.findById.mockResolvedValue(null);
      await expect(
        service.getWithTranscript("bad_id", userId, [clinicId.toString()]),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException for cross-clinic access", async () => {
      await expect(
        service.getWithTranscript(
          baseDocs[0]._id.toString(),
          userId,
          ["other_clinic_id"],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("returns lead: null when lead document is missing", async () => {
      mockLeadModel.findById.mockResolvedValue(null);
      const result = await service.getWithTranscript(
        baseDocs[0]._id.toString(),
        userId,
        [clinicId.toString()],
      );
      expect(result.lead).toBeNull();
    });
  });

  describe("acknowledge", () => {
    it("pushes per-user acknowledgement", async () => {
      await service.acknowledge(
        baseDocs[0]._id.toString(),
        userId,
        [clinicId.toString()],
      );

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        baseDocs[0]._id.toString(),
        {
          $push: {
            acknowledgements: expect.objectContaining({
              userId: expect.any(Types.ObjectId),
            }),
          },
        },
      );
    });

    it("skips when already acknowledged", async () => {
      const acked = {
        ...baseDocs[0],
        acknowledgements: [
          { userId: new Types.ObjectId(userId), acknowledgedAt: new Date() },
        ],
      };
      mockModel.findById.mockResolvedValue(acked);

      await service.acknowledge(
        acked._id.toString(),
        userId,
        [clinicId.toString()],
      );

      expect(mockModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for unknown id", async () => {
      mockModel.findById.mockResolvedValue(null);
      await expect(
        service.acknowledge("bad", userId, [clinicId.toString()]),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException for cross-clinic access", async () => {
      await expect(
        service.acknowledge(baseDocs[0]._id.toString(), userId, ["other"]),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("resolve", () => {
    it("sets resolvedAt on the document", async () => {
      await service.resolve(baseDocs[0]._id.toString(), [clinicId.toString()]);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        baseDocs[0]._id.toString(),
        { resolvedAt: expect.any(Date) },
      );
    });

    it("throws NotFoundException for unknown id", async () => {
      mockModel.findById.mockResolvedValue(null);
      await expect(
        service.resolve("bad", [clinicId.toString()]),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException for cross-clinic access", async () => {
      await expect(
        service.resolve(baseDocs[0]._id.toString(), ["other"]),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

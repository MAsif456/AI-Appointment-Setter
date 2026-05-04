import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { EscalationsController } from "./escalations.controller";
import { EscalationsService } from "./escalations.service";

describe("EscalationsController", () => {
  let controller: EscalationsController;
  let mockService: any;

  const staffReq = {
    user: {
      _id: "user_1",
      role: "staff",
      assignedClinics: ["clinic_1", "clinic_2"],
    },
  };

  const adminReq = {
    user: { _id: "admin_1", role: "admin", assignedClinics: [] },
  };

  beforeEach(async () => {
    mockService = {
      listUnresolved: jest.fn().mockResolvedValue([{ id: "e1" }]),
      getWithTranscript: jest.fn().mockResolvedValue({ id: "e1", messages: [] }),
      acknowledge: jest.fn().mockResolvedValue(undefined),
      resolve: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscalationsController],
      providers: [
        { provide: EscalationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get(EscalationsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe("GET /escalations (list)", () => {
    it("returns items for a staff user", async () => {
      const result = await controller.list(staffReq);
      expect(result).toEqual({ items: [{ id: "e1" }] });
      expect(mockService.listUnresolved).toHaveBeenCalledWith(
        "user_1",
        ["clinic_1", "clinic_2"],
      );
    });

    it("throws ForbiddenException for admin", async () => {
      await expect(controller.list(adminReq)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("GET /escalations/:id (getOne)", () => {
    it("returns the escalation with transcript for staff", async () => {
      const result = await controller.getOne("e1", staffReq);
      expect(result).toEqual({ id: "e1", messages: [] });
      expect(mockService.getWithTranscript).toHaveBeenCalledWith(
        "e1",
        "user_1",
        ["clinic_1", "clinic_2"],
      );
    });

    it("throws ForbiddenException for admin", async () => {
      await expect(controller.getOne("e1", adminReq)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("POST /escalations/:id/acknowledge", () => {
    it("delegates to service for staff", async () => {
      await controller.acknowledge("e1", staffReq);
      expect(mockService.acknowledge).toHaveBeenCalledWith(
        "e1",
        "user_1",
        ["clinic_1", "clinic_2"],
      );
    });

    it("throws ForbiddenException for admin", async () => {
      await expect(
        controller.acknowledge("e1", adminReq),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("POST /escalations/:id/resolve", () => {
    it("delegates to service for staff", async () => {
      await controller.resolve("e1", staffReq);
      expect(mockService.resolve).toHaveBeenCalledWith(
        "e1",
        ["clinic_1", "clinic_2"],
      );
    });

    it("throws ForbiddenException for admin", async () => {
      await expect(controller.resolve("e1", adminReq)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("assignedClinics normalisation", () => {
    it("handles ObjectId-like values via toString()", async () => {
      const reqWithObjectIds = {
        user: {
          _id: "user_1",
          role: "staff",
          assignedClinics: [{ toString: () => "clinic_obj_1" }],
        },
      };
      await controller.list(reqWithObjectIds);
      expect(mockService.listUnresolved).toHaveBeenCalledWith(
        "user_1",
        ["clinic_obj_1"],
      );
    });

    it("handles missing assignedClinics gracefully", async () => {
      const req = {
        user: { _id: "user_1", role: "staff", assignedClinics: undefined },
      };
      await controller.list(req);
      expect(mockService.listUnresolved).toHaveBeenCalledWith("user_1", []);
    });
  });
});

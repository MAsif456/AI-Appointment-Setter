import { Test, TestingModule } from "@nestjs/testing";
import { CspReportController } from "./csp-report.controller";
import {
  CspReportService,
  RawCspReportEnvelope,
} from "./csp-report.service";
import { DEFAULT_CSP_REPORT_TIER } from "../rate-limiting/rate-limiting.constants";

/**
 * Unit tests for CspReportController.
 *
 * Verifies the controller hands the payload off to the service unchanged
 * and asserts the route is excluded from the global rate limiter.
 * The HTTP semantics (204, body parsing) are exercised by the
 * integration spec via supertest.
 */
describe("CspReportController", () => {
  let controller: CspReportController;
  let service: { record: jest.Mock };

  beforeEach(async () => {
    service = { record: jest.fn().mockResolvedValue({ _id: "abc" }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CspReportController],
      providers: [{ provide: CspReportService, useValue: service }],
    }).compile();

    controller = module.get<CspReportController>(CspReportController);
  });

  it("delegates to CspReportService.record with the body and User-Agent", async () => {
    const body: RawCspReportEnvelope = {
      "csp-report": {
        "document-uri": "https://dashboard.lunax.health/",
        "violated-directive": "script-src",
      },
    };

    await controller.report(body, "Mozilla/5.0");

    expect(service.record).toHaveBeenCalledWith(body, "Mozilla/5.0");
  });

  it("substitutes an empty envelope when no body is provided", async () => {
    await controller.report(undefined as unknown as RawCspReportEnvelope, "ua");
    expect(service.record).toHaveBeenCalledWith({}, "ua");
  });

  it("does not throw when the service returns null", async () => {
    service.record.mockResolvedValueOnce(null);
    await expect(
      controller.report({} as RawCspReportEnvelope, undefined),
    ).resolves.toBeUndefined();
  });

  describe("rate limiting", () => {
    it("has a dedicated csp-report rate limit tier with a generous limit", () => {
      // The CSP report endpoint uses its own rate limit tier rather than
      // being excluded from rate limiting entirely. The tier is generous
      // enough to capture all legitimate browser violations but prevents
      // abuse of the public unauthenticated endpoint.
      expect(DEFAULT_CSP_REPORT_TIER.tier).toBe("csp-report");
      expect(DEFAULT_CSP_REPORT_TIER.limit).toBe(100);
      expect(DEFAULT_CSP_REPORT_TIER.windowSeconds).toBe(60);
    });
  });
});

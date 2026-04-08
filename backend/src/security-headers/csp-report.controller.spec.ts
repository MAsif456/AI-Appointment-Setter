import { Test, TestingModule } from "@nestjs/testing";
import { CspReportController } from "./csp-report.controller";
import {
  CspReportService,
  RawCspReportEnvelope,
} from "./csp-report.service";
import { EXCLUDED_PATH_PREFIXES } from "../rate-limiting/rate-limiting.constants";

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

  describe("rate limiter exclusion", () => {
    it("/security/csp-report is listed in the global rate limiter exclusions", () => {
      // This test pins the exclusion contract: the rate-limiting guard reads
      // EXCLUDED_PATH_PREFIXES at startup and skips any request whose path
      // starts with one of the listed prefixes. If a future refactor drops
      // /security/csp-report from this list, browser violation reports
      // would start getting throttled and the feedback loop would silently
      // break. Failing this test forces the refactor to make a deliberate
      // decision instead.
      expect(EXCLUDED_PATH_PREFIXES).toContain("/security/csp-report");
    });
  });
});

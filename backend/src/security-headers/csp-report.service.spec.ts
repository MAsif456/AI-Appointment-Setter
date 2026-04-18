import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Logger } from "@nestjs/common";
import {
  CspReportService,
  RawCspReportEnvelope,
} from "./csp-report.service";
import { CspReport } from "./schemas/csp-report.schema";

/**
 * Unit tests for CspReportService.
 *
 * The service is small but its behaviour is on the security
 * monitoring critical path, so the tests verify:
 *
 * 1. Browser-style hyphenated payloads are normalised into the
 *    camelCase Mongoose schema shape.
 * 2. Empty / missing envelopes are skipped without throwing.
 * 3. Database failures are logged but never bubble up to the caller
 *    (the controller returns 204 either way).
 */
describe("CspReportService", () => {
  let service: CspReportService;
  let mockModel: { create: jest.Mock };

  const sampleEnvelope: RawCspReportEnvelope = {
    "csp-report": {
      "document-uri": "https://dashboard.lunax.health/conversations/123",
      referrer: "https://dashboard.lunax.health/clinics",
      "violated-directive": "script-src 'self'",
      "effective-directive": "script-src",
      "original-policy": "default-src 'self'; script-src 'self'",
      disposition: "enforce",
      "blocked-uri": "https://evil.example.com/track.js",
      "source-file": "https://dashboard.lunax.health/_next/static/chunks/main.js",
      "line-number": 42,
      "column-number": 7,
      "status-code": 200,
    },
  };

  beforeEach(async () => {
    mockModel = { create: jest.fn().mockResolvedValue({ _id: "abc" }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CspReportService,
        { provide: getModelToken(CspReport.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<CspReportService>(CspReportService);
    // Silence the warn logged for every recorded violation so the test
    // output stays readable. The "logs failures" test re-spies as needed.
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy path", () => {
    it("normalises hyphenated browser fields into the camelCase schema shape", async () => {
      await service.record(sampleEnvelope, "Mozilla/5.0 test");

      expect(mockModel.create).toHaveBeenCalledWith({
        documentUri: "https://dashboard.lunax.health/conversations/123",
        referrer: "https://dashboard.lunax.health/clinics",
        violatedDirective: "script-src 'self'",
        effectiveDirective: "script-src",
        originalPolicy: "default-src 'self'; script-src 'self'",
        disposition: "enforce",
        blockedUri: "https://evil.example.com/track.js",
        sourceFile:
          "https://dashboard.lunax.health/_next/static/chunks/main.js",
        lineNumber: 42,
        columnNumber: 7,
        statusCode: 200,
        userAgent: "Mozilla/5.0 test",
      });
    });

    it("returns the persisted document", async () => {
      const result = await service.record(sampleEnvelope, "ua");
      expect(result).toEqual({ _id: "abc" });
    });
  });

  describe("empty payloads", () => {
    it("returns null and does not call the model when the envelope is empty", async () => {
      const result = await service.record({}, "ua");
      expect(result).toBeNull();
      expect(mockModel.create).not.toHaveBeenCalled();
    });

    it("returns null when the envelope key is missing", async () => {
      const result = await service.record(
        {} as RawCspReportEnvelope,
        undefined,
      );
      expect(result).toBeNull();
      expect(mockModel.create).not.toHaveBeenCalled();
    });
  });

  describe("fail-open on database errors", () => {
    it("returns null and does not throw when create() rejects", async () => {
      mockModel.create.mockRejectedValueOnce(new Error("mongo down"));
      const errorSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => {});

      const result = await service.record(sampleEnvelope, "ua");

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("mongo down"),
      );
    });
  });
});

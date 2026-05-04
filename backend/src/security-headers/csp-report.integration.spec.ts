import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { CspReportController } from "./csp-report.controller";
import { CspReportService } from "./csp-report.service";

/**
 * End-to-end style integration test for the CSP report endpoint.
 *
 * Boots a minimal Nest app with the real CspReportController and a
 * stub CspReportService (so the test does not need a live MongoDB
 * connection) and verifies the HTTP contract:
 *
 * - The endpoint accepts a real CSP-report-shaped JSON payload.
 * - It returns 204 No Content (so browsers do not retry).
 * - The User-Agent header is forwarded to the service.
 */
describe("CspReportController (integration)", () => {
  let app: INestApplication;
  let serviceRecord: jest.Mock;

  beforeAll(async () => {
    serviceRecord = jest.fn().mockResolvedValue({ _id: "abc" });

    const moduleRef = await Test.createTestingModule({
      controllers: [CspReportController],
      providers: [
        { provide: CspReportService, useValue: { record: serviceRecord } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("accepts a CSP report POST and returns 204 No Content", async () => {
    const payload = {
      "csp-report": {
        "document-uri": "https://dashboard.lunax.health/clinics",
        "violated-directive": "script-src 'self'",
        "blocked-uri": "https://evil.example.com/track.js",
      },
    };

    const res = await request(app.getHttpServer())
      .post("/security/csp-report")
      .set("User-Agent", "Mozilla/5.0 integration-test")
      .send(payload);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });

  it("forwards the payload and User-Agent to the service", async () => {
    const payload = {
      "csp-report": {
        "document-uri": "https://dashboard.lunax.health/conversations/abc",
        "violated-directive": "img-src 'self'",
        "blocked-uri": "https://tracker.example.com/pixel.gif",
      },
    };

    await request(app.getHttpServer())
      .post("/security/csp-report")
      .set("User-Agent", "Mozilla/5.0 forwarder-test")
      .send(payload);

    // Find the call corresponding to this test (the previous test also
    // hit the endpoint, so we cannot rely on call index zero).
    const matchingCall = serviceRecord.mock.calls.find(
      ([body]) =>
        body?.["csp-report"]?.["document-uri"] ===
        "https://dashboard.lunax.health/conversations/abc",
    );

    expect(matchingCall).toBeDefined();
    expect(matchingCall![1]).toBe("Mozilla/5.0 forwarder-test");
  });

  it("still returns 204 when the body is empty", async () => {
    const res = await request(app.getHttpServer())
      .post("/security/csp-report")
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(204);
  });
});

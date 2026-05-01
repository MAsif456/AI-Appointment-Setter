import { ArgumentsHost, BadRequestException, HttpStatus, Logger } from "@nestjs/common";
import { ValidationExceptionFilter } from "./validation-exception.filter";

/**
 * Builds a stub ArgumentsHost exposing the supplied request and a
 * captured response double whose .status and .json calls can be
 * asserted against.
 */
function buildHost(req: Partial<{
  method: string;
  url: string;
  originalUrl: string;
  ip: string;
  headers: Record<string, string>;
  body: unknown;
}>): { host: ArgumentsHost; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: "POST",
        url: "/clinics",
        ip: "127.0.0.1",
        headers: {},
        body: {},
        ...req,
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe("ValidationExceptionFilter", () => {
  let filter: ValidationExceptionFilter;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new ValidationExceptionFilter();
    warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns a 400 with stable error shape and no stack/internals", () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ["name should not be empty", "phone must be a valid UK phone number"],
      error: "Bad Request",
    });
    const { host, status, json } = buildHost({});
    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Bad Request",
      messages: [
        "name should not be empty",
        "phone must be a valid UK phone number",
      ],
    });

    const body = json.mock.calls[0][0];
    expect(body).not.toHaveProperty("stack");
    expect(body).not.toHaveProperty("trace");
    expect(body).not.toHaveProperty("path");
  });

  it("normalises a string-form exception payload into the messages array", () => {
    const exception = new BadRequestException("Something went wrong");
    const { host, json } = buildHost({});
    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Bad Request",
      messages: ["Something went wrong"],
    });
  });

  it("logs an audit line with timestamp, method, path, IP, and body summary", () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ["name should not be empty"],
    });
    const { host } = buildHost({
      method: "POST",
      originalUrl: "/clinics",
      ip: "10.0.0.42",
      body: { name: "" },
    });
    filter.catch(exception, host);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const line = warnSpy.mock.calls[0][0] as string;
    expect(line).toMatch(/ts=\d{4}-\d{2}-\d{2}T/);
    expect(line).toContain("method=POST");
    expect(line).toContain("path=/clinics");
    expect(line).toContain("ip=10.0.0.42");
    expect(line).toContain("name=");
  });

  it("prefers x-forwarded-for over req.ip when behind a proxy", () => {
    const exception = new BadRequestException("bad");
    const { host } = buildHost({
      ip: "10.0.0.42",
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.42" },
    });
    filter.catch(exception, host);
    const line = warnSpy.mock.calls[0][0] as string;
    expect(line).toContain("ip=203.0.113.7");
  });

  it("redacts sensitive fields like password and ghlApiKey from the audit log", () => {
    const exception = new BadRequestException("bad");
    const { host } = buildHost({
      body: { email: "a@b.com", password: "supersecret", ghlApiKey: "pit_xyz" },
    });
    filter.catch(exception, host);

    const line = warnSpy.mock.calls[0][0] as string;
    expect(line).toContain("password=[REDACTED]");
    expect(line).toContain("ghlApiKey=[REDACTED]");
    expect(line).not.toContain("supersecret");
    expect(line).not.toContain("pit_xyz");
  });

  it("clips an oversized string value in the audit summary", () => {
    const exception = new BadRequestException("bad");
    const { host } = buildHost({ body: { note: "x".repeat(500) } });
    filter.catch(exception, host);

    const line = warnSpy.mock.calls[0][0] as string;
    expect(line).toMatch(/note=x{80}…\(500\)/);
  });

  it("does not echo internal field names beyond what the messages array contained", () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ["validation failed"],
    });
    const { host, json } = buildHost({});
    filter.catch(exception, host);
    const body = json.mock.calls[0][0];
    expect(body.messages).toEqual(["validation failed"]);
  });
});

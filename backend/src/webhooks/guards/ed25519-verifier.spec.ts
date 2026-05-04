import { verifyEd25519Signature } from "./ed25519-verifier";
import { Logger } from "@nestjs/common";

describe("verifyEd25519Signature", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return false for an invalid Ed25519 signature", () => {
    const body = Buffer.from('{"type":"ContactCreate"}');
    const invalidSignature =
      Buffer.from("invalid-signature").toString("base64");

    expect(verifyEd25519Signature(body, invalidSignature)).toBe(false);
  });

  it("should return false and log for a malformed base64 signature", () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn");
    const body = Buffer.from('{"type":"ContactCreate"}');

    expect(verifyEd25519Signature(body, "not-valid-base64!!!")).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("invalid Ed25519 signature"),
    );
  });
});

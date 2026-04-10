import { Reflector } from "@nestjs/core";
import {
  SensitiveData,
  SENSITIVE_DATA_METADATA_KEY,
} from "./sensitive-data.decorator";

/**
 * Unit tests for the @SensitiveData decorator.
 *
 * These tests verify that the decorator attaches the expected metadata
 * key so that the CacheControlInterceptor can reliably detect routes
 * that return patient data. We use the real NestJS `Reflector` here
 * (not a mock) so that the same reflection path the runtime uses is
 * exercised by the test.
 */
describe("@SensitiveData decorator", () => {
  const reflector = new Reflector();

  it("attaches the sensitive-data metadata to a method", () => {
    class TestController {
      @SensitiveData()
      getPatient(): void {}
    }

    const instance = new TestController();
    const metadata = reflector.get<boolean>(
      SENSITIVE_DATA_METADATA_KEY,
      instance.getPatient,
    );

    expect(metadata).toBe(true);
  });

  it("attaches the metadata to a controller class so every handler inherits it", () => {
    @SensitiveData()
    class PatientController {
      list(): void {}
    }

    const metadata = reflector.get<boolean>(
      SENSITIVE_DATA_METADATA_KEY,
      PatientController,
    );

    expect(metadata).toBe(true);
  });

  it("does not leak metadata to unrelated handlers", () => {
    class MixedController {
      @SensitiveData()
      secret(): void {}

      public_route(): void {}
    }

    const instance = new MixedController();

    expect(
      reflector.get<boolean>(SENSITIVE_DATA_METADATA_KEY, instance.secret),
    ).toBe(true);
    expect(
      reflector.get<boolean>(
        SENSITIVE_DATA_METADATA_KEY,
        instance.public_route,
      ),
    ).toBeUndefined();
  });

  it("exposes a stable metadata key so tests and the interceptor agree", () => {
    // Locks the key name in as part of the public contract. If this ever
    // changes, the interceptor spec will fail loudly and force a
    // deliberate decision about the migration.
    expect(SENSITIVE_DATA_METADATA_KEY).toBe(
      "security-headers:sensitive-data",
    );
  });
});

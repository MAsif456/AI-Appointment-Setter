import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { GroqService } from "./groq.service";

// Mock the groq-sdk module
jest.mock("groq-sdk", () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

describe("GroqService", () => {
  let service: GroqService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroqService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-api-key"),
          },
        },
      ],
    }).compile();

    service = module.get<GroqService>(GroqService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should initialise the client when API key is present", () => {
      const logSpy = jest.spyOn(service["logger"], "log");
      service.onModuleInit();
      expect(logSpy).toHaveBeenCalledWith(
        "Groq client initialised successfully.",
      );
    });

    it("should log error when API key is missing", () => {
      jest.spyOn(configService, "get").mockReturnValue(undefined);
      const errorSpy = jest.spyOn(service["logger"], "error");
      service.onModuleInit();
      expect(errorSpy).toHaveBeenCalledWith(
        "GROQ_API_KEY is missing. AI greeting generation will not work.",
      );
    });
  });

  describe("generateResponse", () => {
    it("should return generated text on success", async () => {
      service.onModuleInit();
      // Mock the Groq API response
      const mockResponse = {
        choices: [{ message: { content: "Hello Sarah!" } }],
      };
      service["client"]!.chat.completions.create = jest
        .fn()
        .mockResolvedValue(mockResponse);

      const result = await service.generateResponse("Test prompt");
      expect(result).toBe("Hello Sarah!");
    });

    it("should return null when client is not initialised", async () => {
      // Don't call onModuleInit — client stays null
      const result = await service.generateResponse("Test prompt");
      expect(result).toBeNull();
    });

    it("should return null and log error on API failure", async () => {
      service.onModuleInit();
      service["client"]!.chat.completions.create = jest
        .fn()
        .mockRejectedValue(new Error("API connection failed"));

      const errorSpy = jest.spyOn(service["logger"], "error");
      const result = await service.generateResponse("Test prompt");
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });

    it("should return null on timeout", async () => {
      service.onModuleInit();

      // Simulate a slow API call that never resolves within timeout
      service["client"]!.chat.completions.create = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ choices: [] }), 60_000);
          }),
      );

      // Override timeout to 50ms for testing
      service["createTimeout"] = () =>
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Groq API timed out after 30000ms")),
            50,
          );
        });

      const errorSpy = jest.spyOn(service["logger"], "error");
      const result = await service.generateResponse("Test prompt");
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });

    it("should return null when response has no choices", async () => {
      service.onModuleInit();
      service["client"]!.chat.completions.create = jest
        .fn()
        .mockResolvedValue({ choices: [] });

      const result = await service.generateResponse("Test prompt");
      expect(result).toBeNull();
    });
  });
});

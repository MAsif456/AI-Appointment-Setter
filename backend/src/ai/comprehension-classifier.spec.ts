import { Test, TestingModule } from "@nestjs/testing";
import { ComprehensionClassifier } from "./comprehension-classifier";
import { GroqService } from "./groq.service";

describe("ComprehensionClassifier", () => {
  let classifier: ComprehensionClassifier;
  let mockGroq: { generateChatResponse: jest.Mock };

  beforeEach(async () => {
    mockGroq = { generateChatResponse: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComprehensionClassifier,
        { provide: GroqService, useValue: mockGroq },
      ],
    }).compile();

    classifier = module.get(ComprehensionClassifier);
  });

  describe("heuristic pre-filter", () => {
    it("returns unclear when AI reply contains 'i'm not sure'", async () => {
      const result = await classifier.classify(
        "I need a root canal",
        "I'm not sure what treatment you need.",
      );
      expect(result).toBe("unclear");
      expect(mockGroq.generateChatResponse).not.toHaveBeenCalled();
    });

    it("returns unclear for 'could you rephrase'", async () => {
      const result = await classifier.classify(
        "asdlfkj",
        "Could you rephrase that for me?",
      );
      expect(result).toBe("unclear");
    });

    it("returns unclear for 'i don't understand'", async () => {
      const result = await classifier.classify(
        "blah",
        "I don't understand your message.",
      );
      expect(result).toBe("unclear");
    });

    it("returns unclear for 'can you explain'", async () => {
      const result = await classifier.classify(
        "xyz",
        "Can you explain what you mean?",
      );
      expect(result).toBe("unclear");
    });

    it("returns unclear for 'could you clarify'", async () => {
      const result = await classifier.classify(
        "abc",
        "Could you clarify your request?",
      );
      expect(result).toBe("unclear");
    });

    it("is case-insensitive", async () => {
      const result = await classifier.classify(
        "abc",
        "I'M NOT SURE what you mean.",
      );
      expect(result).toBe("unclear");
    });
  });

  describe("Groq fallback", () => {
    it("returns understood when LLM says UNDERSTOOD", async () => {
      mockGroq.generateChatResponse.mockResolvedValue("UNDERSTOOD");
      const result = await classifier.classify(
        "I need a filling",
        "Sure, let me find an appointment for your filling.",
      );
      expect(result).toBe("understood");
    });

    it("returns unclear when LLM says UNCLEAR", async () => {
      mockGroq.generateChatResponse.mockResolvedValue("UNCLEAR");
      const result = await classifier.classify(
        "sdfkjsdf",
        "Let me try to help you with that.",
      );
      expect(result).toBe("unclear");
    });

    it("parses UNCLEAR even when surrounded by whitespace", async () => {
      mockGroq.generateChatResponse.mockResolvedValue("  UNCLEAR  \n");
      const result = await classifier.classify("xyz", "Some reply");
      expect(result).toBe("unclear");
    });

    it("defaults to understood for ambiguous LLM output", async () => {
      mockGroq.generateChatResponse.mockResolvedValue(
        "It seems like the AI understood partially",
      );
      const result = await classifier.classify("xyz", "Some reply");
      expect(result).toBe("understood");
    });

    it("defaults to understood on null response", async () => {
      mockGroq.generateChatResponse.mockResolvedValue(null);
      const result = await classifier.classify("xyz", "Some reply");
      expect(result).toBe("understood");
    });
  });

  describe("fail-open behaviour", () => {
    it("returns understood when Groq throws", async () => {
      mockGroq.generateChatResponse.mockRejectedValue(
        new Error("Groq service unavailable"),
      );
      const result = await classifier.classify("xyz", "Some reply");
      expect(result).toBe("understood");
    });

    it("returns understood on timeout", async () => {
      // Simulate a promise that never resolves within the 3s window.
      mockGroq.generateChatResponse.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10_000)),
      );
      const result = await classifier.classify("xyz", "Some reply");
      expect(result).toBe("understood");
    }, 10_000);
  });
});

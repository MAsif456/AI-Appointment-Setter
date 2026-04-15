import { Test, TestingModule } from "@nestjs/testing";
import { UrgencyLlmClassifier } from "./urgency-llm-classifier";
import { GroqService } from "./groq.service";

describe("UrgencyLlmClassifier", () => {
  let classifier: UrgencyLlmClassifier;
  let mockGroq: { generateChatResponse: jest.Mock };

  beforeEach(async () => {
    mockGroq = { generateChatResponse: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrgencyLlmClassifier,
        { provide: GroqService, useValue: mockGroq },
      ],
    }).compile();

    classifier = module.get(UrgencyLlmClassifier);
  });

  it("returns parsed urgency level from LLM response", async () => {
    mockGroq.generateChatResponse.mockResolvedValue("URGENT");
    expect(await classifier.classify("my knee hurts a bit")).toBe("urgent");

    mockGroq.generateChatResponse.mockResolvedValue("EMERGENCY");
    expect(await classifier.classify("chest feels tight")).toBe("emergency");

    mockGroq.generateChatResponse.mockResolvedValue("ROUTINE");
    expect(await classifier.classify("just a check-up")).toBe("routine");
  });

  it("falls back to urgent on null response", async () => {
    mockGroq.generateChatResponse.mockResolvedValue(null);
    expect(await classifier.classify("some message")).toBe("urgent");
  });

  it("falls back to urgent on unexpected output", async () => {
    mockGroq.generateChatResponse.mockResolvedValue("I think this is moderate");
    expect(await classifier.classify("some message")).toBe("urgent");
  });
});

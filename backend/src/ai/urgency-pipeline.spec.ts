import { Test, TestingModule } from '@nestjs/testing';
import { UrgencyPipeline } from './urgency-pipeline';
import { UrgencyLlmClassifier } from './urgency-llm-classifier';
import * as urgencyDetector from './urgency-detector';

describe('UrgencyPipeline', () => {
  let pipeline: UrgencyPipeline;
  let mockLlm: { classify: jest.Mock };

  beforeEach(async () => {
    mockLlm = { classify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrgencyPipeline,
        { provide: UrgencyLlmClassifier, useValue: mockLlm },
      ],
    }).compile();

    pipeline = module.get(UrgencyPipeline);
  });

  it('classifies urgent messages without calling Layer 2', async () => {
    const result = await pipeline.assessMessage('I need to be seen ASAP', 'unknown');
    expect(result.resolved).toBe('urgent');
    expect(mockLlm.classify).not.toHaveBeenCalled();
  });

  it('classifies emergency messages without calling Layer 2', async () => {
    const result = await pipeline.assessMessage('I have chest pain', 'unknown');
    expect(result.resolved).toBe('emergency');
    expect(mockLlm.classify).not.toHaveBeenCalled();
  });

  it('respects monotonic escalation — never de-escalates', async () => {
    const result = await pipeline.assessMessage('no rush', 'urgent');
    expect(result.resolved).toBe('urgent');
  });

  it('returns assessment alongside resolved level', async () => {
    const result = await pipeline.assessMessage('I need to be seen ASAP', 'unknown');
    expect(result.assessment).toBeDefined();
    expect(result.assessment.level).toBe('urgent');
    expect(result.assessment.score).toBeGreaterThan(0);
  });

  it('handles Layer 2 LLM classifier failure gracefully', async () => {
    // Mock Layer 1 to return an ambiguous result so Layer 2 is triggered
    const ambiguousAssessment = {
      level: 'urgent' as const, score: 0.45, signals: [],
      isAmbiguous: true, requiresEscalation: false, emergencyKeywordsMatched: [],
    };
    jest.spyOn(urgencyDetector, 'classifyUrgencyFromText').mockReturnValue(ambiguousAssessment);
    jest.spyOn(urgencyDetector, 'needsLlmClassification').mockReturnValue(true);

    mockLlm.classify.mockRejectedValue(new Error('LLM timeout'));

    const result = await pipeline.assessMessage('some ambiguous text', 'unknown');

    // Layer 2 was called and threw, but pipeline still returns Layer 1 result
    expect(mockLlm.classify).toHaveBeenCalled();
    expect(result.resolved).toBe('urgent');
    expect(result.assessment).toBeDefined();

    jest.restoreAllMocks();
  });

  it('classifies form data synchronously', () => {
    const result = pipeline.assessFormData('Severe back pain, need help urgently');
    expect(result.resolved).toBe('urgent');
  });

  it('returns routine for undefined form data', () => {
    const result = pipeline.assessFormData(undefined);
    expect(result.resolved).toBe('routine');
  });
});

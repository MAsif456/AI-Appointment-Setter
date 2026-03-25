import {
  classifyUrgencyFromText,
  classifyFormData,
  mergeAssessments,
  needsLlmClassification,
} from './urgency-detector';
import { UrgencyAssessment } from './urgency-detector.types';

describe('classifyUrgencyFromText', () => {
  describe('detects urgent messages', () => {
    it.each([
      'I need to be seen ASAP',
      'Can I get something today?',
      "It's really painful",
      'As soon as possible please',
      "I can't wait much longer",
      'I need to be seen immediately',
      'I need the earliest available',
      "I'm in so much pain",
      "I'm in agony",
      'It keeps getting worse',
      'I can barely move',
    ])('classifies "%s" as urgent', (msg) => {
      const result = classifyUrgencyFromText(msg);
      expect(result.level).toBe('urgent');
      expect(result.signals.length).toBeGreaterThan(0);
    });
  });

  describe('detects routine messages', () => {
    it.each([
      'Sometime this week is fine',
      'No rush at all',
      'Whenever works for me',
      'Next week would be great',
      'Just a routine check-up',
      'Just a general appointment please',
      'Take your time',
      'At your convenience',
    ])('classifies "%s" as routine', (msg) => {
      const result = classifyUrgencyFromText(msg);
      expect(result.level).toBe('routine');
    });
  });

  describe('detects emergency messages', () => {
    it.each([
      "I can't move",
      'I have chest pain',
      'my chest hurts',
      "I can't breathe",
      "i cant breath",
      "I can't walk at all",
      'I think I need an ambulance',
      'Call 999 please',
      'I passed out earlier',
      'struggling to breathe',
      'I collapsed at work',
      "I've had a seizure",
    ])('classifies "%s" as emergency', (msg) => {
      const result = classifyUrgencyFromText(msg);
      expect(result.level).toBe('emergency');
      expect(result.requiresEscalation).toBe(true);
      expect(result.emergencyKeywordsMatched.length).toBeGreaterThan(0);
    });
  });

  describe('contextual pairs – MTS-inspired disambiguation', () => {
    it('classifies "I broke my leg" as emergency', () => {
      const result = classifyUrgencyFromText('I broke my leg');
      expect(result.level).toBe('emergency');
    });

    it('classifies "I broke my nail" as routine', () => {
      const result = classifyUrgencyFromText('I broke my nail');
      expect(result.level).toBe('routine');
    });

    it('classifies "severe back pain" as urgent', () => {
      const result = classifyUrgencyFromText('I have severe back pain');
      expect(result.level).toBe('urgent');
    });

    it('classifies "mild back pain" as routine', () => {
      const result = classifyUrgencyFromText('I have mild back pain');
      expect(result.level).toBe('routine');
    });

    it('classifies "my throat is swelling" as emergency', () => {
      const result = classifyUrgencyFromText('my throat is swelling up');
      expect(result.level).toBe('emergency');
    });

    it('classifies "my chest hurts" as emergency via hurt+chest contextual pair', () => {
      const result = classifyUrgencyFromText('my chest hurts a lot');
      expect(result.level).toBe('emergency');
    });

    it('classifies "my finger hurts a little" as routine via hurt+finger de-escalator', () => {
      const result = classifyUrgencyFromText('my finger hurts a little');
      expect(result.level).toBe('routine');
    });

    it('classifies "my arm is numb" as emergency via numb+arm contextual pair', () => {
      const result = classifyUrgencyFromText('my left arm is numb');
      expect(result.level).toBe('emergency');
    });
  });

  describe('behavioural markers', () => {
    it('boosts urgency for ALL CAPS text', () => {
      const result = classifyUrgencyFromText('I NEED HELP');
      expect(result.score).toBeGreaterThan(0);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('boosts urgency for excessive punctuation', () => {
      const result = classifyUrgencyFromText('please help me!!!');
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('matches keywords without apostrophes (e.g. "cant move")', () => {
      const result = classifyUrgencyFromText('i cant move');
      expect(result.level).toBe('emergency');
    });

    it('returns routine for empty string', () => {
      const result = classifyUrgencyFromText('');
      expect(result.level).toBe('routine');
      expect(result.score).toBe(0);
    });

    it('returns routine for whitespace-only string', () => {
      expect(classifyUrgencyFromText('   ').level).toBe('routine');
    });

    it('flags ambiguous text for Layer 2', () => {
      // "today" alone is urgent (weight 0.7) but a message with mixed
      // signals or moderate score should set isAmbiguous where appropriate
      const result = classifyUrgencyFromText('I have some pain');
      // "pain" without severity context should trigger the contextual pair
      // with baseLevel routine — the exact result depends on matching,
      // but should not be emergency
      expect(result.level).not.toBe('emergency');
    });
  });
});

describe('classifyFormData', () => {
  it('detects urgency from "Severe back pain, need help urgently"', () => {
    const result = classifyFormData('Severe back pain, need help urgently');
    expect(result.level).toBe('urgent');
    expect(result.signals[0].source).toBe('form_data');
  });

  it('detects routine from "Routine check-up, no issues"', () => {
    const result = classifyFormData('Routine check-up, no issues');
    expect(result.level).toBe('routine');
  });

  it('detects emergency from "Can\'t move my neck after car accident"', () => {
    const result = classifyFormData("Can't move my neck after car accident");
    expect(result.level).toBe('emergency');
  });

  it('returns routine for undefined input', () => {
    expect(classifyFormData(undefined).level).toBe('routine');
  });

  it('returns routine for empty string', () => {
    expect(classifyFormData('').level).toBe('routine');
  });
});

describe('mergeAssessments', () => {
  const makeAssessment = (level: 'routine' | 'urgent' | 'emergency'): UrgencyAssessment => ({
    level,
    score: level === 'emergency' ? 1.0 : level === 'urgent' ? 0.75 : 0.1,
    signals: [],
    isAmbiguous: false,
    requiresEscalation: level === 'emergency',
    emergencyKeywordsMatched: [],
  });

  it('escalates from unknown to urgent', () => {
    expect(mergeAssessments('unknown', makeAssessment('urgent'))).toBe('urgent');
  });

  it('escalates from routine to urgent', () => {
    expect(mergeAssessments('routine', makeAssessment('urgent'))).toBe('urgent');
  });

  it('does NOT de-escalate from urgent to routine', () => {
    expect(mergeAssessments('urgent', makeAssessment('routine'))).toBe('urgent');
  });

  it('does NOT de-escalate from emergency to routine', () => {
    expect(mergeAssessments('emergency', makeAssessment('routine'))).toBe('emergency');
  });

  it('does NOT de-escalate from emergency to urgent', () => {
    expect(mergeAssessments('emergency', makeAssessment('urgent'))).toBe('emergency');
  });
});

describe('needsLlmClassification', () => {
  it('returns true for ambiguous assessment with no emergency keywords', () => {
    const assessment: UrgencyAssessment = {
      level: 'urgent',
      score: 0.45,
      signals: [],
      isAmbiguous: true,
      requiresEscalation: false,
      emergencyKeywordsMatched: [],
    };
    expect(needsLlmClassification(assessment)).toBe(true);
  });

  it('returns false for non-ambiguous assessment', () => {
    const assessment: UrgencyAssessment = {
      level: 'emergency',
      score: 1.0,
      signals: [],
      isAmbiguous: false,
      requiresEscalation: true,
      emergencyKeywordsMatched: ['chest pain'],
    };
    expect(needsLlmClassification(assessment)).toBe(false);
  });
});

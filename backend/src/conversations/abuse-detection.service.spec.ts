import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AbuseDetectionService } from './abuse-detection.service';

/**
 * Builds an AbuseDetectionService with an optional extra blocklist env var.
 * @param extraBlocklist - Comma-separated extra words to add to the blocklist
 */
async function buildService(extraBlocklist = ''): Promise<AbuseDetectionService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AbuseDetectionService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) =>
            key === 'ABUSE_BLOCKLIST_EXTRA' ? extraBlocklist : undefined,
        },
      },
    ],
  }).compile();
  return module.get<AbuseDetectionService>(AbuseDetectionService);
}

/** Unit tests for AbuseDetectionService (US-19) */
describe('AbuseDetectionService', () => {
  let service: AbuseDetectionService;

  beforeEach(async () => {
    service = await buildService();
  });

  // Clean messages must never be flagged
  describe('clean messages', () => {
    it('should not flag a normal booking message', () => {
      const result = service.check('I need to book an appointment', 0, false);
      expect(result.classification).toBe('none');
      expect(result.response).toBeNull();
      expect(result.shouldEscalate).toBe(false);
    });
  });

  // Casual swearing must be completely ignored — does not increment count
  describe('casual swearing', () => {
    it('should classify "my back is fucking killing me" as casual', () => {
      const result = service.check('my back is fucking killing me', 0, false);
      expect(result.classification).toBe('casual');
      expect(result.response).toBeNull();
      expect(result.newDirectedCount).toBe(0);
    });

    it('should not increment directedCount for casual messages', () => {
      const result = service.check('fucking hell my back hurts', 3, false);
      expect(result.newDirectedCount).toBe(3);
    });
  });

  // Directed hostility below threshold returns calm redirect
  describe('directed hostility below threshold', () => {
    it('should flag "you are fucking useless" as directed', () => {
      const result = service.check('you are fucking useless', 0, false);
      expect(result.classification).toBe('directed');
      expect(result.newDirectedCount).toBe(1);
      expect(result.shouldEscalate).toBe(false);
      expect(result.response).toContain('I understand you may be frustrated');
    });

    it('should increment directedCount correctly', () => {
      const result = service.check("you're useless", 2, false);
      expect(result.newDirectedCount).toBe(3);
    });

    it('should return calm redirect for messages 1 to 4', () => {
      for (let count = 0; count < 4; count++) {
        const result = service.check("you're an idiot", count, false);
        expect(result.response).toContain('I understand you may be frustrated');
        expect(result.offerIsPending).toBe(false);
      }
    });
  });

  // Human offer triggers at threshold and repeats on subsequent hostile messages
  describe('directed hostility at threshold (5+)', () => {
    it('should return the human offer on the 5th directed message', () => {
      const result = service.check("you're fucking awful", 4, false);
      expect(result.newDirectedCount).toBe(5);
      expect(result.offerIsPending).toBe(true);
      expect(result.response).toContain("I want to help, but I'm not able to continue");
    });

    it('should repeat the human offer when lead ignores it and sends another hostile message', () => {
      const result = service.check("you're still useless", 6, true);
      expect(result.offerIsPending).toBe(true);
      expect(result.response).toContain("I want to help, but I'm not able to continue");
    });

    it('should NOT set shouldEscalate on the hostile message itself', () => {
      const result = service.check("you're awful", 4, false);
      expect(result.shouldEscalate).toBe(false);
    });
  });

  // Escalation only fires when lead explicitly accepts and offer was pending
  describe('lead accepts human offer', () => {
    it('should trigger escalation when lead says "yes please"', () => {
      const result = service.check('yes please', 5, true);
      expect(result.shouldEscalate).toBe(true);
      expect(result.offerIsPending).toBe(false);
      expect(result.response).toContain('team member reach out');
    });

    it('should trigger escalation when lead says "sure"', () => {
      expect(service.check('sure', 5, true).shouldEscalate).toBe(true);
    });

    it('should NOT escalate when offer is not pending even if lead says yes', () => {
      // "yes" in a booking context must not trigger escalation
      const result = service.check('yes that works for me', 0, false);
      expect(result.shouldEscalate).toBe(false);
    });
  });

  // Configurable blocklist allows clinics to add custom words
  describe('configurable blocklist via ABUSE_BLOCKLIST_EXTRA', () => {
    it('should detect words added via env var', async () => {
      const custom = await buildService('scammer, rubbish');
      const result = custom.check('you are a scammer', 0, false);
      expect(result.classification).toBe('directed');
      expect(result.matchedWords).toContain('scammer');
    });

    it('should still detect default blocklist words when extras are added', async () => {
      const custom = await buildService('scammer');
      expect(custom.check('you are shit', 0, false).classification).toBe('directed');
    });
  });
});
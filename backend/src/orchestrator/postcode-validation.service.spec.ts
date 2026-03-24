/**
 * Unit tests for PostcodeValidationService.isInServiceArea().
 *
 * Covers:
 *   - In-area postcodes (CF, NP)
 *   - Out-of-area postcodes
 *   - Empty/undefined service areas (all postcodes accepted)
 *   - Case-insensitivity of service area prefixes
 */
import { PostcodeValidationService } from './postcode-validation.service';

describe('PostcodeValidationService', () => {
  let service: PostcodeValidationService;

  beforeEach(() => {
    service = new PostcodeValidationService();
  });

  describe('isInServiceArea', () => {
    it('should return true for CF10 1AA when serviceAreas contains CF', () => {
      expect(service.isInServiceArea('CF10 1AA', ['CF'])).toBe(true);
    });

    it('should return true for NP20 4NT when serviceAreas contains CF and NP', () => {
      expect(service.isInServiceArea('NP20 4NT', ['CF', 'NP'])).toBe(true);
    });

    it('should return false for EX4 1AB when serviceAreas contains only CF', () => {
      expect(service.isInServiceArea('EX4 1AB', ['CF'])).toBe(false);
    });

    it('should return false for SA1 1AA when serviceAreas contains CF and NP', () => {
      expect(service.isInServiceArea('SA1 1AA', ['CF', 'NP'])).toBe(false);
    });

    it('should return true for any postcode when serviceAreas is empty', () => {
      expect(service.isInServiceArea('EX4 1AB', [])).toBe(true);
    });

    it('should be case-insensitive — lowercase serviceArea prefix matches uppercase postcode', () => {
      expect(service.isInServiceArea('CF10 1AA', ['cf'])).toBe(true);
    });

    it('should be case-insensitive — lowercase postcode matches uppercase serviceArea', () => {
      expect(service.isInServiceArea('cf10 1aa', ['CF'])).toBe(true);
    });

    it('should return true for CF10 1AA when serviceAreas contains both CF and EX', () => {
      expect(service.isInServiceArea('CF10 1AA', ['CF', 'EX'])).toBe(true);
    });

    it('should return false for LD1 5DL when serviceAreas is CF and NP', () => {
      expect(service.isInServiceArea('LD1 5DL', ['CF', 'NP'])).toBe(false);
    });
  });
});

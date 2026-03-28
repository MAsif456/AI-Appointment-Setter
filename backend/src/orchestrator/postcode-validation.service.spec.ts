/**
 * Unit tests for PostcodeValidationService.
 *
 * Covers:
 *   validate()            — full pipeline (extract → normalise → area check)
 *   extractFromMessage()  — postcode extraction from free-text
 *   extractPrefix()       — leading-letter extraction
 *   isInServiceArea()     — backward-compat area check
 */
import { PostcodeValidationService } from './postcode-validation.service';

describe('PostcodeValidationService', () => {
  let service: PostcodeValidationService;

  beforeEach(() => {
    service = new PostcodeValidationService();
  });

  // ---------------------------------------------------------------------------
  // validate() — valid postcodes
  // ---------------------------------------------------------------------------
  describe('validate() — valid postcodes accepted and normalised', () => {
    it('CF10 1AA returns valid with postcode "CF10 1AA" and prefix "CF"', () => {
      const result = service.validate('CF10 1AA', ['CF', 'NP']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
      expect(result.prefix).toBe('CF');
    });

    it('NP20 4AB returns valid with postcode "NP20 4AB" and prefix "NP"', () => {
      const result = service.validate('NP20 4AB', ['CF', 'NP']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('NP20 4AB');
      expect(result.prefix).toBe('NP');
    });

    it('W1A 1AA returns valid with postcode "W1A 1AA" and prefix "W"', () => {
      const result = service.validate('W1A 1AA', ['W']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('W1A 1AA');
      expect(result.prefix).toBe('W');
    });

    it('M1 1AA returns valid with postcode "M1 1AA" and prefix "M"', () => {
      const result = service.validate('M1 1AA', ['M']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('M1 1AA');
      expect(result.prefix).toBe('M');
    });

    it('SW1A 1AA returns valid with postcode "SW1A 1AA" and prefix "SW"', () => {
      const result = service.validate('SW1A 1AA', ['SW']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('SW1A 1AA');
      expect(result.prefix).toBe('SW');
    });

    it('lowercase "cf10 1aa" normalises to "CF10 1AA" and returns valid', () => {
      const result = service.validate('cf10 1aa', ['CF']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
    });

    it('no-space "CF101AA" normalises to "CF10 1AA" and returns valid', () => {
      const result = service.validate('CF101AA', ['CF']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
    });

    it('lowercase no-space "cf101aa" normalises to "CF10 1AA" and returns valid', () => {
      const result = service.validate('cf101aa', ['CF']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
    });

    it('mixed case "Cf10 1aA" normalises to "CF10 1AA" and returns valid', () => {
      const result = service.validate('Cf10 1aA', ['CF']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
    });
  });

  // ---------------------------------------------------------------------------
  // validate() — extraction from longer messages
  // ---------------------------------------------------------------------------
  describe('validate() — extraction from messages', () => {
    it('"My postcode is CF10 1AA" extracts and validates "CF10 1AA"', () => {
      const result = service.validate('My postcode is CF10 1AA', ['CF']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
    });

    it('"I live at CF10 1AA by the way" extracts "CF10 1AA"', () => {
      const result = service.validate('I live at CF10 1AA by the way', ['CF']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
    });

    it('"it\'s cf101aa" extracts and normalises to "CF10 1AA"', () => {
      const result = service.validate("it's cf101aa", ['CF']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
    });

    it('" CF10 1AA " with extra whitespace extracts "CF10 1AA"', () => {
      const result = service.validate(' CF10 1AA ', ['CF']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
    });

    it('"I\'m between CF10 1AA and NP20 4AB" extracts only the first postcode "CF10 1AA"', () => {
      const result = service.validate("I'm between CF10 1AA and NP20 4AB", ['CF', 'NP']);
      expect(result.status).toBe('valid');
      expect(result.postcode).toBe('CF10 1AA');
    });
  });

  // ---------------------------------------------------------------------------
  // validate() — invalid formats
  // ---------------------------------------------------------------------------
  describe('validate() — invalid formats return invalid_format', () => {
    const invalidCases = [
      '12345',
      '123456',
      '90210',
      'CF1',
      'W1',
      'AA',
      'CF10 1AAA',
      'ABCDEF',
      'CF',
      'CF10',
      'NP20',
      'hello',
      'not a postcode',
      'abc123',
      'CF10!1AA',
      'CF10@1AA',
      '',
      '1234 5AA',
      '1CF 0AA',
      '75008',
      '10115',
    ];

    it.each(invalidCases)('"%s" returns invalid_format', (input) => {
      expect(service.validate(input, ['CF', 'NP']).status).toBe('invalid_format');
    });
  });

  // ---------------------------------------------------------------------------
  // validate() — service area checking
  // ---------------------------------------------------------------------------
  describe('validate() — service area validation', () => {
    it('prefix "CF" with serviceAreas ["CF", "NP"] returns valid', () => {
      expect(service.validate('CF10 1AA', ['CF', 'NP']).status).toBe('valid');
    });

    it('prefix "NP" with serviceAreas ["CF", "NP"] returns valid', () => {
      expect(service.validate('NP20 4AB', ['CF', 'NP']).status).toBe('valid');
    });

    it('prefix "EX" with serviceAreas ["CF", "NP"] returns invalid_area', () => {
      expect(service.validate('EX4 1AB', ['CF', 'NP']).status).toBe('invalid_area');
    });

    it('prefix "W" with serviceAreas ["CF", "NP"] returns invalid_area', () => {
      expect(service.validate('W1A 1AA', ['CF', 'NP']).status).toBe('invalid_area');
    });

    it('lowercase postcode "cf10 1aa" with serviceAreas ["CF", "NP"] returns valid (case insensitive)', () => {
      expect(service.validate('cf10 1aa', ['CF', 'NP']).status).toBe('valid');
    });

    it('serviceAreas in lowercase ["cf", "np"] still match uppercase postcode', () => {
      expect(service.validate('CF10 1AA', ['cf', 'np']).status).toBe('valid');
    });

    it('returns valid for any postcode when serviceAreas is empty', () => {
      expect(service.validate('EX4 1AB', []).status).toBe('valid');
    });
  });

  // ---------------------------------------------------------------------------
  // extractFromMessage()
  // ---------------------------------------------------------------------------
  describe('extractFromMessage()', () => {
    it('extracts "CF10 1AA" from a plain postcode string', () => {
      expect(service.extractFromMessage('CF10 1AA')).toBe('CF10 1AA');
    });

    it('extracts postcode from a sentence', () => {
      expect(service.extractFromMessage('My postcode is CF10 1AA')).toBe('CF10 1AA');
    });

    it('extracts the first postcode from a message with two postcodes', () => {
      expect(service.extractFromMessage("CF10 1AA and NP20 4AB")).toBe('CF10 1AA');
    });

    it('returns null for a string with no valid postcode', () => {
      expect(service.extractFromMessage('hello world')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(service.extractFromMessage('')).toBeNull();
    });

    it('returns null for "CF10 1AAA" (word boundary blocks partial match)', () => {
      expect(service.extractFromMessage('CF10 1AAA')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // extractPrefix()
  // ---------------------------------------------------------------------------
  describe('extractPrefix()', () => {
    it('"CF10 1AA" gives prefix "CF"', () => {
      expect(service.extractPrefix('CF10 1AA')).toBe('CF');
    });

    it('"W1A 1AA" gives prefix "W"', () => {
      expect(service.extractPrefix('W1A 1AA')).toBe('W');
    });

    it('"SW1A 1AA" gives prefix "SW"', () => {
      expect(service.extractPrefix('SW1A 1AA')).toBe('SW');
    });

    it('"EX4 1AB" gives prefix "EX"', () => {
      expect(service.extractPrefix('EX4 1AB')).toBe('EX');
    });

    it('"M1 1AA" gives prefix "M"', () => {
      expect(service.extractPrefix('M1 1AA')).toBe('M');
    });

    it('"B1 1BB" gives prefix "B"', () => {
      expect(service.extractPrefix('B1 1BB')).toBe('B');
    });

    it('"NP20 4AB" gives prefix "NP"', () => {
      expect(service.extractPrefix('NP20 4AB')).toBe('NP');
    });

    it('works with just the outward code "CF10"', () => {
      expect(service.extractPrefix('CF10')).toBe('CF');
    });
  });

  // ---------------------------------------------------------------------------
  // isInServiceArea() — backward compat
  // ---------------------------------------------------------------------------
  describe('isInServiceArea()', () => {
    it('returns true for CF10 1AA when serviceAreas contains CF', () => {
      expect(service.isInServiceArea('CF10 1AA', ['CF'])).toBe(true);
    });

    it('returns true for NP20 4NT when serviceAreas contains CF and NP', () => {
      expect(service.isInServiceArea('NP20 4NT', ['CF', 'NP'])).toBe(true);
    });

    it('returns false for EX4 1AB when serviceAreas contains only CF', () => {
      expect(service.isInServiceArea('EX4 1AB', ['CF'])).toBe(false);
    });

    it('returns true for any postcode when serviceAreas is empty', () => {
      expect(service.isInServiceArea('EX4 1AB', [])).toBe(true);
    });

    it('is case-insensitive — lowercase serviceArea prefix matches uppercase postcode', () => {
      expect(service.isInServiceArea('CF10 1AA', ['cf'])).toBe(true);
    });

    it('is case-insensitive — lowercase postcode matches uppercase serviceArea', () => {
      expect(service.isInServiceArea('cf10 1aa', ['CF'])).toBe(true);
    });
  });
});

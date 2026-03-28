import { ContentSanitiserService } from './content-sanitiser.service';

describe('ContentSanitiserService', () => {
  let service: ContentSanitiserService;

  beforeEach(() => {
    service = new ContentSanitiserService();
  });

  // Normal text passes unmodified

  describe('normal text', () => {
    it('should not modify plain text messages', () => {
      expect(service.sanitise('My postcode is CF10 1AA')).toBe('My postcode is CF10 1AA');
    });

    it('should not modify booking requests', () => {
      expect(service.sanitise('I need to book an appointment for Thursday')).toBe(
        'I need to book an appointment for Thursday',
      );
    });
  });

  // Preserve medical text with angle brackets

  describe('medical text preservation', () => {
    it('should preserve "pain <2 weeks"', () => {
      expect(service.sanitise('pain <2 weeks')).toBe('pain <2 weeks');
    });

    it('should preserve "temp >38.5C"', () => {
      expect(service.sanitise('temp >38.5C')).toBe('temp >38.5C');
    });

    it('should preserve "symptoms <1 month and worsening"', () => {
      expect(service.sanitise('symptoms <1 month and worsening')).toBe(
        'symptoms <1 month and worsening',
      );
    });

    it('should preserve multiple angle brackets in medical context', () => {
      expect(service.sanitise("I've had pain <2 weeks and temp >38.5C")).toBe(
        "I've had pain <2 weeks and temp >38.5C",
      );
    });
  });

  // Strip dangerous HTML content

  describe('dangerous content stripping', () => {
    it('should strip <script> tags and their content', () => {
      expect(service.sanitise('<script>alert("xss")</script>')).toBe('');
    });

    it('should strip <script> tags and preserve surrounding text', () => {
      expect(service.sanitise('Hello <script>alert(1)</script> I need an appointment')).toBe(
        'Hello I need an appointment',
      );
    });

    it('should strip <style> tags and their content', () => {
      expect(service.sanitise('<style>body{display:none}</style>some text')).toBe('some text');
    });

    it('should strip <iframe> tags', () => {
      expect(service.sanitise('<iframe src="evil.com"></iframe>')).toBe('');
    });

    it('should strip <img> tags with event handlers', () => {
      expect(service.sanitise('<img onerror="alert(1)">')).toBe('');
    });

    it('should strip <object> tags', () => {
      expect(service.sanitise('<object data="malware.swf"></object>')).toBe('');
    });

    it('should strip <embed> tags', () => {
      expect(service.sanitise('<embed src="bad.swf">')).toBe('');
    });

    it('should strip <form> tags', () => {
      expect(service.sanitise('<form action="evil.com"><input type="text"></form>')).toBe('');
    });

    it('should strip event handler attributes', () => {
      const result = service.sanitise('<div onclick="alert(1)">click me</div>');
      expect(result).not.toContain('onclick');
    });
  });

  // Mixed legitimate and dangerous content

  describe('mixed content', () => {
    it('should handle medical text mixed with script tags', () => {
      const result = service.sanitise('My pain <2 weeks and <script>alert(1)</script>');
      expect(result).toContain('pain <2 weeks');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert(1)');
    });

    it('should preserve legitimate text after stripping dangerous tags', () => {
      const result = service.sanitise(
        'I need help <script>document.cookie</script> with booking an appointment',
      );
      expect(result).toContain('I need help');
      expect(result).toContain('with booking an appointment');
      expect(result).not.toContain('document.cookie');
    });
  });

  // Null bytes and invisible characters

  describe('invisible character stripping', () => {
    it('should strip null bytes', () => {
      expect(service.sanitise('hello\x00world')).toBe('helloworld');
    });

    it('should strip zero-width spaces', () => {
      expect(service.sanitise('hello\u200Bworld')).toBe('helloworld');
    });

    it('should strip zero-width joiners', () => {
      expect(service.sanitise('ignore\u200Dall\u200Dprevious')).toBe('ignoreallprevious');
    });

    it('should strip byte order marks', () => {
      expect(service.sanitise('\uFEFFhello')).toBe('hello');
    });

    it('should strip soft hyphens', () => {
      expect(service.sanitise('in\u00ADstruct\u00ADions')).toBe('instructions');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(service.sanitise('')).toBe('');
    });

    it('should normalise excessive whitespace left by stripping', () => {
      const result = service.sanitise('Hello  <script>x</script>  world');
      expect(result).toBe('Hello world');
    });

    it('should handle nested script attempts', () => {
      // After outer script is stripped, inner doesn't form valid tag
      const result = service.sanitise('<scr<script>ipt>alert(1)</script>');
      expect(result).not.toContain('alert(1)');
    });

    it('should handle closing tags without opening tags', () => {
      const result = service.sanitise('text</div>more text</p>');
      expect(result).toBe('textmore text');
    });
  });
});

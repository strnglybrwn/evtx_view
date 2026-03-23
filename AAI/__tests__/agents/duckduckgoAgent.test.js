const duckAgent = require('../../agents/duckduckgoAgent');

describe('DuckDuckGo Agent', () => {
  describe('supports()', () => {
    test('should score high for short factual queries', () => {
      expect(duckAgent.supports('apple')).toBeGreaterThanOrEqual(0.6);
      expect(duckAgent.supports('what is paris')).toBeGreaterThanOrEqual(0.6);
    });

    test('should score lower for image-related queries', () => {
      const imageScore = duckAgent.supports('detect faces in image');
      expect(imageScore).toBeLessThan(0.5);
    });

    test('should score 0 for invalid input', () => {
      expect(duckAgent.supports(null)).toBe(0);
      expect(duckAgent.supports(undefined)).toBe(0);
      expect(duckAgent.supports(123)).toBe(0);
    });

    test('should score lower for long complex questions', () => {
      const shortScore = duckAgent.supports('Paris');
      const longScore = duckAgent.supports('Can you provide a detailed analysis of the geopolitical implications of recent trade agreements between major global powers?');
      expect(longScore).toBeLessThan(shortScore);
    });
  });

  describe('requirements', () => {
    test('should include internet-access', () => {
      expect(duckAgent.requirements).toContain('internet-access');
    });
  });

  // Note: run() test requires network access, so we skip it in unit tests
  // It should be tested in integration tests with network connectivity
});

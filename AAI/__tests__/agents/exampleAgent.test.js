const exampleAgent = require('../../agents/exampleAgent');

describe('Example Agent', () => {
  describe('supports()', () => {
    test('should return 0.5 for any input', () => {
      expect(exampleAgent.supports('any question')).toBe(0.5);
      expect(exampleAgent.supports('')).toBe(0.5);
      expect(exampleAgent.supports(null)).toBe(0.5);
    });
  });

  describe('run()', () => {
    test('should return output and metadata', async () => {
      const input = 'test question';
      const result = await exampleAgent.run(input);

      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('metadata');
      expect(typeof result.output).toBe('string');
      expect(result.output).toContain('looking into');
    });

    test('should include input in output', async () => {
      const input = 'what is AI?';
      const result = await exampleAgent.run(input);

      expect(result.output).toContain('what is AI?');
    });

    test('should have metadata with length', async () => {
      const result = await exampleAgent.run('test');

      expect(result.metadata).toHaveProperty('length');
      expect(typeof result.metadata.length).toBe('number');
    });
  });

  describe('requirements', () => {
    test('should be empty array', () => {
      expect(Array.isArray(exampleAgent.requirements)).toBe(true);
      expect(exampleAgent.requirements).toEqual([]);
    });
  });
});

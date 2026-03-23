const secretStore = require('../../lib/secretStore');
const fs = require('fs');
const path = require('path');

describe('Secret Store', () => {
  const testFile = path.join(__dirname, '..', '..', '.env.test');
  
  beforeEach(() => {
    // Use a test file
    secretStore.clear();
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  describe('set() and get()', () => {
    test('should store and retrieve a value', () => {
      secretStore.set('TEST_KEY', 'test_value');
      expect(secretStore.get('TEST_KEY')).toBe('test_value');
    });

    test('should return null for non-existent key', () => {
      expect(secretStore.get('NON_EXISTENT')).toBeNull();
    });

    test('should overwrite existing keys', () => {
      secretStore.set('KEY', 'value1');
      secretStore.set('KEY', 'value2');
      expect(secretStore.get('KEY')).toBe('value2');
    });

    test('should handle multiple keys', () => {
      secretStore.set('KEY1', 'value1');
      secretStore.set('KEY2', 'value2');
      secretStore.set('KEY3', 'value3');

      expect(secretStore.get('KEY1')).toBe('value1');
      expect(secretStore.get('KEY2')).toBe('value2');
      expect(secretStore.get('KEY3')).toBe('value3');
    });
  });

  describe('clear()', () => {
    test('should clear specific key', () => {
      secretStore.set('KEY1', 'value1');
      secretStore.set('KEY2', 'value2');

      secretStore.clear('KEY1');

      expect(secretStore.get('KEY1')).toBeNull();
      expect(secretStore.get('KEY2')).toBe('value2');
    });

    test('should clear all keys when no argument provided', () => {
      secretStore.set('KEY1', 'value1');
      secretStore.set('KEY2', 'value2');

      secretStore.clear();

      expect(secretStore.get('KEY1')).toBeNull();
      expect(secretStore.get('KEY2')).toBeNull();
    });
  });
});
